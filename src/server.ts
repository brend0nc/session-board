import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Config, loadConfig, pageConfig, saveConfig } from "./config.js";
import { relayLink } from "./relay.js";
import { Board, SESSION_ID, STALE_CLAIM, TERMINAL_ID } from "./sessions.js";
import { addMessage, loadToken, now, setDone, setMessage } from "./store.js";

const WEB = path.join(path.dirname(fileURLToPath(import.meta.url)), "web");
const MAX_TEXT = 4000;
const TYPES: Record<string, string> = { ".js": "text/javascript", ".css": "text/css", ".html": "text/html" };

function send(res: http.ServerResponse, code: number, body: unknown, type = "application/json"): void {
  const data = typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(code, {
    "Content-Type": type + "; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(data);
}

function readBody(req: http.IncomingMessage): Promise<Record<string, unknown> | null> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size <= 65536) chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        const found = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
        resolve(found && typeof found === "object" && !Array.isArray(found) ? found : null);
      } catch {
        resolve(null);
      }
    });
    req.on("error", () => resolve(null));
  });
}

/** The settings that the page may change: the board's name and the place. */
function configPatch(body: Record<string, unknown>): Partial<Config> | string {
  const patch: Partial<Config> = {};
  if (body.title !== undefined) {
    const title = String(body.title).trim().slice(0, 60);
    if (!title) return "Give the board a name";
    patch.title = title;
  }
  if (body.lat !== undefined || body.lon !== undefined) {
    const lat = Number(body.lat), lon = Number(body.lon);
    if (!(Math.abs(lat) <= 90) || !(Math.abs(lon) <= 180)) return "That is not a place";
    patch.lat = Math.round(lat * 100) / 100;
    patch.lon = Math.round(lon * 100) / 100;
  }
  if (body.city !== undefined) patch.city = String(body.city).trim().slice(0, 60);
  if (body.skyline !== undefined) patch.skyline = String(body.skyline).trim().slice(0, 40) || "auto";
  return patch;
}

export function serve(): void {
  let config = loadConfig();
  const token = loadToken();
  const hosts = new Set(["127.0.0.1:" + config.port, "localhost:" + config.port]);
  const board = new Board(() => config, WEB);

  const server = http.createServer(async (req, res) => {
    try {
      if (!hosts.has(req.headers.host || "")) return send(res, 403, { error: "wrong host" });
      const url = new URL(req.url || "/", "http://127.0.0.1");

      if (req.method === "GET") {
        if (url.pathname === "/") {
          const boot = JSON.stringify({ token, config: pageConfig(config), relayLink: relayLink() }).replace(/</g, "\\u003c");
          const page = fs.readFileSync(path.join(WEB, "index.html"), "utf8").replace("__BOOT__", () => boot);
          return send(res, 200, page, "text/html");
        }
        if (url.pathname === "/api/state") return send(res, 200, board.state());
        if (url.pathname === "/api/thread") {
          const id = url.searchParams.get("id") || "";
          if (!SESSION_ID.test(id) && !TERMINAL_ID.test(id)) return send(res, 400, { error: "unknown session" });
          return send(res, 200, board.thread(id));
        }
        if (/^\/[a-z-]+\.(js|css)$/.test(url.pathname)) {
          const file = path.join(WEB, url.pathname.slice(1));
          if (fs.existsSync(file)) return send(res, 200, fs.readFileSync(file), TYPES[path.extname(file)]);
        }
        return send(res, 404, { error: "not found" });
      }

      if (req.method !== "POST") return send(res, 405, { error: "not allowed" });
      if (req.headers["x-board-token"] !== token) return send(res, 403, { error: "Reload the page" });
      if (!String(req.headers["content-type"] || "").startsWith("application/json")) return send(res, 415, { error: "json only" });
      const body = await readBody(req);
      if (!body) return send(res, 400, { error: "bad json" });
      const id = String(body.id || "");

      if (url.pathname === "/api/answer") {
        const sid = String(body.session_id || ""), text = String(body.text || "").trim();
        if (!SESSION_ID.test(sid)) return send(res, 400, { error: "This session takes no messages" });
        if (!text) return send(res, 400, { error: "Write a message first" });
        if (text.length > MAX_TEXT) return send(res, 400, { error: "The message is too long" });
        return send(res, 200, addMessage(sid, String(body.title || "").slice(0, 200), text));
      }
      if (url.pathname === "/api/cancel") {
        const hit = setMessage(id, "cancelled", "", (it) => it.status === "queued");
        return send(res, hit ? 200 : 409, hit || { error: "Already sent" });
      }
      if (url.pathname === "/api/retry") {
        const at = now();
        const hit = setMessage(id, "queued", "", (it) =>
          it.status === "failed" || (it.status === "sending" && at - (it.claim_ts || at) > STALE_CLAIM));
        return send(res, hit ? 200 : 409, hit || { error: "Nothing to send again" });
      }
      if (url.pathname === "/api/done") {
        if (!SESSION_ID.test(id) && !TERMINAL_ID.test(id)) return send(res, 400, { error: "unknown session" });
        setDone(id, Boolean(body.done));
        return send(res, 200, { ok: true });
      }
      if (url.pathname === "/api/config") {
        const patch = configPatch(body);
        if (typeof patch === "string") return send(res, 400, { error: patch });
        try {
          saveConfig(patch);
          config = loadConfig();
        } catch (err) {
          return send(res, 400, { error: (err as Error).message });
        }
        return send(res, 200, pageConfig(config));
      }
      return send(res, 404, { error: "not found" });
    } catch (err) {
      console.error(err);
      send(res, 500, { error: "The board had an error. See its terminal." });
    }
  });

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") console.log("The board already runs. Open http://127.0.0.1:" + config.port);
    else console.error(err.message);
    process.exitCode = err.code === "EADDRINUSE" ? 0 : 1;
  });
  server.listen(config.port, "127.0.0.1", () => {
    console.log(config.title + ": http://127.0.0.1:" + config.port + "  (project: " + (config.project || "all") + ")");
  });
}
