/* Shared types and small helpers for the page. */

export interface PageConfig {
  title: string;
  city: string;
  time_zone: string;
  lat: number | null;
  lon: number | null;
  skyline: string;
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
  done: boolean;
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

export interface ChatMessage {
  role: "you" | "claude" | "peer" | "step";
  ts: number;
  text: string;
  name?: string;
  outbox?: { id: string; status: string; note: string };
}

declare global {
  interface Window {
    BOOT: { token: string; config: PageConfig; relayLink: string };
  }
}

export const BOOT = window.BOOT;
export const CALM = matchMedia("(prefers-reduced-motion: reduce)").matches;

export const $ = (id: string): HTMLElement => document.getElementById(id) as HTMLElement;

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "text") node.textContent = value;
    else if (key === "class") node.className = value;
    else node.setAttribute(key, value);
  }
  return node;
}

export function link(text: string, onclick: () => void): HTMLButtonElement {
  const node = el("button", { type: "button", class: "link", text });
  node.onclick = onclick;
  return node;
}

export function when(sec: number): string {
  const d = new Date(sec * 1000), today = new Date();
  const hm = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === today.toDateString()) return hm;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) + " " + hm;
}

export async function api<T>(path: string, body?: unknown): Promise<T> {
  const options: RequestInit = body === undefined ? {} : {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Board-Token": BOOT.token },
    body: JSON.stringify(body),
  };
  const res = await fetch(path, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || "Request failed");
  return data as T;
}

export function hash(text: string): number {
  let h = 2166136261;
  for (const ch of text) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A small repeatable random source: the same seed gives the same numbers. */
export function seeded(seed: number): () => number {
  let s = seed || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 10000) / 10000;
  };
}

export function flash(text: string): void {
  $("flash").textContent = "· " + text;
  setTimeout(() => { $("flash").textContent = ""; }, 4000);
}
