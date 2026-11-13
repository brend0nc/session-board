#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import os from "node:os";
import readline from "node:readline/promises";
import { CONFIG_FILE, configExists, DEFAULTS, loadConfig, saveConfig, systemTimeZone } from "./config.js";
import { relayLink, relayPrompt, show, wait } from "./relay.js";
import { serve } from "./server.js";
import { readOutbox, setMessage, Status } from "./store.js";

const HELP = `session-board: one local page for your Claude Code desktop sessions.

  session-board init [--yes]            name the board and write the settings
  session-board                         run the page on 127.0.0.1
  session-board relay                   open a Claude session with the relay prompt in its box
  session-board relay-prompt            print that prompt, to paste it by hand
  session-board wait --relay ID         block until a message is queued, claim it, print it, exit
  session-board pending                 print the queued messages
  session-board mark ID STATUS [NOTE]   set a message to sent or failed

Settings: ${CONFIG_FILE}`;

/** Let the system open the Claude desktop app at a new Code session. Only the macOS way is tested. */
function openRelay(): boolean {
  const url = relayLink();
  const run = process.platform === "darwin" ? spawnSync("open", [url])
    : process.platform === "win32" ? spawnSync("rundll32", ["url.dll,FileProtocolHandler", url])
    : spawnSync("xdg-open", [url]);
  if (run.status === 0) {
    console.log("Claude opens a new session with the relay prompt in its box. Press Enter there to start the relay.");
    return true;
  }
  console.log("I could not open the Claude app. Start a new session by hand and paste the prompt from:  session-board relay-prompt");
  return false;
}

/** Ask for the three things that the computer cannot know. Time zone and place come by themselves. */
async function init(useDefaults: boolean): Promise<void> {
  const current = loadConfig();
  const answers = { title: current.title, name: current.name || os.userInfo().username, project: current.project };
  let startRelay = false;
  if (!useDefaults && process.stdin.isTTY) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ask = async (question: string, fallback: string) =>
      (await rl.question(question + (fallback ? " [" + fallback + "]" : "") + ": ")).trim() || fallback;
    answers.title = await ask("Name of your board", answers.title || DEFAULTS.title);
    answers.name = await ask("Your name, shown to a session with each message", answers.name);
    answers.project = await ask("Show one project only? Give part of its folder name, or leave empty for all", answers.project);
    startRelay = !/^n/i.test(await ask("Open a Claude session for the relay now? (y/n)", "y"));
    rl.close();
  }
  saveConfig(answers);
  const zone = current.time_zone || systemTimeZone();
  console.log("\nSettings are in " + CONFIG_FILE);
  console.log("Time zone: " + (zone || "not found") + (current.time_zone ? "" : " (from this computer)"));
  console.log("Place: the page asks for your location one time, to find the mountain of your region.\n");
  if (startRelay) openRelay();
  console.log("Next:");
  console.log("  1. Start the board:   session-board");
  if (!startRelay) console.log("  2. Start the relay:   session-board relay");
}

async function main(argv: string[]): Promise<number> {
  const cmd = argv[0] || "serve";
  if (cmd === "init") {
    await init(argv.includes("--yes"));
  } else if (cmd === "serve") {
    if (!configExists()) {
      saveConfig({ title: DEFAULTS.title, name: os.userInfo().username });
      console.log("First start. I made " + CONFIG_FILE + ". Run `session-board init` to name your board.");
    }
    serve();
    return -1;
  } else if (cmd === "relay") {
    return openRelay() ? 0 : 1;
  } else if (cmd === "relay-prompt") {
    console.log(relayPrompt());
  } else if (cmd === "wait") {
    await wait(argv[1] === "--relay" ? argv[2] || "" : "");
  } else if (cmd === "pending") {
    show(readOutbox().filter((it) => it.status === "queued"));
  } else if (cmd === "mark" && argv.length >= 3) {
    if (argv[2] !== "sent" && argv[2] !== "failed") {
      console.log("The status must be `sent` or `failed`.");
      return 2;
    }
    const hit = setMessage(argv[1], argv[2] as Status, argv.slice(3).join(" "));
    console.log(hit ? "ok" : "no such message");
  } else {
    console.log(HELP);
    return cmd === "help" || cmd === "--help" || cmd === "-h" ? 0 : 2;
  }
  return 0;
}

// The process ends by itself when the work is done. A forced exit can cut the output
// when it goes to a pipe, and the relay reads its messages from that output.
main(process.argv.slice(2)).then((code) => {
  if (code >= 0) process.exitCode = code;
}).catch((err: Error) => {
  console.error(err.message);
  process.exitCode = 1;
});
