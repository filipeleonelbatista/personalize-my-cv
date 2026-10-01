import { chatJsonGemini, geminiModels } from "./gemini.js";
import { t, type UiLocale } from "./i18n.js";

export type Provider = string;

export async function generateJson(
  system: string,
  user: string,
  key: string,
  models?: string[],
  locale: UiLocale = "pt-BR",
): Promise<{ data: unknown; provider: Provider }> {
  const errs: string[] = [];
  for (const model of geminiModels(models)) {
    try {
      return { data: await chatJsonGemini(system, user, key, model, locale), provider: `gemini:${model}` };
    } catch (e) {
      errs.push(`${model}: ${(e as Error).message}`);
    }
  }
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
    return { ok: false, error: (e as Error).message.slice(0, 300) };
  }
}
