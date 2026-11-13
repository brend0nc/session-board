import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DATA } from "./config.js";

export type Status = "queued" | "sending" | "sent" | "failed" | "cancelled";

export interface Message {
  id: string;
  ts: number;
  session_id: string;
  title: string;
  text: string;
  status: Status;
  note: string;
  claim_ts?: number;
  done_ts?: number;
}

const OUTBOX = path.join(DATA, "outbox.jsonl");
const DONE = path.join(DATA, "done.json");
const BEAT = path.join(DATA, "relay.json");
const TOKEN = path.join(DATA, "token");
const LOCK = path.join(DATA, "lock.d");

export const now = (): number => Date.now() / 1000;

function pause(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** One writer at a time, for the page server and the relay. A folder is the lock: mkdir is atomic. */
export function withLock<T>(work: () => T): T {
  fs.mkdirSync(DATA, { recursive: true });
  for (let tries = 0; ; tries++) {
    try {
      fs.mkdirSync(LOCK);
      break;
    } catch {
      let stale = tries > 200;
      try {
        stale = stale || Date.now() - fs.statSync(LOCK).mtimeMs > 5000;
      } catch {
        continue;
      }
      if (stale) fs.rmSync(LOCK, { recursive: true, force: true });
      else pause(10);
    }
  }
  try {
    return work();
  } finally {
    fs.rmSync(LOCK, { recursive: true, force: true });
  }
}

export function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function writeAtomic(file: string, text: string): void {
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(file + ".tmp", text);
  fs.renameSync(file + ".tmp", file);
}

export function readOutbox(): Message[] {
  let raw = "";
  try {
    raw = fs.readFileSync(OUTBOX, "utf8");
  } catch {
    return [];
  }
  const items: Message[] = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      items.push(JSON.parse(line) as Message);
    } catch {
      continue;
    }
  }
  return items;
}

function writeOutbox(all: Message[]): void {
  const old = now() - 86400;
  const items = all.filter((it) => !((it.status === "sent" || it.status === "cancelled") && (it.done_ts || it.ts) < old));
  writeAtomic(OUTBOX, items.map((it) => JSON.stringify(it)).join("\n") + (items.length ? "\n" : ""));
}

export function addMessage(sessionId: string, title: string, text: string): Message {
  const item: Message = {
    id: crypto.randomBytes(4).toString("hex"),
    ts: now(),
    session_id: sessionId,
    title,
    text,
    status: "queued",
    note: "",
  };
  withLock(() => writeOutbox([...readOutbox(), item]));
  return item;
}

/** Change one message. `allowed` says if its present state permits the change. */
export function setMessage(id: string, status: Status, note = "", allowed?: (it: Message) => boolean): Message | null {
  return withLock(() => {
    const items = readOutbox();
    let hit: Message | null = null;
    for (const it of items) {
      if (it.id === id && (!allowed || allowed(it))) {
        it.status = status;
        it.note = note;
        it.done_ts = now();
        hit = it;
      }
    }
    if (hit) writeOutbox(items);
    return hit;
  });
}

/** Move queued messages to "sending", so two relays never send one message twice. */
export function claimQueued(): Message[] {
  return withLock(() => {
    const items = readOutbox();
    const taken = items.filter((it) => it.status === "queued");
    for (const it of taken) {
      it.status = "sending";
      it.claim_ts = now();
    }
    if (taken.length) writeOutbox(items);
    return taken;
  });
}

export function readDone(): Record<string, number> {
  return readJson<Record<string, number>>(DONE, {});
}

export function setDone(id: string, done: boolean): void {
  withLock(() => {
    const marks = readDone();
    if (done) marks[id] = now();
    else delete marks[id];
    writeAtomic(DONE, JSON.stringify(marks));
  });
}

export interface Beat {
  session: string;
  ts: number;
  pid: number;
}

export function readBeat(): Partial<Beat> {
  return readJson<Partial<Beat>>(BEAT, {});
}

/** `ahead` dates the heartbeat into the future: the relay is busy and will be back. */
export function writeBeat(session: string, ahead = 0): void {
  writeAtomic(BEAT, JSON.stringify({ session, ts: now() + ahead, pid: process.pid }));
}

/** The token that the page must send with each change. Made on first start. */
export function loadToken(): string {
  fs.mkdirSync(DATA, { recursive: true });
  try {
    const found = fs.readFileSync(TOKEN, "utf8").trim();
    if (found) return found;
  } catch {
    /* no token yet */
  }
  const token = crypto.randomBytes(18).toString("base64url");
  fs.writeFileSync(TOKEN, token, { mode: 0o600 });
  return token;
}
