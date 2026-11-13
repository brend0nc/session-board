/* The board page: the current question, the four columns, and the chat panel. */
import { sprite, stepWalkers } from "./creatures.js";
import { Demo, demoFor } from "./demo.js";
import { icon, iconButton } from "./icons.js";
import { md } from "./markdown.js";
import { chooseView, View } from "./mountains.js";
import { paint, phaseOf } from "./scene.js";
import { $, api, BoardState, BOOT, CALM, ChatMessage, el, flash, hash, PageConfig, Row, seeded, when } from "./util.js";

type Col = "waits" | "works" | "quiet" | "done";
const COLS: [Col, string][] = [["waits", "Waits for you"], ["works", "Works now"], ["quiet", "Quiet"], ["done", "Done"]];

interface Composer {
  id: string;
  opts: HTMLElement;
  ta: HTMLTextAreaElement;
  err: HTMLElement;
  labels: string | null;
}

/* To try a look without a change to the settings, add these to the address:
   ?demo=webdev (or research, founder), ?view=fuji, ?at=07:30, ?theme=paper, ?lat=51.5&lon=-0.1, ?city=London, ?open=1, ?full=1 */
const TRY = new URLSearchParams(location.search);
const DEMO: Demo | null = demoFor(TRY.get("demo"), BOOT.config, TRY.get("at"));

/** One place for every call to the server. In a demo the sample data answers. */
function call<T = unknown>(path: string, body?: Record<string, unknown>): Promise<T> {
  return DEMO ? DEMO.call<T>(path, body) : api<T>(path, body);
}

let state: BoardState | null = null;
let config: PageConfig = DEMO ? DEMO.settings() : BOOT.config;
let view: View = chooseView(config, "");
let boardSig = "", threadSig = "", threadCount = 0;
let openId: string | null = null, focusId: string | null = null, dragging: string | null = null;
let pageStamp: number | null = null, frame = 0, minutes = 0;
let menu: { key: string; run: () => void }[] = [];
let ui: Composer | null = null;
let sending = false;
let clockFormat = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const drafts: Record<string, string> = {};
let seen: Record<string, number> = {};
try { seen = JSON.parse(localStorage.getItem("seen") || "{}"); } catch { /* private mode */ }

const rows = (): Row[] => (state ? state.rows : []);
const colOf = (r: Row): Col => (r.done ? "done" : r.state);
const rowOf = (id: string | null): Row | undefined => rows().find((r) => r.id === id);
const waiting = (): Row[] => rows().filter((r) => colOf(r) === "waits");
const isNew = (r: Row): boolean => colOf(r) === "waits" && r.id !== openId && r.since > (seen[r.id] || 0);

function markSeen(r: Row): void {
  seen[r.id] = r.since;
  try { localStorage.setItem("seen", JSON.stringify(seen)); } catch { /* private mode */ }
}

/* ---------- name, place and time ---------- */

function zoneName(): string {
  return config.time_zone || Intl.DateTimeFormat().resolvedOptions().timeZone || "";
}

/** Take new settings: the clock's time zone, the view for the place, and the board's name. */
function applyConfig(next: PageConfig): void {
  config = next;
  const options: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit", hourCycle: "h23" };
  try {
    clockFormat = new Intl.DateTimeFormat("en-GB", { ...options, timeZone: config.time_zone || undefined });
  } catch {
    clockFormat = new Intl.DateTimeFormat("en-GB", options);
  }
  view = chooseView({
    skyline: TRY.get("view") || config.skyline,
    lat: TRY.has("lat") ? Number(TRY.get("lat")) : config.lat,
    lon: TRY.has("lon") ? Number(TRY.get("lon")) : config.lon,
  }, zoneName());
  $("city").textContent = TRY.get("city") || config.city || (view.name ? view.place : (zoneName().split("/").pop() || "").replace(/_/g, " "));
  const title = document.getElementById("title");
  if (title) {
    title.textContent = config.title;
    $("rename").replaceChildren(iconButton("pencil", "Rename the board", startRename));
  }
  const locate = $("locate");
  locate.textContent = "";
  if (config.lat === null && "geolocation" in navigator) locate.append(iconButton("pin", "Find my mountain", findPlace, true));
  tick();
  head();
  drawScene();
}

