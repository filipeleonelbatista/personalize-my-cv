// web/lib/store.ts
import { z } from "zod";
import { ResumeSchema, TailorEnvelopeSchema } from "./resume-schema";
import { parseBaseLang, type BaseLang } from "./llm/prompts";
import { DossierSchema, DossierMatchSchema, type Dossier } from "./dossier-schema";
import { getSecure, setSecure, removeSecure } from "./secure-store";
import { DEFAULT_LOCALE, type UiLocale } from "./i18n/config";
import { tErr } from "./i18n/locale";

export const StoredBaseSchema = z.object({ resume: ResumeSchema, lang: z.enum(["pt-BR", "en", "es"]), updatedAt: z.string() });
export type StoredBase = z.infer<typeof StoredBaseSchema>;
export const StoredAppSchema = TailorEnvelopeSchema.extend({ id: z.string().min(1), jobText: z.string(), jobUrl: z.string().default(""), fileName: z.string(), status: z.enum(["done", "failed"]), errorLog: z.string().default(""), lang: z.enum(["pt-BR", "en", "es"]).default("pt-BR"), createdAt: z.string(), dossierId: z.string().nullable().default(null), dossierMatch: DossierMatchSchema.nullable().default(null) });
export type StoredApp = z.infer<typeof StoredAppSchema>;
export const SettingsSchema = z.object({ geminiKey: z.string().default(""), models: z.array(z.string()).min(1).default(["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite"]) });
export type Settings = z.infer<typeof SettingsSchema>;

function readArr<T>(key: string, schema: { parse(item: unknown): T }): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    const out: T[] = [];
    for (const item of arr) { try { out.push(schema.parse(item)); } catch { /* descarta item inválido */ } }
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
export function loadApps(): StoredApp[] { return readArr("pmcv:apps", StoredAppSchema); }
export function saveApps(a: StoredApp[]): void {
  try { localStorage.setItem("pmcv:apps", JSON.stringify(a)); }
  catch (e) { throwQuota(e); }
}

export type StoredDossier = Dossier;
export function loadDossiers(): StoredDossier[] { return readArr("pmcv:dossiers", DossierSchema); }
export function saveDossiers(d: StoredDossier[]): void {
  // Valida na escrita como saveBase: item inválido lança (não some em silêncio);
  // localStorage cheio → mensagem de quota via throwQuota.
  try { localStorage.setItem("pmcv:dossiers", JSON.stringify(d.map((item) => DossierSchema.parse(item)))); }
  catch (e) { throwQuota(e); }
}
export function upsertDossier(d: StoredDossier): void {
  saveDossiers([d, ...loadDossiers().filter((x) => x.companyKey !== d.companyKey)]);
}
export function findDossierByCompany(companyKey: string): StoredDossier | null { return loadDossiers().find((d) => d.companyKey === companyKey) ?? null; }
export function deleteDossier(id: string): void {
  saveDossiers(loadDossiers().filter((d) => d.id !== id));
  saveApps(loadApps().map((a) => (a.dossierId === id ? { ...a, dossierId: null } : a)));
}

const ReadCacheSchema = z.object({ url: z.string(), content: z.string(), publishedAt: z.string().nullable(), fetchedAt: z.string() });
export type ReadCacheEntry = z.infer<typeof ReadCacheSchema>;
export function loadReadCache(): ReadCacheEntry[] { return readArr("pmcv:readcache", ReadCacheSchema); }
export function saveReadCache(c: ReadCacheEntry[]): void {
  // Valida na escrita (item inválido lança); localStorage cheio → throwQuota.
  try { localStorage.setItem("pmcv:readcache", JSON.stringify(c.map((item) => ReadCacheSchema.parse(item)))); }
  catch (e) { throwQuota(e); }
}
export function loadSettings(): Settings {
  try {
    const raw = getSecure("pmcv:settings");
    if (!raw) return SettingsSchema.parse({});
    const parsed: unknown = JSON.parse(raw);
    const settings = SettingsSchema.parse(parsed);
    if (typeof parsed === "object" && parsed !== null && "research" in parsed) {
      setSecure("pmcv:settings", JSON.stringify(settings));
    }
    return settings;
  } catch {
    return SettingsSchema.parse({});
  }
}
export function saveSettings(s: Partial<Settings>): void {
  const cur = loadSettings();
  setSecure("pmcv:settings", JSON.stringify(SettingsSchema.parse({ ...cur, ...s })));
}
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
export function exportBackup(): string { return JSON.stringify({ base: loadBase(), apps: loadApps(), dossiers: loadDossiers(), exportedAt: new Date().toISOString() }); }
export function importBackup(json: string): void {
  const parsed = z.object({ base: StoredBaseSchema.nullable(), apps: z.array(StoredAppSchema), dossiers: z.array(DossierSchema).optional() }).parse(JSON.parse(json));
  if (parsed.base) saveBase(parsed.base); localStorage.setItem("pmcv:apps", JSON.stringify(parsed.apps));
  if (parsed.dossiers) saveDossiers(parsed.dossiers); // D15: sem a chave, dossiês locais preservados
}
export function touchUpdatedAt(): string { return new Date().toISOString(); }

/** Apaga TUDO do navegador (base, vagas, dossiês, cache de leitura, chave,
 *  onboarding, idioma, tema, consentimento + cookie). Irreversível. Falhas
 *  isoladas não travam o resto. */
export function wipeAll(): void {
  try {
    clearSettings();
  } catch {
    /* segue o baile */
  }
  for (const k of ["pmcv:base", "pmcv:apps", "pmcv:dossiers", "pmcv:readcache", "pmcv:onboarded", "pmcv:locale", "pmcv:consent", "theme"]) {
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
