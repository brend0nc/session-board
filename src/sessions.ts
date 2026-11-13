/* Reads the Claude desktop app's session files and the Claude Code transcripts.
   Neither format is public. Each read is defensive: a field that is missing gives an empty value. */
import fs from "node:fs";
import path from "node:path";
import { Config, pageConfig, PageConfig, sessionsDir, transcriptsDir } from "./config.js";
import { Message, now, readBeat, readDone, readOutbox } from "./store.js";

const TAIL_BYTES = 6_000_000;
const KEEP_MESSAGES = 60;
const MSG_CHARS = 12_000;
const WORKING_WINDOW = 900;
const RELAY_ALIVE = 8;
const STALE_CLAIM = 90;

export const SESSION_ID = /^local_[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
export const TERMINAL_ID = /^terminal_([0-9a-f]{8})$/;
const ANY_MARK = /^[^\n]{0,60}?\(via session board\): /;
const PEER = /<cross-session-message[^>]*?from-name="([^"]*)"[^>]*>([\s\S]*?)<\/cross-session-message>/;
const NOT_A_PROMPT = [
  "<task-notification", "<local-command", "[Request interrupted",
  "This session is being continued", "<side-sessions-event", "<ci-monitor-event",
];

export interface ChatMessage {
  role: "you" | "claude" | "peer" | "step";
  ts: number;
  text: string;
  name?: string;
  outbox?: { id: string; status: string; note: string };
}

interface Wrap {
  ts: number;
  ask: string;
  recap: string;
  options: string[];
}

interface Facts {
  user: { ts: number; text: string } | null;
  wrap: Wrap | null;
  text: { ts: number; text: string } | null;
  title: string | null;
  lastTs: number;
  openTurn: boolean;
  messages: ChatMessage[];
}

export interface Row {
  id: string;
  title: string;
  link: string;
  can_message: boolean;
  question: string;
  context: string;
  options: string[];
  options_from?: string;
  note: string;
  state: "waits" | "works" | "quiet";
  since: number;
  done?: boolean;
  message?: { status: string };
}

export interface BoardState {
  now: number;
  project: string;
  rows: Row[];
  page: number;
  relay: { on: boolean; session: string };
  config: PageConfig;
}

type Json = Record<string, any>;

const epoch = (ts: unknown): number => (typeof ts === "string" ? Date.parse(ts) / 1000 || 0 : 0);