function findPlace(): void {
  navigator.geolocation.getCurrentPosition(async (found) => {
    try {
      applyConfig(await call<PageConfig>("/api/config", { lat: found.coords.latitude, lon: found.coords.longitude }));
      flash(view.name ? "Your view is " + view.name + "." : "No known mountain is near. You get a range in the style of your region.");
    } catch (e) {
      flash((e as Error).message);
    }
  }, () => flash("No location. The board uses your time zone."), { maximumAge: 86400000, timeout: 10000 });
}

function startRename(): void {
  const input = el("input", { id: "titleedit", class: "px", type: "text", maxlength: "60", "aria-label": "Name of the board" });
  input.value = config.title;
  $("title").replaceWith(input);
  $("rename").textContent = "";
  input.select();
  let closed = false;
  const finish = async (save: boolean) => {
    if (closed) return;
    closed = true;
    const name = input.value.trim();
    input.replaceWith(el("h1", { id: "title" }));
    if (save && name && name !== config.title) {
      try {
        applyConfig(await call<PageConfig>("/api/config", { title: name }));
        return;
      } catch (e) {
        flash((e as Error).message);
      }
    }
    applyConfig(config);
  };
  input.onkeydown = (e) => {
    if (e.key === "Enter") finish(true);
    else if (e.key === "Escape") { e.stopPropagation(); finish(false); }
  };
  input.onblur = () => finish(true);
}

function tick(): void {
  const hhmm = /^\d\d:\d\d$/.test(TRY.get("at") || "") ? TRY.get("at")! : clockFormat.format(new Date());
  const [h, m] = hhmm.split(":").map(Number);
  minutes = h * 60 + m;
  document.documentElement.dataset.sky = phaseOf(minutes);
  $("clock").textContent = hhmm;
}

/** The view changes one time each day: the seed is the date. */
function drawScene(): void {
  const seed = hash(new Date().toDateString());
  const working = rows().filter((r) => colOf(r) === "works").map((r) => r.id);
  paint($("scene") as HTMLCanvasElement, { rows: 64, horizon: 51, rise: 26, minutes, frame, view, seed, sparks: working, cast: null });
  const r = rowOf(openId);
  if (r) {
    const cast = { id: r.id, walking: r.state === "works" && !CALM };
    paint($("pscene") as HTMLCanvasElement, { rows: 26, horizon: 21, rise: 10, minutes, frame, view, seed, sparks: [], cast });
  }
}

function animate(): void {
  if (document.hidden) return;
  frame++;
  drawScene();
  stepWalkers(((frame >> 1) & 1) === 1);
}

function head(): void {
  const count = waiting().length;
  document.title = (count ? count + " wait · " : "") + config.title;
  if (!state) return;
  $("project").textContent = state.project + (view.name ? " · view of " + view.name : "");
  const relay = $("relay"), on = state.relay.on;
  if (relay.className !== (on ? "on" : "off")) {
    // Connected: the full wifi sign. Not connected: the same sign with a slash, as a button that opens
    // a Claude session with the relay prompt in its box.
    const label = on ? "Relay on. Your messages go out." : "Relay off. Your messages stay queued.";
    relay.className = on ? "on" : "off";
    relay.title = on ? label : "";
    relay.setAttribute("aria-label", label);
    if (on) relay.replaceChildren(icon("wifi"));
    else relay.replaceChildren(iconButton("wifiOff", "Start the relay", () => flash("Claude opens a new session. Press Enter there."), true, BOOT.relayLink));
  }
}

/* ---------- the current question ---------- */

function focusRow(): Row | null {
  const list = waiting();
  if (!list.length) return null;
  return list.find((r) => r.id === focusId) || list.find(isNew) || list[0];
}

function nextQuestion(): void {
  const list = waiting(), current = focusRow();
  if (!list.length || !current) return;
  const r = list[(list.indexOf(current) + 1) % list.length];
  focusId = r.id;
  if (openId) openPanel(r.id);
  else { renderNow(); renderBoard(); }
}

