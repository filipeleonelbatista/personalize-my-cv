// mobile/lib/tailor-client.ts
// Client-side tailor flow (AsyncStorage BYOK). Mirrors web tailor-client.
import { loadApps, loadBase, loadSettings, saveApps, type StoredApp } from "./store";
import { getApiKey } from "./secure-key";
import { generateJson } from "./llm/chain";
import { buildRepairUser, buildTailorSystem, buildTailorUser, type BaseLang } from "./llm/prompts";
import { normalizeEnvelope } from "./tailor";
import { buildFailedFileName, buildFileName } from "./filename";
import { missingJob } from "./cv-labels";
import { getLocale, tErr, type UiLocale } from "./i18n-locale";
import type { TailorEnvelope } from "./resume-schema";

export type TailorResult = { ok: true; app: StoredApp } | { ok: false; error: string; app: StoredApp };

// globalThis.crypto exists in Hermes (RN), browsers and node. Never throws;
// falls back from getRandomUUID → getRandomValues UUIDv4 → counter.
let fallbackSeq = 0;
export function newId(): string {
  try {
    const c = globalThis.crypto as unknown as
      | {
          getRandomUUID?: () => string;
          getRandomValues?: (a: Uint8Array) => Uint8Array;
        }
      | undefined;
    if (c && typeof c.getRandomUUID === "function") return c.getRandomUUID();
    if (c && typeof c.getRandomValues === "function") {
      const b = c.getRandomValues(new Uint8Array(16));
      b[6] = (b[6] & 0x0f) | 0x40;
      b[8] = (b[8] & 0x3f) | 0x80;
      const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
      return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
    }
  } catch {
    /* fall through to counter fallback */
  }
  fallbackSeq += 1;
  return `pmcv-${Date.now().toString(36)}-${fallbackSeq.toString(36)}-${Math.floor(Math.random() * 0xffffffff).toString(36)}`;
}

async function generateEnvelope(jobText: string, lang: BaseLang, locale: UiLocale, label = "tailor"): Promise<TailorEnvelope> {
  const base = await loadBase();
  if (!base) throw new Error(tErr(locale, "noBase"));
  const settings = await loadSettings();
  const key = await getApiKey();
  if (!key) throw new Error(tErr(locale, "noKey"));
  const system = buildTailorSystem(lang);
  const { data } = await generateJson(system, buildTailorUser(JSON.stringify(base.resume), jobText), key, settings.models, locale, label);
  let env;
  try {
    env = normalizeEnvelope(data, lang, base.resume);
  } catch (zerr) {
    const { data: fixed } = await generateJson(
      system,
      buildRepairUser(JSON.stringify(data), String(zerr)),
      key,
      settings.models,
      locale,
      label,
    );
    env = normalizeEnvelope(fixed, lang, base.resume);
  }
  return env;
}

function failedApp(jobText: string, lang: BaseLang, msg: string, base: StoredApp["resume"]): StoredApp {
  const missing = missingJob(lang);
  return {
    resume: base,
    cargo: missing.cargo,
    empresa: missing.empresa,
    matchPercent: 0,
    // Store schema requires non-empty lists/bodies; placeholders are never
    // rendered (analysis UI only shows for status === "done").
    strengths: ["—"],
    weaknesses: ["—"],
    emailBody: "—",
    chatMessage: "—",
    id: newId(),
    jobText,
    fileName: buildFailedFileName(),
    status: "failed",
    errorLog: msg,
    lang,
    createdAt: new Date().toISOString(),
  };
}

export async function runTailorJob(jobText: string, lang: BaseLang, locale: UiLocale = getLocale()): Promise<TailorResult> {
  if (!jobText || jobText.trim().length < 20) {
    throw new Error(tErr(locale, "jobShort"));
  }
  try {
    const env = await generateEnvelope(jobText, lang, locale, "tailor");
    const app: StoredApp = {
      ...env,
      id: newId(),
      jobText,
      fileName: buildFileName(env.resume.cabecalho.nome, env.cargo, env.empresa),
      status: "done",
      errorLog: "",
      lang,
      createdAt: new Date().toISOString(),
    };
    await saveApps([app, ...(await loadApps())]);
    return { ok: true, app };
  } catch (e) {
    if (!(await loadBase())) throw e;
    const msg = ((e instanceof Error ? e.message : String(e)) || tErr(locale, "unknownFail")).slice(0, 1000);
    const base = (await loadBase())!;
    const app = failedApp(jobText, lang, msg, base.resume);
    await saveApps([app, ...(await loadApps())]);
    return { ok: false, error: tErr(locale, "tailFail", { msg }), app };
  }
}

export async function retryStoredApp(
  id: string,
  locale: UiLocale = getLocale(),
): Promise<{ ok: true; app: StoredApp } | { ok: false; error: string }> {
  const current = (await loadApps()).find((a) => a.id === id);
  if (!current) return { ok: false, error: tErr(locale, "notFound") };
  try {
    const env = await generateEnvelope(current.jobText, current.lang, locale, "retry");
    const app: StoredApp = {
      ...env,
      id: newId(),
      jobText: current.jobText,
      fileName: buildFileName(env.resume.cabecalho.nome, env.cargo, env.empresa),
      status: "done",
      errorLog: "",
      lang: current.lang,
      createdAt: new Date().toISOString(),
    };
    await saveApps([app, ...(await loadApps()).filter((a) => a.id !== id)]);
    return { ok: true, app };
  } catch (e) {
    const msg = ((e instanceof Error ? e.message : String(e)) || tErr(locale, "unknownFail")).slice(0, 1000);
    await saveApps((await loadApps()).map((a) => (a.id === id ? { ...a, status: "failed" as const, errorLog: msg } : a)));
    return { ok: false, error: tErr(locale, "retryFailDetail", { msg }) };
  }
}
