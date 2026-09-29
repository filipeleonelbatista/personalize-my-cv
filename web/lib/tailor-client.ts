// web/lib/tailor-client.ts
// Client-side tailor flow (localStorage BYOK): generates a tailored resume via
// the user's Gemini key and persists the result in the store. No server calls.
import { loadApps, loadBase, loadSettings, saveApps, type StoredApp } from "./store";
import { generateJson } from "./llm/chain";
import { buildRepairUser, buildTailorSystem, buildTailorUser, type BaseLang } from "./llm/prompts";
import { normalizeEnvelope } from "./tailor";
import { buildFailedFileName, buildFileName } from "./filename";
import { MISSING_JOB } from "./pdf/i18n";
import type { TailorEnvelope } from "./resume-schema";

export type TailorResult = { ok: true; app: StoredApp } | { ok: false; error: string; app: StoredApp };

async function generateEnvelope(jobText: string, lang: BaseLang): Promise<TailorEnvelope> {
  const base = loadBase();
  if (!base) throw new Error("Cadastre o currículo base primeiro.");
  const settings = loadSettings();
  const system = buildTailorSystem(lang);
  const { data } = await generateJson(system, buildTailorUser(JSON.stringify(base.resume), jobText), settings.geminiKey, settings.models);
  let env;
  try {
    env = normalizeEnvelope(data, lang, base.resume);
  } catch (zerr) {
    const { data: fixed } = await generateJson(system, buildRepairUser(JSON.stringify(data), String(zerr)), settings.geminiKey, settings.models);
    env = normalizeEnvelope(fixed, lang, base.resume);
  }
  return env;
}

function failedApp(jobText: string, lang: BaseLang, msg: string): StoredApp {
  // Caller guarantees a base exists (rethrown otherwise).
  const base = loadBase()!;
  const missing = MISSING_JOB[lang] ?? MISSING_JOB["pt-BR"];
  return {
    resume: base.resume,
    cargo: missing.cargo,
    empresa: missing.empresa,
    matchPercent: 0,
    // Store schema requires non-empty lists/bodies; placeholders are never
    // rendered (analysis UI only shows for status === "done").
    strengths: ["—"],
    weaknesses: ["—"],
    emailBody: "—",
    chatMessage: "—",
    id: crypto.randomUUID(),
    jobText,
    fileName: buildFailedFileName(),
    status: "failed",
    errorLog: msg,
    lang,
    createdAt: new Date().toISOString(),
  };
}

export async function runTailorJob(jobText: string, lang: BaseLang): Promise<TailorResult> {
  if (!jobText || jobText.trim().length < 20) {
    throw new Error("Cole o texto da vaga (mín. 20 caracteres).");
  }
  try {
    const env = await generateEnvelope(jobText, lang);
    const app: StoredApp = {
      ...env,
      id: crypto.randomUUID(),
      jobText,
      fileName: buildFileName(env.resume.cabecalho.nome, env.cargo, env.empresa),
      status: "done",
      errorLog: "",
      lang,
      createdAt: new Date().toISOString(),
    };
    saveApps([app, ...loadApps()]);
    return { ok: true, app };
  } catch (e) {
    if (!loadBase()) throw e;
    const msg = ((e instanceof Error ? e.message : String(e)) || "Falha desconhecida.").slice(0, 1000);
    const app = failedApp(jobText, lang, msg);
    saveApps([app, ...loadApps()]);
    return { ok: false, error: `As IAs falharam. Vaga salva como failed para retry. Detalhe: ${msg}`, app };
  }
}

export async function retryStoredApp(id: string): Promise<{ ok: true; app: StoredApp } | { ok: false; error: string }> {
  const current = loadApps().find((a) => a.id === id);
  if (!current) return { ok: false, error: "Registro não encontrado." };
  try {
    const env = await generateEnvelope(current.jobText, current.lang);
    const app: StoredApp = {
      ...env,
      id: crypto.randomUUID(),
      jobText: current.jobText,
      fileName: buildFileName(env.resume.cabecalho.nome, env.cargo, env.empresa),
      status: "done",
      errorLog: "",
      lang: current.lang,
      createdAt: new Date().toISOString(),
    };
    saveApps([app, ...loadApps().filter((a) => a.id !== id)]);
    return { ok: true, app };
  } catch (e) {
    const msg = ((e instanceof Error ? e.message : String(e)) || "Falha desconhecida.").slice(0, 1000);
    saveApps(loadApps().map((a) => (a.id === id ? { ...a, status: "failed" as const, errorLog: msg, createdAt: new Date().toISOString() } : a)));
    return { ok: false, error: `Retry falhou. Detalhe: ${msg}` };
  }
}