function renderNow(): void {
  const box = $("now");
  box.textContent = "";
  menu = [];
  const r = focusRow();
  if (!r) {
    box.append(el("h2", { class: "ask", text: "Nothing waits for you." }));
    const busy = rows().filter((x) => colOf(x) === "works").length;
    if (busy) box.append(el("p", { class: "ctx", text: busy === 1 ? "One session works now." : busy + " sessions work now." }));
    return;
  }
  const who = el("p", { class: "who" });
  who.append(sprite(r.id, 4, false, false), r.title, el("span", { class: "since", text: "since " + when(r.since) }));
  box.append(who, el("h2", { class: "ask", text: r.question }));
  if (r.context && r.context !== r.question) box.append(el("p", { class: "ctx", text: r.context }));
  const acts = el("div", { class: "acts" });
  if (openId !== r.id) {
    (r.options || []).slice(0, 9).forEach((label, n) => {
      const entry = { key: String(n + 1), run: () => { drafts[r.id] = label; openPanel(r.id); } };
      menu.push(entry);
      const btn = el("button", { type: "button", class: "pick px" });
      btn.append(el("span", { class: "k", text: entry.key }), label.replace(/^\d+\.\s+/, ""));
      btn.onclick = entry.run;
      acts.append(btn);
    });
    menu.push({ key: "C", run: () => openPanel(r.id) });
    acts.append(iconButton("chat", "Open the chat", () => openPanel(r.id), true));
  }
  if (waiting().length > 1) {
    menu.push({ key: "N", run: nextQuestion });
    acts.append(iconButton("next", "Next question", nextQuestion, true));
  }
  box.append(acts);
}

/* ---------- board ---------- */

async function setDone(r: Row, done: boolean): Promise<void> {
  try { await call("/api/done", { id: r.id, done }); } catch (e) { flash((e as Error).message); }
  loadBoard(true);
}

function item(r: Row, current: boolean): HTMLElement {
  const col = colOf(r);
  const cls = "item" + (col === "waits" ? " px" : "") + (r.id === openId ? " sel" : "") + (current ? " cur" : "");
  const node = el("div", { class: cls, tabindex: "0", role: "button", draggable: "true" });
  node.append(sprite(r.id, col === "waits" ? 4 : 3, col === "works", isNew(r)));
  const text = el("div");
  text.append(el("div", { class: "t", text: r.title }));
  if (col === "waits" && r.question && !current) text.append(el("div", { class: "q", text: r.question }));
  else if ((col === "works" || col === "quiet") && r.context) text.append(el("div", { class: "c", text: r.context }));
  const meta = el("div", { class: "m" });
  meta.append(current ? "shown above" : (col === "waits" ? "since " : "") + when(r.since));
  if (col === "quiet" && r.note) meta.append(" · " + r.note);
  if (r.message) {
    const failed = r.message.status === "failed";
    meta.append(" · ", el("b", { class: failed ? "bad" : "", text: failed ? "message not sent" : "message " + r.message.status }));
  }
  text.append(meta);
  node.append(text);
  node.onclick = () => openPanel(r.id);
  node.onkeydown = (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); openPanel(r.id); }
  };
  node.ondragstart = (e) => {
    dragging = r.id;
    node.classList.add("drag");
    e.dataTransfer?.setData("text/plain", r.id);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
  };
  node.ondragend = () => {
    dragging = null;
    node.classList.remove("drag");
    document.querySelectorAll(".col.over").forEach((c) => c.classList.remove("over"));
  };
  return node;
}

function renderBoard(): void {
  const board = $("board");
  const scroll = board.scrollLeft;
  const current = focusRow();
  board.textContent = "";
  for (const [key, name] of COLS) {
    const list = rows().filter((r) => colOf(r) === key);
    const col = el("section", { class: "col " + key });
    const title = el("h2", { text: name });
    title.append(el("span", { text: String(list.length) }));
    col.append(title);
    list.forEach((r) => col.append(item(r, current !== null && r.id === current.id)));
    if (!list.length) col.append(el("div", { class: "none", text: key === "done" ? "Drag a session here." : "None" }));
    col.ondragover = (e) => { if (dragging) { e.preventDefault(); col.classList.add("over"); } };
    col.ondragleave = () => col.classList.remove("over");
    col.ondrop = (e) => {
      e.preventDefault();
      col.classList.remove("over");
      const r = rowOf(dragging);
      dragging = null;
      if (!r) return;
      if (key === "done" && !r.done) setDone(r, true);
      else if (key !== "done" && r.done) setDone(r, false);
      else if (key !== colOf(r)) flash("A session moves by itself when its state changes. Only Done is yours.");
    };
    board.append(col);
  }
  board.scrollLeft = scroll;
}

