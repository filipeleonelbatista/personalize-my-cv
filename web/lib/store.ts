// web/lib/store.ts
import { z } from "zod";
import { ResumeSchema, TailorEnvelopeSchema } from "./resume-schema";
import { parseBaseLang, type BaseLang } from "./llm/prompts";
import { getSecure, setSecure, removeSecure } from "./secure-store";
import { DEFAULT_LOCALE, type UiLocale } from "./i18n/config";
import { tErr } from "./i18n/locale";

export const StoredBaseSchema = z.object({ resume: ResumeSchema, lang: z.enum(["pt-BR", "en", "es"]), updatedAt: z.string() });
export type StoredBase = z.infer<typeof StoredBaseSchema>;
export const StoredAppSchema = TailorEnvelopeSchema.extend({ id: z.string().min(1), jobText: z.string(), fileName: z.string(), status: z.enum(["done", "failed"]), errorLog: z.string().default(""), lang: z.enum(["pt-BR", "en", "es"]).default("pt-BR"), createdAt: z.string() });
export type StoredApp = z.infer<typeof StoredAppSchema>;
export const SettingsSchema = z.object({ geminiKey: z.string().default(""), models: z.array(z.string()).min(1).default(["gemini-3-flash-preview", "gemini-2.5-flash", "gemini-2.5-flash-lite"]) });
export type Settings = z.infer<typeof SettingsSchema>;

function readArr(key: string): StoredApp[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    const out: StoredApp[] = [];
    for (const item of arr) { try { out.push(StoredAppSchema.parse(item)); } catch { /* descarta item inválido */ } }
    return out;
  } catch { return []; }
}
export function loadBase(): StoredBase | null { try { const raw = localStorage.getItem("pmcv:base"); if (!raw) return null; return StoredBaseSchema.parse(JSON.parse(raw)); } catch { return null; } }
export function quotaMessage(locale: UiLocale = DEFAULT_LOCALE): string {
  return tErr(locale, "quota");
}
export const QUOTA_MESSAGE = quotaMessage("pt-BR");
function throwQuota(e: unknown): never {
  if (e instanceof DOMException && e.name === "QuotaExceededError") throw new Error(quotaMessage(loadLocale()));
  throw e;
}
export function saveBase(b: StoredBase): void {
  try { localStorage.setItem("pmcv:base", JSON.stringify(StoredBaseSchema.parse(b))); }
  catch (e) { throwQuota(e); }
}
export function loadApps(): StoredApp[] { return readArr("pmcv:apps"); }
export function saveApps(a: StoredApp[]): void {
  try { localStorage.setItem("pmcv:apps", JSON.stringify(a)); }
  catch (e) { throwQuota(e); }
}
export function loadSettings(): Settings { try { const s = getSecure("pmcv:settings"); if (!s) return SettingsSchema.parse({}); return SettingsSchema.parse(JSON.parse(s)); } catch { return SettingsSchema.parse({}); } }
export function saveSettings(s: Settings): void { setSecure("pmcv:settings", JSON.stringify(SettingsSchema.parse(s))); }
export function clearSettings(): void { removeSecure("pmcv:settings"); }
export function isOnboarded(): boolean { return localStorage.getItem("pmcv:onboarded") === "1" && !!loadSettings().geminiKey && !!loadBase(); }
export function setOnboarded(v: boolean): void { localStorage.setItem("pmcv:onboarded", v ? "1" : "0"); }
export function loadLocale(): UiLocale {
  try {
    const raw = localStorage.getItem("pmcv:locale");
    if (raw === "pt-BR" || raw === "en-US" || raw === "es-ES") return raw;
    return DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}
export function saveLocale(l: UiLocale): void {
  localStorage.setItem("pmcv:locale", l);
}
export function exportBackup(): string { return JSON.stringify({ base: loadBase(), apps: loadApps(), exportedAt: new Date().toISOString() }); }
export function importBackup(json: string): void {
  const parsed = z.object({ base: StoredBaseSchema.nullable(), apps: z.array(StoredAppSchema) }).parse(JSON.parse(json));
  if (parsed.base) saveBase(parsed.base); localStorage.setItem("pmcv:apps", JSON.stringify(parsed.apps));
}
export function touchUpdatedAt(): string { return new Date().toISOString(); }

/** Apaga TUDO do navegador (base, vagas, chave, onboarding, idioma, tema,
 *  consentimento + cookie). Irreversível. Falhas isoladas não travam o resto. */
export function wipeAll(): void {
  try {
    clearSettings();
  } catch {
    /* segue o baile */
  }
  for (const k of ["pmcv:base", "pmcv:apps", "pmcv:onboarded", "pmcv:locale", "pmcv:consent", "theme"]) {
    try {
      localStorage.removeItem(k);
    } catch {
      /* segue o baile */
    }
  }
  try {
    document.cookie = "pmcv-consent=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
  } catch {
    /* segue o baile */
  }
}
export type { BaseLang };
export { parseBaseLang };
