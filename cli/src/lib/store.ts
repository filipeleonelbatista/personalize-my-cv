import { mkdirSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { StoredAppSchema, StoredBaseSchema, SettingsSchema } from "./schemas.js";

export function homeDir(): string {
  return process.env.PMCV_HOME ?? join(homedir(), ".personalize-cv");
}

function ensureDir(): string {
  const d = homeDir();
  mkdirSync(d, { recursive: true });
  return d;
}

function p(name: string): string {
  return join(ensureDir(), name);
}

function readJson(name: string): unknown | null {
  try {
    return JSON.parse(readFileSync(p(name), "utf8"));
  } catch {
    return null;
  }
}

function writeJson(name: string, v: unknown): void {
  try {
    writeFileSync(p(name), JSON.stringify(v, null, 2));
    if (name === "config.json") {
      try {
        chmodSync(p(name), 0o600);
      } catch {}
    }
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err?.code === "ENOSPC") throw new Error("quota");
    throw e;
  }
}

export function loadBase() {
  const raw = readJson("base.json");
  if (!raw) return null;
  try {
    return StoredBaseSchema.parse(raw);
  } catch {
    return null;
  }
}

export function saveBase(b: unknown): void {
  writeJson("base.json", StoredBaseSchema.parse(b));
}

export function loadApps() {
  const raw = readJson("apps.json");
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw) {
    try {
      out.push(StoredAppSchema.parse(item));
    } catch {}
  }
  return out;
}

export function saveApps(a: unknown[]): void {
  const clean = [];
  for (const item of a) clean.push(StoredAppSchema.parse(item));
  writeJson("apps.json", clean);
}

export function loadConfig() {
  try {
    return SettingsSchema.parse(readJson("config.json") ?? {});
  } catch {
    return SettingsSchema.parse({});
  }
}

export function saveConfig(c: unknown): void {
  writeJson("config.json", SettingsSchema.parse(c));
}

export type { StoredBase, StoredApp, Settings } from "./schemas.js";
