import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface Config {
  title: string;
  project: string;
  name: string;
  city: string;
  time_zone: string;
  lat: number | null;
  lon: number | null;
  skyline: string;
  port: number;
  days: number;
  sessions_dir: string;
  transcripts_dir: string;
}

/** What the page may see and change. */
export type PageConfig = Pick<Config, "title" | "city" | "time_zone" | "lat" | "lon" | "skyline">;

export const HOME = process.env.BOARD_HOME || path.join(os.homedir(), ".session-board");
export const DATA = path.join(HOME, "data");
export const CONFIG_FILE = process.env.BOARD_CONFIG || path.join(HOME, "config.json");

/** Empty values mean "find it by yourself": time zone from the computer, city and skyline from the location. */
export const DEFAULTS: Config = {
  title: "Sessions",
  project: "",
  name: "",
  city: "",
  time_zone: "",
  lat: null,
  lon: null,
  skyline: "auto",
  port: 4748,
  days: 10,
  sessions_dir: "",
  transcripts_dir: "",
};

export function systemTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    return "";
  }
}

function readFile(): Partial<Config> {
  try {
    const found = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
    return found && typeof found === "object" ? found : {};
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw new Error("The settings file " + CONFIG_FILE + " has an error: " + (err as Error).message);
  }
}

export function configExists(): boolean {
  return fs.existsSync(CONFIG_FILE);
}

/** Defaults, then the config file, then BOARD_* environment variables. */
export function loadConfig(): Config {
  const config: Config = { ...DEFAULTS };
  const found = readFile() as Record<string, unknown>;
  for (const key of Object.keys(DEFAULTS) as (keyof Config)[]) {
    if (found[key] !== undefined) (config as unknown as Record<string, unknown>)[key] = found[key];
  }
  if (process.env.BOARD_PROJECT) config.project = process.env.BOARD_PROJECT;
  if (process.env.BOARD_PORT) config.port = Number(process.env.BOARD_PORT);
  if (process.env.BOARD_DAYS) config.days = Number(process.env.BOARD_DAYS);
  config.port = Number(config.port) || DEFAULTS.port;
  config.days = Number(config.days) || DEFAULTS.days;
  return config;
}

export function saveConfig(patch: Partial<Config>): void {
  fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
  const next = { ...readFile(), ...patch };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(next, null, 2) + "\n");
}

export function pageConfig(config: Config): PageConfig {
  return {
    title: config.title,
    city: config.city,
    time_zone: config.time_zone || systemTimeZone(),
    lat: config.lat,
    lon: config.lon,
    skyline: config.skyline,
  };
}

/** Only the macOS path is tested. The other two follow the app's usual data folders. */
export function sessionsDir(config: Config): string {
  if (config.sessions_dir) return config.sessions_dir;
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "Claude", "claude-code-sessions");
  }
  if (process.platform === "win32") {
    return path.join(process.env.APPDATA || os.homedir(), "Claude", "claude-code-sessions");
  }
  return path.join(os.homedir(), ".config", "Claude", "claude-code-sessions");
}

export function transcriptsDir(config: Config): string {
  return config.transcripts_dir || path.join(os.homedir(), ".claude", "projects");
}
