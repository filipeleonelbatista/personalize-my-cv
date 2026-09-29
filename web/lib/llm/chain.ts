import { chatJsonGemini, geminiModels } from "./gemini";

export type Provider = string;

export async function generateJson(system: string, user: string, key: string, models?: string[]): Promise<{ data: unknown; provider: Provider }> {
  const errs: string[] = [];
  for (const model of geminiModels(models)) {
    try { return { data: await chatJsonGemini(system, user, key, model), provider: `gemini:${model}` }; }
    catch (e) { errs.push(`${model}: ${(e as Error).message}`); }
  }
  throw new Error(errs.join(" | "));
}

export async function validateGeminiKey(key: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!key.trim()) return { ok: false, error: "Cole uma chave." };
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`);
    if (res.status === 401 || res.status === 403) return { ok: false, error: "Chave inválida (401/403). Gere em https://aistudio.google.com/apikey" };
    if (!res.ok) return { ok: false, error: `Falha ao validar: ${res.status}` };
    return { ok: true };
  } catch (e) { return { ok: false, error: (e as Error).message.slice(0, 300) }; }
}
