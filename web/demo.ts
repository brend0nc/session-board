/* Sample boards, to try the page with no Claude session: add ?demo=webdev (or research, founder) to the address.
   In a demo the page talks to this file in place of the server, so nothing is read and nothing is sent. */
import { BoardState, ChatMessage, PageConfig, Row } from "./util.js";

interface Seed {
  title: string;
  state: Row["state"];
  /** Minutes since the session last did something. */
  ago: number;
  question?: string;
  context?: string;
  options?: string[];
  note?: string;
  done?: boolean;
  terminal?: boolean;
  chat?: ["you" | "claude", string][];
}

interface DemoSet {
  title: string;
  project: string;
  sessions: Seed[];
}

const SETS: Record<string, DemoSet> = {
  webdev: {
    title: "Ship room",
    project: "shop-frontend",
    sessions: [
      {
        title: "Database migration: orders table", state: "waits", ago: 6,
        question: "The migration locks the orders table for about 40 seconds. When do I run it?",
        context: "The plan is ready and the dry run passed on a copy of production. Nothing has run on the real database.",
        options: ["1. Tonight at 02:00, when traffic is lowest.", "2. Now.", "3. Split it into two smaller steps first."],
        chat: [
          ["you", "Plan the migration for the orders table. Do not run it."],
          ["claude", "**The plan is ready. Nothing has run.**\n\n---\n\n**What it does**\n\n| Step | Change | Lock |\n|---|---|---|\n| 1 | Add `shipping_region` column | none |\n| 2 | Backfill 1.2 million rows | none |\n| 3 | Add the index | about 40 s |\n\n---\n\n**What I checked**\n\n- The dry run passed on a copy of production.\n- The rollback script restores the old table in under a minute.\n\n---\n\n**Next step**\n\n1. Tonight at 02:00, when traffic is lowest.\n2. Now.\n3. Split it into two smaller steps first."],
        ],
      },
      {
        title: "Checkout bug #482", state: "waits", ago: 31,
        question: "The fix works in my test. Do I open the pull request?",
        context: "The total was wrong when a coupon and free shipping met. One line in `cart.ts` and two new tests.",
        options: ["Yes, open it", "Run the full suite first"],
      },
      { title: "Dark mode for the settings page", state: "works", ago: 2, context: "On: make the toggles match the new colour tokens" },
      { title: "API rate limiter", state: "works", ago: 4, context: "On: add the limit per account, then load test it" },
      { title: "Flaky test hunt", state: "works", ago: 9, context: "On: run the cart tests 200 times and list the ones that fail" },
      { title: "Dependency upgrades", state: "quiet", ago: 55, context: "12 packages updated; 1 major version needs your look", note: "review ready" },
      { title: "Image compression script", state: "quiet", ago: 140, context: "all product images are 38% smaller; originals kept", note: "completed" },
      { title: "Deploy guide", state: "quiet", ago: 300, context: "first draft in docs/deploy.md", note: "completed" },
      { title: "Release notes 2.4", state: "quiet", ago: 20, context: "The notes are written. They list 14 changes.", terminal: true },
      { title: "Favicon set", state: "quiet", ago: 1500, done: true },
      { title: "Login page copy", state: "quiet", ago: 2900, done: true },
    ],
  },
  research: {
    title: "Lab bench",
    project: "probe-study",
    sessions: [
      {
        title: "Run 14: learning-rate sweep", state: "waits", ago: 4,
        question: "The sweep is done. Do I start the long run with 3e-4?",
        context: "Three of five settings converge. 3e-4 gives the lowest loss at step 2,000. The long run costs about $12.",
        options: ["Yes, start it", "Show the curves first"],
        chat: [
          ["you", "Run the sweep over five learning rates, 2,000 steps each. Stop there."],
          ["claude", "**The sweep is done. The long run has not started.**\n\n---\n\n**Loss at step 2,000**\n\n| Learning rate | Loss | Verdict |\n|---|---|---|\n| 1e-3 | diverged | no |\n| 6e-4 | 2.41 | unstable |\n| 3e-4 | 1.87 | best |\n| 1e-4 | 2.02 | stable |\n| 3e-5 | 2.60 | too slow |\n\n---\n\n**Cost**\n\nThe long run is 40,000 steps. It costs about $12 on one GPU.\n\n---\n\n**Next step**\n\nDo I start the long run with 3e-4?"],
        ],
      },
      {
        title: "Reply to reviewer 2", state: "waits", ago: 48,
        question: "Which reply do you want for the baseline comment?",
        context: "The reviewer asks for a linear baseline. We have the numbers, but they are not in the paper.",
        options: ["1. Add the baseline to the main table.", "2. Explain why it does not apply.", "3. Do both, with the baseline in the appendix."],
      },
      {
        title: "Figure 3 redraw", state: "waits", ago: 95,
        question: "Is the new colour scale clear?",
        context: "The old figure hid the small effects. The new one uses one colour from light to dark.",
        options: ["Clear, keep it", "Try a log scale"],
      },
      { title: "Ablation: remove layer 9", state: "works", ago: 3, context: "On: run the ablation on all 12 heads and plot the drop" },
      { title: "Dataset cleanup", state: "works", ago: 12, context: "On: drop the duplicate rows and write a short report" },
      { title: "Related work search", state: "quiet", ago: 70, context: "found 14 papers; 3 are close to ours", note: "review ready" },
      { title: "Unit tests for the loader", state: "quiet", ago: 180, context: "all 41 tests pass", note: "completed" },
      { title: "Weekly notes", state: "quiet", ago: 400, context: "notes for week 46 are written", note: "completed" },
      { title: "Environment setup", state: "quiet", ago: 4000, done: true },
    ],
  },
  founder: {
    title: "Night shift",
    project: "newsletter",
    sessions: [
      {
        title: "Launch post", state: "waits", ago: 9,
        question: "Which title do you want for the launch post?",
        context: "The post is 620 words. Both titles fit the preview width of the mail clients I checked.",
        options: ["1. The short title: \"We are live\".", "2. The long title: \"Six months, one small tool, and what we learned\"."],
        chat: [
          ["you", "Write the launch post from my notes. Keep my voice. Give me two titles."],
          ["claude", "**The draft is ready. It is 620 words.**\n\n---\n\n**What is in it**\n\n- Why you built it, in your own words from the notes.\n- Three things that went wrong, with what you changed.\n- One clear ask at the end: reply with a use case.\n\n---\n\n**What I left out**\n\nThe pricing part. You said it is not final.\n\n---\n\n**Next step**\n\n1. The short title: \"We are live\".\n2. The long title: \"Six months, one small tool, and what we learned\"."],
        ],
      },
      { title: "Pricing page", state: "waits", ago: 130, question: "Do I show the yearly price first?", context: "Two layouts are ready. Nothing is published.", options: ["Yearly first", "Monthly first"] },
      { title: "Customer interview notes", state: "works", ago: 5, context: "On: group the 11 interviews by the problem they name" },
      { title: "Invoice reminders", state: "quiet", ago: 60, context: "3 reminders drafted, none sent", note: "review ready" },
      { title: "Landing page speed", state: "quiet", ago: 220, context: "the page loads in 1.1 s, down from 2.9 s", note: "completed" },
      { title: "Support inbox summary", state: "quiet", ago: 600, context: "42 mails read; 5 need your answer", note: "review ready" },
      { title: "Logo export", state: "quiet", ago: 3000, done: true },
    ],
  },
};