async function loadBoard(force: boolean): Promise<void> {
  try {
    state = await call<BoardState>("/api/state");
  } catch {
    $("now").textContent = "The board server does not answer. Start it again.";
    boardSig = "";
    return;
  }
  if (pageStamp === null) pageStamp = state.page;
  const typing = Object.values(drafts).some((d) => d && d.trim()) || document.getElementById("titleedit") !== null;
  if (state.page !== pageStamp && !typing) { location.reload(); return; }
  if (JSON.stringify(state.config) !== JSON.stringify(config) && !document.getElementById("titleedit")) applyConfig(state.config);
  head();
  const sig = JSON.stringify([state.rows, openId, focusId, state.rows.map(isNew)]);
  if (!force && (sig === boardSig || dragging)) return;
  boardSig = sig;
  renderNow();
  renderBoard();
  drawScene();
  const r = rowOf(openId);
  if (r) { panelHead(r); fillOptions(r); markSeen(r); }
}

/* ---------- chat panel ---------- */

function panelHead(r: Row): void {
  const col = colOf(r);
  $("ptitle").textContent = r.title;
  $("pmeta").textContent = COLS.find((c) => c[0] === col)![1] + " · " + (col === "waits" ? "since " : "") + when(r.since);
  const full = document.body.classList.contains("full");
  const tools = $("ptools");
  tools.textContent = "";
  if (r.link) tools.append(iconButton("out", "Open in Claude", null, false, r.link));
  tools.append(iconButton(r.done ? "undo" : "done", r.done ? "Reopen" : "Mark done", () => setDone(r, !r.done)));
  tools.append(iconButton(full ? "side" : "full", full ? "Side panel (F)" : "Full screen (F)", toggleFull));
  tools.append(iconButton("close", "Close (Esc)", closePanel));
}

function toggleFull(): void {
  const full = document.body.classList.toggle("full");
  try { localStorage.setItem("chatFull", full ? "1" : ""); } catch { /* private mode */ }
  const r = rowOf(openId);
  if (r) panelHead(r);
  drawScene();
}

function pick(text: string): void {
  if (!ui) return;
  ui.ta.value = text;
  ui.ta.dispatchEvent(new Event("input"));
  ui.ta.focus();
}

function pressOptions(): void {
  if (!ui) return;
  const value = ui.ta.value;
  [...ui.opts.children].forEach((b) => b.setAttribute("aria-pressed", String(b.textContent === value)));
}

function fillOptions(r: Row): void {
  if (!ui || ui.id !== r.id) return;
  const labels = colOf(r) === "waits" ? r.options || [] : [];
  if (JSON.stringify(labels) === ui.labels) return;
  const box = ui;
  box.labels = JSON.stringify(labels);
  box.opts.textContent = "";
  box.opts.hidden = !labels.length;
  labels.forEach((label) => {
    const btn = el("button", { type: "button", class: "px", text: label });
    btn.onclick = () => pick(box.ta.value === label ? "" : label);
    box.opts.append(btn);
  });
  pressOptions();
}

function buildComposer(r: Row): void {
  const box = $("composer");
  box.textContent = "";
  ui = null;
  if (!r.can_message) {
    box.append(el("div", { class: "none", text: "A terminal session takes no message from the board." }));
    return;
  }
  const opts = el("div", { class: "opts" });
  const ta = el("textarea", { placeholder: "Write a message. Enter sends it.", "aria-label": "Message to " + r.title });
  const err = el("div", { class: "err" });
  err.hidden = true;
  const send = el("button", { type: "button", class: "send", text: "Send" });
  const row = el("div", { class: "sendrow px" });
  row.append(ta, send);
  box.append(opts, row, err);
  ui = { id: r.id, opts, ta, err, labels: null };
  ta.value = drafts[r.id] || "";
  ta.oninput = () => {
    drafts[r.id] = ta.value;
    err.hidden = true;
    ta.style.height = "38px";
    ta.style.height = Math.min(ta.scrollHeight, 180) + "px";
    pressOptions();
  };
  ta.onkeydown = (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); if (!e.repeat) sendMessage(); }
  };
  send.onclick = sendMessage;
  fillOptions(r);
  ta.dispatchEvent(new Event("input"));
}

