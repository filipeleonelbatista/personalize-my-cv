import { chatJsonGemini, geminiModels } from "./gemini.js";
import { t, type UiLocale } from "./i18n.js";

export type Provider = string;

function isOffline(e: unknown): boolean {
  if (e instanceof TypeError) return true;
  const msg = e instanceof Error ? e.message : String(e);
  return /fetch failed|aborted|network|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|offline/i.test(msg);
}

function offlineErr(locale: UiLocale): Error {
  return new Error(t(locale, "Errors.offline"));
}

export async function generateJson(
  system: string,
  user: string,
  key: string,
  models?: string[],
  locale: UiLocale = "pt-BR",
): Promise<{ data: unknown; provider: Provider }> {
  const errs: string[] = [];
  let sawOffline = false;
  for (const model of geminiModels(models)) {
    try {
      return { data: await chatJsonGemini(system, user, key, model, locale), provider: `gemini:${model}` };
    } catch (e) {
      if (isOffline(e)) sawOffline = true;
      errs.push(`${model}: ${(e as Error).message}`);
    }
  }
  if (sawOffline) throw offlineErr(locale);
  throw new Error(errs.join(" | "));
}

export async function validateGeminiKey(
  key: string,
  locale: UiLocale = "pt-BR",
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!key.trim()) return { ok: false, error: t(locale, "Errors.pasteKey") };
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`);
    if (res.status === 401 || res.status === 403) return { ok: false, error: t(locale, "Errors.invalidKey") };
    if (!res.ok) return { ok: false, error: t(locale, "Errors.validateFailed", { status: res.status }) };
    return { ok: true };
  } catch (e) {
    if (isOffline(e)) return { ok: false, error: t(locale, "Errors.offline") };
    return { ok: false, error: (e as Error).message.slice(0, 300) };
  }
}
