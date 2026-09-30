// mobile/lib/llm/chain.ts
import { chatJsonGemini, geminiModels } from "./gemini";
import { getLocale, tErr, type UiLocale } from "../i18n-locale";
import { appendAiLog } from "../ai-log";

export type Provider = string;

export async function generateJson(
  system: string,
  user: string,
  key: string,
  models?: string[],
  locale: UiLocale = getLocale(),
  label = "generate",
): Promise<{ data: unknown; provider: Provider }> {
  const errs: string[] = [];
  for (const model of geminiModels(models)) {
    const started = Date.now();
    try {
      const data = await chatJsonGemini(system, user, key, model, locale);
      const provider = `gemini:${model}`;
      void appendAiLog({ label, provider, ms: Date.now() - started, ok: true });
      return { data, provider };
    } catch (e) {
      const msg = (e as Error).message;
      errs.push(`${model}: ${msg}`);
      void appendAiLog({ label, provider: `gemini:${model}`, ms: Date.now() - started, ok: false, error: msg.slice(0, 300) });
    }
  }
  throw new Error(errs.join(" | "));
}

export async function validateGeminiKey(
  key: string,
  locale: UiLocale = getLocale(),
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!key.trim()) return { ok: false, error: tErr(locale, "pasteKey") };
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`);
    if (res.status === 401 || res.status === 403) return { ok: false, error: tErr(locale, "invalidKey") };
    if (!res.ok) return { ok: false, error: tErr(locale, "validateFailed", { status: res.status }) };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message.slice(0, 300) };
  }
}