function clean(text: string, limit = 220): string {
  const flat = (text || "").replace(/<[^>]+>/g, " ").replace(/[*_`#|]+/g, "").replace(/\s+/g, " ").trim();
  return flat.length <= limit ? flat : flat.slice(0, limit - 1).trimEnd() + "…";
}

function listDir(dir: string): string[] {
  try {
    return fs.readdirSync(dir);
  } catch {
    return [];
  }
}

function readJsonFile(file: string): Json | null {
  try {
    const found = JSON.parse(fs.readFileSync(file, "utf8"));
    return found && typeof found === "object" ? found : null;
  } catch {
    return null;
  }
}

/** Text of a real prompt. Empty for tool results and harness messages. */
function promptText(content: unknown): string {
  let text: string;
  if (typeof content === "string") text = content;
  else if (Array.isArray(content)) {
    if (content.some((b) => b && b.type === "tool_result")) return "";
    text = content.filter((b) => b && b.type === "text").map((b) => b.text || "").join("\n");
  } else return "";
  text = text.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "").trim();
  if (!text || NOT_A_PROMPT.some((p) => text.startsWith(p))) return "";
  return text;
}

/** A prompt as the chat shows it: no command markup. */
function showPrompt(text: string): string {
  const name = /<command-name>([\s\S]*?)<\/command-name>/.exec(text);
  if (name) {
    const args = /<command-args>([\s\S]*?)<\/command-args>/.exec(text);
    return (name[1].trim() + " " + (args ? args[1].trim() : "")).trim();
  }
  const shell = /<bash-input>([\s\S]*?)<\/bash-input>/.exec(text);
  if (shell) return "! " + shell[1].trim();
  return text;
}

/** One prompt as a chat message. A board message counts as the user's own words. */
function chatMessage(text: string, ts: number): ChatMessage {
  const peer = PEER.exec(text);
  if (peer) {
    const body = peer[2].trim();
    const mark = ANY_MARK.exec(body);
    if (mark) return { role: "you", ts, text: body.slice(mark[0].length).trim().slice(0, MSG_CHARS) };
    return { role: "peer", name: peer[1], ts, text: body.slice(0, MSG_CHARS) };
  }
  const mark = ANY_MARK.exec(text);
  if (mark) text = text.slice(mark[0].length).trim();
  return { role: "you", ts, text: showPrompt(text).slice(0, MSG_CHARS) };
}

/** Claude Code names a transcript folder after the project path, with "-" for each character that is not a letter or a digit. */
const folderName = (project: string): string => project.replace(/[^A-Za-z0-9]/g, "-");

const META_KEYS = ["sessionId", "cliSessionId", "lastAssistantCliSessionId", "cwd", "originCwd", "isArchived",
  "lastActivityAt", "title", "postTurnSummary", "postTurnSummaryFor", "lastAssistantUuid"];
const metaCache = new Map<string, { key: string; meta: Json | null }>();

/** A session file of the desktop app, cut down to the fields the board uses. Parsed again only when the file changes. */
function readMeta(file: string): Json | null {
  let key: string;
  try {
    const st = fs.statSync(file);
    key = st.mtimeMs + ":" + st.size;
  } catch {
    return null;
  }
  const hit = metaCache.get(file);
  if (hit && hit.key === key) return hit.meta;
  const full = readJsonFile(file);
  const meta = full ? Object.fromEntries(META_KEYS.map((k) => [k, full[k]])) : null;
  metaCache.set(file, { key, meta });
  return meta;
}

const cache = new Map<string, { key: string; facts: Facts }>();

/** Last prompt, last wrap-up, last reply, turn state and chat, from the end of a transcript. */
function tailFacts(file: string): Facts | null {
  let st: fs.Stats;
  try {
    st = fs.statSync(file);
  } catch {
    return null;
  }
  const key = st.mtimeMs + ":" + st.size;
  const hit = cache.get(file);
  if (hit && hit.key === key) return hit.facts;

  const start = Math.max(0, st.size - TAIL_BYTES);
  const buffer = Buffer.alloc(st.size - start);
  const fd = fs.openSync(file, "r");
  try {
    fs.readSync(fd, buffer, 0, buffer.length, start);
  } finally {
    fs.closeSync(fd);
  }
  let raw = buffer.toString("utf8");
  if (start > 0) raw = raw.slice(raw.indexOf("\n") + 1);

  const facts: Facts = { user: null, wrap: null, text: null, title: null, lastTs: 0, openTurn: false, messages: [] };
  let msgs: ChatMessage[] = [];
  for (const line of raw.split("\n")) {
    if (!line) continue;
    let e: Json;
    try {
      e = JSON.parse(line);
    } catch {
      continue;
    }
    const kind = e.type;
    if (kind === "custom-title") facts.title = e.customTitle || facts.title;
    else if (kind === "ai-title") facts.title = facts.title || e.aiTitle;
    const ts = epoch(e.timestamp);
    if (kind === "queue-operation") {
      // A message typed while the session works is stored only here.
      if (e.operation === "remove" && e.reason === "absorbed_mid_turn") {
        const text = promptText(e.content);
        if (text) {
          const shown = chatMessage(text, ts);
          facts.user = { ts, text: shown.text.slice(0, 600) };
          msgs.push(shown);
        }
      }
      continue;
    }
    if ((kind !== "user" && kind !== "assistant") || e.isSidechain) continue;
    const msg: Json = e.message || {};
    const content = msg.content;
    if (kind === "user") {
      facts.openTurn = true;
      facts.lastTs = ts || facts.lastTs;
      if (e.isCompactSummary) continue;
      const text = promptText(content);
      // A message from another session is a meta entry. Other meta entries are harness text.
      if (e.isMeta && !text.includes("<cross-session-message")) continue;
      if (text) {
        const shown = chatMessage(text, ts);
        facts.user = { ts, text: shown.text.slice(0, 600) };
        msgs.push(shown);
      }
    } else {
      const stop = msg.stop_reason;
      facts.openTurn = stop === "tool_use";
      facts.lastTs = ts || facts.lastTs;
      for (const block of Array.isArray(content) ? content : []) {
        if (!block || typeof block !== "object") continue;
        if (block.type === "text" && String(block.text || "").trim()) {
          const body = String(block.text).trim();
          facts.text = { ts, text: body.slice(0, 600) };
          msgs.push({ role: stop == null || stop === "tool_use" ? "step" : "claude", ts, text: body.slice(0, MSG_CHARS) });
        } else if (block.type === "tool_use" && String(block.name || "").endsWith("wrap_up")) {
          const input: Json = block.input || {};
          const actions: Json[] = Array.isArray(input.actions) ? input.actions : [];
          facts.wrap = {
            ts,
            ask: input.ask || "",
            recap: input.recap || "",
            options: actions.filter((a) => a && a.label && !a.action).map((a) => String(a.label)),
          };
        }
      }
    }
  }
  // Progress lines matter only for the turn that still runs.
  let lastReal = -1;
  msgs.forEach((m, i) => { if (m.role !== "step") lastReal = i; });
  msgs = msgs.filter((m, i) => m.role !== "step" || i > lastReal);
  facts.messages = msgs.slice(-KEEP_MESSAGES);
  cache.set(file, { key, facts });
  return facts;
}

/** 'choose 1 (finish v6), 2 (run now)' gives ['1: finish v6', '2: run now']. */
function numberedOptions(text: string): string[] {
  const found = [...(text || "").matchAll(/\b([1-9])\s*\(([^)]{1,80})\)/g)];
  return found.length >= 2 ? found.map((m) => m[1] + ": " + m[2].trim()) : [];
}

/** Numbered choices at the end of a reply, as '1. Finish v6 first'. */
function textOptions(text: string): string[] {
  const found: [number, string][] = [];
  let trailing = 0;
  for (const line of (text || "").split("\n").reverse()) {
    const hit = /^\s*(\d{1,2})[.)]\s+(.+)/.exec(line);
    if (hit) found.push([Number(hit[1]), hit[2]]);
    else if (!line.trim()) continue;
    else if (!found.length && trailing < 2) trailing++;
    else break;
  }
  found.reverse();
  if (found.length < 2 || found.some(([n], i) => n !== i + 1)) return [];
  return found.slice(0, 9).map(([n, label]) => n + ". " + clean(label, 90));
}

export class Board {
  private readonly sessions: string;
  private readonly transcripts: string;

  constructor(private readonly config: () => Config, private readonly webDir: string) {
    this.sessions = sessionsDir(config());
    this.transcripts = transcriptsDir(config());
  }

  private metaFiles(): string[] {
    const out: string[] = [];
    for (const a of listDir(this.sessions)) {
      for (const b of listDir(path.join(this.sessions, a))) {
        const dir = path.join(this.sessions, a, b);
        for (const f of listDir(dir)) if (f.startsWith("local_") && f.endsWith(".json")) out.push(path.join(dir, f));
      }
    }
    return out;
  }

  private transcriptOf(cli: string): string | null {
    if (!/^[0-9a-f-]{8,40}$/.test(cli)) return null;
    for (const dir of listDir(this.transcripts)) {
      const file = path.join(this.transcripts, dir, cli + ".jsonl");
      if (fs.existsSync(file)) return file;
    }
    return null;
  }

  private findTranscript(rowId: string): string | null {
    const term = TERMINAL_ID.exec(rowId);
    const project = this.config().project;
    if (term) {
      for (const dir of listDir(this.transcripts)) {
        if (!dir.includes(folderName(project))) continue;
        const hit = listDir(path.join(this.transcripts, dir)).find((f) => f.startsWith(term[1]) && f.endsWith(".jsonl"));
        if (hit) return path.join(this.transcripts, dir, hit);
      }
      return null;
    }
    if (!SESSION_ID.test(rowId)) return null;
    const metaFile = this.metaFiles().find((f) => path.basename(f) === rowId + ".json");
    const meta = metaFile ? readMeta(metaFile) : null;
    return meta && meta.cliSessionId ? this.transcriptOf(String(meta.cliSessionId)) : null;
  }

  private sessionRow(meta: Json, at: number): Row {
    const sid = String(meta.sessionId);
    const file = meta.cliSessionId ? this.transcriptOf(String(meta.cliSessionId)) : null;
    const facts: Facts = (file && tailFacts(file)) ||
      { user: null, wrap: null, text: null, title: null, lastTs: 0, openTurn: false, messages: [] };
    const post: Json = meta.postTurnSummary || {};
    const fresh = Object.keys(post).length > 0 && meta.postTurnSummaryFor === meta.lastAssistantUuid;
    const { wrap, user, text } = facts;
    const wts = wrap ? wrap.ts : 0, uts = user ? user.ts : 0, tts = text ? text.ts : 0;
    const replied = Math.max(wts, tts) || (meta.lastActivityAt || 0) / 1000;
    const lastReply = [...facts.messages].reverse().find((m) => m.role === "claude");
    const fromText = lastReply ? textOptions(lastReply.text) : [];

    const row: Row = {
      id: sid, title: meta.title || facts.title || "Untitled session",
      link: "claude://claude.ai/epitaxy/" + sid, can_message: true,
      question: "", context: "", options: [], note: "", state: "quiet", since: replied,
    };
    if (facts.openTurn && at - facts.lastTs < WORKING_WINDOW) {
      row.state = "works";
      row.since = uts || facts.lastTs;
      row.context = user ? "On: " + clean(user.text, 160) : "";
    } else if (wrap && wrap.ask && wts >= uts) {
      row.state = "waits";
      row.since = wts;
      row.question = wrap.ask;
      row.context = wrap.recap;
      row.options = wrap.options.length ? wrap.options : fromText;
      row.options_from = wrap.options.length ? "wrap" : "text";
    } else if (fresh && post.status_category === "blocked") {
      const ask = post.needs_action || post.status_detail || "It waits for your answer.";
      row.state = "waits";
      row.question = ask;
      row.context = post.needs_action ? post.status_detail || "" : "";
      row.options = fromText.length ? fromText : numberedOptions(ask);
      row.options_from = fromText.length ? "text" : "summary";
    } else {
      row.context = (fresh ? post.status_detail : "") || (wrap && wts >= uts ? wrap.recap : "") || (text ? clean(text.text, 200) : "");
      row.note = fresh ? String(post.status_category || "").replace(/_/g, " ") : "";
    }
    return row;
  }

  /** Terminal sessions have a transcript but no desktop session. They are read-only. */
  private terminalRows(known: Set<string>, at: number): Row[] {
    const rows: Row[] = [];
    const project = this.config().project;
    for (const dir of listDir(this.transcripts)) {
      if (!dir.includes(folderName(project))) continue;
      for (const f of listDir(path.join(this.transcripts, dir))) {
        if (!f.endsWith(".jsonl")) continue;
        const cli = f.slice(0, -6), file = path.join(this.transcripts, dir, f);
        try {
          if (known.has(cli) || at - fs.statSync(file).mtimeMs / 1000 > 86400) continue;
        } catch {
          continue;
        }
        const facts = tailFacts(file);
        if (!facts || at - facts.lastTs > 86400) continue;
        rows.push({
          id: "terminal_" + cli.slice(0, 8),
          title: (facts.title || (facts.user ? clean(facts.user.text, 60) : "Terminal session")) + " (terminal)",
          link: "", can_message: false, question: "", options: [], note: "",
          state: facts.openTurn && at - facts.lastTs < WORKING_WINDOW ? "works" : "quiet",
          since: facts.lastTs,
          context: facts.text ? clean(facts.text.text, 200) : "",
        });
      }
    }
    return rows;
  }

  state(): BoardState {
    const at = now(), config = this.config();
    const done = readDone(), beat = readBeat();
    const lastMessage = new Map<string, Message>();
    for (const item of readOutbox()) if (item.status !== "cancelled") lastMessage.set(item.session_id, item);

    const rows: Row[] = [], known = new Set<string>();
    for (const file of this.metaFiles()) {
      const meta = readMeta(file);
      if (!meta || !meta.sessionId) continue;
      for (const key of ["cliSessionId", "lastAssistantCliSessionId"]) if (meta[key]) known.add(String(meta[key]));
      const where = (meta.cwd || "") + " " + (meta.originCwd || "");
      if (!where.includes(config.project) || meta.isArchived) continue;
      if (meta.sessionId === beat.session) continue;
      if (at - (meta.lastActivityAt || 0) / 1000 > config.days * 86400) continue;
      rows.push(this.sessionRow(meta, at));
    }
    rows.push(...this.terminalRows(known, at));

    for (const row of rows) {
      // A done card comes back by itself when the session asks or works again.
      const marked = done[row.id] || 0;
      row.done = marked > 0 && !(row.state !== "quiet" && row.since > marked);
      const msg = lastMessage.get(row.id);
      if (msg && ["queued", "sending", "failed"].includes(msg.status)) row.message = { status: msg.status };
    }
    rows.sort((a, b) => b.since - a.since);

    let page = 0;
    for (const f of listDir(this.webDir)) {
      try {
        page = Math.max(page, fs.statSync(path.join(this.webDir, f)).mtimeMs);
      } catch {
        continue;
      }
    }
    return {
      now: at, project: config.project || "all projects", rows, page,
      relay: { on: at - (beat.ts || 0) < RELAY_ALIVE, session: beat.session || "" },
      config: pageConfig(config),
    };
  }

  /** Chat of one session, plus board messages that the session has not read yet. */
  thread(rowId: string): { id: string; messages: ChatMessage[] } {
    const at = now();
    const file = this.findTranscript(rowId);
    const facts = file ? tailFacts(file) : null;
    const msgs: ChatMessage[] = facts ? [...facts.messages] : [];
    const mine = readOutbox().filter((it) => it.session_id === rowId && it.status !== "cancelled");
    for (const it of mine.slice(-10)) {
      if (it.status === "sent") {
        const sentAt = it.done_ts || it.ts;
        const arrived = msgs.some((m) => m.role === "you" && m.ts >= sentAt - 60 && m.text.includes(it.text.slice(0, 80)));
        if (arrived || at - sentAt > 3600) continue;
      }
      const stale = it.status === "sending" && at - (it.claim_ts || at) > STALE_CLAIM;
      msgs.push({
        role: "you", ts: it.ts, text: it.text,
        outbox: { id: it.id, status: stale ? "failed" : it.status, note: stale ? "The relay did not confirm it." : it.note || "" },
      });
    }
    return { id: rowId, messages: msgs };
  }
}

export { STALE_CLAIM };