async function sendMessage(): Promise<void> {
  const r = rowOf(openId);
  if (!ui || !r || sending) return;
  const box = ui, text = box.ta.value.trim();
  if (!text) {
    box.err.textContent = "Write a message first";
    box.err.hidden = false;
    return;
  }
  // A second Enter before the answer comes back must not queue the message again.
  sending = true;
  try {
    await call("/api/answer", { session_id: r.id, title: r.title, text });
    box.ta.value = "";
    box.ta.dispatchEvent(new Event("input"));
  } catch (e) {
    box.err.textContent = (e as Error).message;
    box.err.hidden = false;
    return;
  } finally {
    sending = false;
  }
  loadThread(true);
  loadBoard(true);
}

function sendState(o: { id: string; status: string; note: string }): HTMLElement {
  const span = el("span");
  const act = (path: string) => async () => {
    try { await call(path, { id: o.id }); } catch (e) { flash((e as Error).message); }
    loadThread(true);
    loadBoard(true);
  };
  const plain = (text: string, onclick: () => void) => {
    const btn = el("button", { type: "button", class: "link", text });
    btn.onclick = onclick;
    return btn;
  };
  if (o.status === "queued") span.append("queued · ", plain("cancel", act("/api/cancel")));
  else if (o.status === "sending") span.append("sending");
  else if (o.status === "sent") span.append("sent, not read yet");
  else span.append(el("b", { class: "err", text: "not sent" }), o.note ? " · " + o.note + " · " : " · ", plain("send again", act("/api/retry")));
  return span;
}

function openSession(id: string): void {
  if (rowOf(id)) openPanel(id);
  else flash("That session is not on the board.");
}