export class Demo {
  readonly project: string;
  private rows: Row[] = [];
  private threads = new Map<string, ChatMessage[]>();
  private config: PageConfig;
  /** Seconds between the real time and the time that the page shows. */
  private shift = 0;

  private now(): number {
    return Date.now() / 1000 + this.shift;
  }

  constructor(set: DemoSet, base: PageConfig, clock: string | null) {
    if (clock && /^\d\d:\d\d$/.test(clock)) {
      const shown = new Date();
      shown.setHours(Number(clock.slice(0, 2)), Number(clock.slice(3)), 0, 0);
      this.shift = shown.getTime() / 1000 - Date.now() / 1000;
    }
    const now = this.now();
    this.project = set.project;
    this.config = { ...base, title: set.title, city: "", lat: base.lat ?? 0, lon: base.lon ?? 0 };
    set.sessions.forEach((s, n) => {
      const hex = ((n + 3) * 2654435761 >>> 0).toString(16).padStart(8, "0");
      const id = s.terminal ? "terminal_" + hex : "local_" + hex + "-0000-4000-8000-" + hex + hex.slice(0, 4);
      const since = now - s.ago * 60;
      this.rows.push({
        id, title: s.title + (s.terminal ? " (terminal)" : ""), link: "", can_message: !s.terminal,
        question: s.question || "", context: s.context || "", options: s.options || [],
        options_from: s.options && /^1\. /.test(s.options[0]) ? "text" : "wrap",
        note: s.note || "", state: s.state, since, done: Boolean(s.done),
      });
      const chat = s.chat || [["you", "Start on this, and tell me when you need me."], ["claude", s.question || s.context || "Done."]];
      this.threads.set(id, chat.map(([role, text], i) => ({ role, text, ts: since - (chat.length - 1 - i) * 240 }) as ChatMessage));
    });
  }

  settings(): PageConfig {
    return this.config;
  }

  /** The same calls as the server answers, on the sample data. */
  async call<T>(path: string, body?: Record<string, unknown>): Promise<T> {
    const now = this.now();
    if (path === "/api/state") {
      const state: BoardState = {
        now, project: this.project, rows: [...this.rows].sort((a, b) => b.since - a.since), page: 1,
        relay: { on: true, session: "" }, config: this.config,
      };
      return state as T;
    }
    if (path.startsWith("/api/thread")) {
      const id = decodeURIComponent(path.split("id=")[1] || "");
      return { id, messages: this.threads.get(id) || [] } as T;
    }
    const row = this.rows.find((r) => r.id === (body?.session_id || body?.id));
    if (path === "/api/answer" && row) {
      // The sample session takes the answer and starts to work.
      const text = String(body?.text || "");
      this.threads.get(row.id)?.push({ role: "you", ts: now, text });
      Object.assign(row, { state: "works", since: now, question: "", options: [], context: "On: " + text });
    } else if (path === "/api/done" && row) {
      row.done = Boolean(body?.done);
    } else if (path === "/api/config" && body) {
      for (const key of ["title", "city", "lat", "lon"] as const) {
        if (body[key] !== undefined) (this.config as unknown as Record<string, unknown>)[key] = body[key];
      }
      this.config = { ...this.config };
      return this.config as T;
    }
    return {} as T;
  }
}

export function demoFor(name: string | null, base: PageConfig, clock: string | null): Demo | null {
  return name && SETS[name] ? new Demo(SETS[name], base, clock) : null;
}
