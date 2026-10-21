import { chatJsonGemini, chatJsonGeminiLong, chatTextGemini, geminiModels } from "./gemini";
import { getLocale, tErr, type UiLocale } from "@/lib/i18n/locale";

export type Provider = string;

export async function generateJson(system: string, user: string, key: string, models?: string[], locale: UiLocale = getLocale()): Promise<{ data: unknown; provider: Provider }> {
  const errs: string[] = [];
  for (const model of geminiModels(models)) {
    try { return { data: await chatJsonGemini(system, user, key, model, locale), provider: `gemini:${model}` }; }
    catch (e) { errs.push(`${model}: ${(e as Error).message}`); }
  }
  throw new Error(errs.join(" | "));
}

/** Chain do dossiê: timeout longo e no máximo 2 models (evita 5 × 60 s de
 * espera). Ao falhar, lança UMA mensagem agregada — o caller mapeia para uma
 * chave `tErr` e guarda o detalhe no `errorLog`. */
export async function generateJsonLong(system: string, user: string, key: string, models?: string[], locale: UiLocale = getLocale(), maxModels = 2): Promise<{ data: unknown; provider: Provider }> {
  const errs: string[] = [];
  const list = geminiModels(models).slice(0, Math.max(1, maxModels));
  for (const model of list) {
    try { return { data: await chatJsonGeminiLong(system, user, key, model, locale), provider: `gemini:${model}` }; }
    catch (e) { errs.push(`${model}: ${(e as Error).message}`); }
  }
  throw new Error(errs.join(" | "));
}

/** Mesma política de fallback do generateJson, mas devolve texto puro. */
export async function generateText(system: string, user: string, key: string, models?: string[], locale: UiLocale = getLocale()): Promise<{ text: string; provider: Provider }> {
  const errs: string[] = [];
  for (const model of geminiModels(models)) {
    try { return { text: await chatTextGemini(system, user, key, model, locale), provider: `gemini:${model}` }; }
    catch (e) { errs.push(`${model}: ${(e as Error).message}`); }
  }
  throw new Error(errs.join(" | "));
}

export async function validateGeminiKey(key: string, locale: UiLocale = getLocale()): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!key.trim()) return { ok: false, error: tErr(locale, "pasteKey") };
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`);
    if (res.status === 401 || res.status === 403) return { ok: false, error: tErr(locale, "invalidKey") };
    if (!res.ok) return { ok: false, error: tErr(locale, "validateFailed", { status: res.status }) };
    return { ok: true };
  } catch (e) { return { ok: false, error: (e as Error).message.slice(0, 300) }; }
}
