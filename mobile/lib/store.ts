// mobile/lib/store.ts
// AsyncStorage-backed mirror of the web store contract: same pmcv:* keys.
// Resume/app payloads are validated structurally in Task 2 (resume-schema);
// here they pass through as unknown JSON.
import { z } from "zod";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { DEFAULT_LOCALE, type UiLocale } from "./i18n-config";
import { tErr } from "./i18n-locale";
import { getApiKey } from "./secure-key";
import { ResumeSchema, TailorEnvelopeSchema } from "./resume-schema";

export const StoredBaseSchema = z.object({
  resume: ResumeSchema,
  lang: z.enum(["pt-BR", "en", "es"]),
  updatedAt: z.string(),
});
export type StoredBase = z.infer<typeof StoredBaseSchema>;

export const StoredAppSchema = TailorEnvelopeSchema.extend({
  id: z.string().min(1),
  jobText: z.string(),
  fileName: z.string(),
  status: z.enum(["done", "failed"]),
  errorLog: z.string().default(""),
  lang: z.enum(["pt-BR", "en", "es"]).default("pt-BR"),
  createdAt: z.string(),
});
export type StoredApp = z.infer<typeof StoredAppSchema>;

export const SettingsSchema = z.object({
  models: z.array(z.string()).min(1).default(["gemini-3-flash-preview", "gemini-2.5-flash", "gemini-2.5-flash-lite"]),
});
export type Settings = z.infer<typeof SettingsSchema>;

export function quotaMessage(locale: UiLocale = DEFAULT_LOCALE): string {
  return tErr(locale, "quota");
}
export const QUOTA_MESSAGE = quotaMessage("pt-BR");

function throwQuota(e: unknown): never {
  const isQuota =
    e instanceof Error && /quota|QuotaExceededError|SQLITE_FULL/i.test(e.message + " " + (e as Error).name);
  if (isQuota) throw new Error(QUOTA_MESSAGE);
  throw e;
}

export async function loadBase(): Promise<StoredBase | null> {
  try {
    const raw = await AsyncStorage.getItem("pmcv:base");
    if (!raw) return null;
    return StoredBaseSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function saveBase(b: StoredBase): Promise<void> {
  try {
    await AsyncStorage.setItem("pmcv:base", JSON.stringify(StoredBaseSchema.parse(b)));
  } catch (e) {
    throwQuota(e);
  }
}

export async function loadApps(): Promise<StoredApp[]> {
  try {
    const raw = await AsyncStorage.getItem("pmcv:apps");
    if (!raw) return [];
    const arr: unknown = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    const out: StoredApp[] = [];
    for (const item of arr) {
      try {
        out.push(StoredAppSchema.parse(item));
      } catch {
        /* descarta item inválido */
      }
    }
    return out;
  } catch {
    return [];
  }
}

export async function saveApps(a: StoredApp[]): Promise<void> {
  try {
    await AsyncStorage.setItem("pmcv:apps", JSON.stringify(a));
  } catch (e) {
    throwQuota(e);
  }
}

export async function loadSettings(): Promise<Settings> {
  try {
    const s = await SecureStore.getItemAsync("pmcv:settings");
    if (!s) return SettingsSchema.parse({});
    return SettingsSchema.parse(JSON.parse(s));
  } catch {
    return SettingsSchema.parse({});
  }
}

export async function saveSettings(s: Settings): Promise<void> {
  await SecureStore.setItemAsync("pmcv:settings", JSON.stringify(SettingsSchema.parse(s)));
}

export async function clearSettings(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync("pmcv:settings");
  } catch {
    /* already gone */
  }
}

export async function isOnboarded(): Promise<boolean> {
  const [flag, key, base] = await Promise.all([AsyncStorage.getItem("pmcv:onboarded"), getApiKey(), loadBase()]);
  return flag === "1" && !!key && !!base;
}

export async function setOnboarded(v: boolean): Promise<void> {
  await AsyncStorage.setItem("pmcv:onboarded", v ? "1" : "0");
}

export async function loadLocale(): Promise<UiLocale> {
  try {
    const raw = await AsyncStorage.getItem("pmcv:locale");
    if (raw === "pt-BR" || raw === "en-US" || raw === "es-ES") return raw;
    return DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

export async function saveLocale(l: UiLocale): Promise<void> {
  await AsyncStorage.setItem("pmcv:locale", l);
}

export async function exportBackup(): Promise<string> {
  return JSON.stringify({ base: await loadBase(), apps: await loadApps(), exportedAt: new Date().toISOString() });
}

export async function importBackup(json: string): Promise<void> {
  const parsed = z
    .object({ base: StoredBaseSchema.nullable(), apps: z.array(StoredAppSchema) })
    .parse(JSON.parse(json));
  if (parsed.base) await saveBase(parsed.base);
  await AsyncStorage.setItem("pmcv:apps", JSON.stringify(parsed.apps));
}