/* `ask` marks the reply that waits for an answer: it gets the frame, and its numbered list becomes buttons. */
function message(m: ChatMessage, ask: boolean): HTMLElement {
  if (m.role === "step") return el("div", { class: "step", text: "· " + m.text.split("\n")[0].replace(/[*`#]/g, "") });
  const node = el("div", { class: "msg " + m.role + (ask ? " ask px" : "") });
  const who = el("div", { class: "who" });
  const name = m.role === "you" ? "You" : m.role === "peer" ? m.name || "Another session" : "Claude";
  if (m.role === "claude" && openId) who.append(sprite(openId, 3, false, false));
  who.append(el("b", { text: name }), "· " + when(m.ts));
  if (m.outbox) who.append("· ", sendState(m.outbox));
  const body = md(m.text, openSession);
  if (m.role === "you") body.classList.add("px");
  if (ask) {
    const lists = body.querySelectorAll("ol");
    const last = lists[lists.length - 1];
    if (last && last.children.length > 1 && !last.nextElementSibling) {
      last.classList.add("choices");
      [...last.children].forEach((li, n) => {
        const text = n + 1 + ". " + (li.textContent || "").trim().slice(0, 300);
        li.prepend(el("span", { class: "n", text: String(n + 1) }));
        li.classList.add("px");
        li.setAttribute("role", "button");
        li.setAttribute("tabindex", "0");
        (li as HTMLElement).onclick = () => pick(text);
        (li as HTMLElement).onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(text); } };
      });
    }
  }
  node.append(who, body);
  return node;
}

async function loadThread(force: boolean): Promise<void> {
  if (!openId) return;
  const id = openId;
  let data: { messages: ChatMessage[] };
  try { data = await call("/api/thread?id=" + encodeURIComponent(id)); } catch { return; }
  if (id !== openId) return;
  const r = rowOf(id);
  const working = r !== undefined && r.state === "works";
  const sig = JSON.stringify([data.messages, working]);
  if (!force && sig === threadSig) return;
  const sameThread = threadSig !== "";
  threadSig = sig;
  const box = $("thread");
  const stick = force || box.scrollHeight - box.scrollTop - box.clientHeight < 140;
  box.textContent = "";
  if (!data.messages.length) box.append(el("div", { class: "none", text: "No message to show." }));
  const lastAt = data.messages.length - 1;
  const asks = r !== undefined && colOf(r) === "waits" && lastAt >= 0 && data.messages[lastAt].role === "claude";
  data.messages.forEach((m, n) => {
    const node = message(m, asks && n === lastAt);
    if (sameThread && n >= threadCount) node.classList.add("fresh");
    box.append(node);
  });
  threadCount = data.messages.length;
  // When the reply's own list already shows the choices as buttons, do not show them twice.
  if (ui && r) ui.opts.style.display = r.options_from === "text" && box.querySelector(".choices") ? "none" : "";
  if (working) {
    const typing = el("div", { class: "typing" });
    typing.append(sprite(id, 3, true, false), "Claude works");
    box.append(typing);
  }
  if (stick) box.scrollTop = box.scrollHeight;
}

function openPanel(id: string): void {
  const r = rowOf(id);
  if (!r) return;
  openId = id;
  if (colOf(r) === "waits") focusId = id;
  threadSig = "";
  threadCount = 0;
  markSeen(r);
  document.body.classList.add("peek");
  $("panel").inert = false;
  $("thread").textContent = "";
  panelHead(r);
  buildComposer(r);
  renderNow();
  renderBoard();
  drawScene();
  loadThread(true);
  if (ui) (ui as Composer).ta.focus({ preventScroll: true });
}

function closePanel(): void {
  openId = null;
  ui = null;
  document.body.classList.remove("peek");
  $("panel").inert = true;
  renderNow();
  renderBoard();
}

/* ---------- theme and wallpaper ---------- */

const root = document.documentElement;

/* The wallpaper tile: 80 by 80 cells, shown at 4px a cell. Plus signs, dashes and dots at fixed places. */
function wallpaper(night: boolean): void {
  const tile = el("canvas", { width: "80", height: "80" });
  const ctx = tile.getContext("2d")!;
  const rnd = seeded(77);
  const tones = night ? ["#1a1e1e", "#212626"] : ["#ebebeb", "#e2e2e2"];
  for (let i = 0; i < 22; i++) {
    const x = 2 + Math.floor(rnd() * 76), y = 2 + Math.floor(rnd() * 76), kind = rnd();
    ctx.fillStyle = tones[i % 2];
    if (kind < 0.35) { ctx.fillRect(x, y - 1, 1, 3); ctx.fillRect(x - 1, y, 3, 1); }
    else if (kind < 0.6) ctx.fillRect(x, y, 2, 1);
    else ctx.fillRect(x, y, 1, 1);
  }
  root.style.setProperty("--wall", "url(" + tile.toDataURL() + ")");
}

function setTheme(name: string, keep = true): void {
  if (name === "night") root.dataset.theme = "night";
  else delete root.dataset.theme;
  wallpaper(name === "night");
  // The button shows the theme you switch to: a sun for paper, a moon for night.
  const label = name === "night" ? "Switch to the paper theme" : "Switch to the night theme";
  $("theme").replaceChildren(icon(name === "night" ? "sun" : "moon"));
  $("theme").title = label;
  $("theme").setAttribute("aria-label", label);
  if (!keep) return;
  try { localStorage.setItem("theme", name); } catch { /* private mode */ }
}

/* ---------- start ---------- */

let savedTheme: string | null = null;
try {
  savedTheme = localStorage.getItem("theme");
  if (localStorage.getItem("chatFull")) document.body.classList.add("full");
} catch { /* private mode */ }
if (TRY.get("theme")) setTheme(TRY.get("theme") === "night" ? "night" : "paper", false);
else setTheme(savedTheme || (matchMedia("(prefers-color-scheme: dark)").matches ? "night" : "paper"));
if (TRY.has("full")) document.body.classList.add("full");
$("theme").onclick = () => setTheme(root.dataset.theme === "night" ? "paper" : "night");
$("panel").inert = true;

addEventListener("keydown", (e) => {
  const at = document.activeElement;
  const typing = at !== null && ["TEXTAREA", "INPUT"].includes(at.tagName);
  if (e.key === "Escape" && openId) { closePanel(); return; }
  if (typing || !state || e.metaKey || e.ctrlKey || e.altKey) return;
  const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
  if (key === "F" && openId) { e.preventDefault(); toggleFull(); return; }
  const entry = menu.find((x) => x.key === key);
  if (entry) { e.preventDefault(); entry.run(); }
});
addEventListener("focus", () => { loadBoard(false); loadThread(false); });

const resized = new ResizeObserver(() => drawScene());
resized.observe($("scene"));
resized.observe($("pscene"));
applyConfig(config);
setInterval(tick, 20000);
setInterval(animate, CALM ? 60000 : 250);
loadBoard(true).then(() => {
  // ?open=2 opens the chat of the second session that waits
  const wanted = waiting()[Number(TRY.get("open")) - 1];
  if (wanted) openPanel(wanted.id);
});
setInterval(() => loadBoard(false), 5000);
setInterval(() => loadThread(false), 3000);
