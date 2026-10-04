import { getLocale, tErr, type UiLocale } from "@/lib/i18n/locale";

export const DEFAULT_GEMINI_MODELS = ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite"];

// Modelos antigos removidos/restritos pela API (2.5 só para uso legado desde 18/09/2026,
// 2.0 desligado em 01/06/2026, preview instável com 503). Mantidos aqui para migrar
// configurações salvas que ainda referenciem esses IDs.
export const DEPRECATED_GEMINI_MODELS = new Set([
  "gemini-3-flash-preview",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-2.0-flash-001",
  "gemini-2.0-flash-lite-001",
  "gemini-3.1-flash-lite-preview",
]);

export function geminiModels(models?: string[]): string[] {
  if (models && models.length) {
    const clean = models.map((s) => s.trim()).filter(Boolean).filter((m) => !DEPRECATED_GEMINI_MODELS.has(m));
    if (clean.length) return clean;
  }
  return [...DEFAULT_GEMINI_MODELS];
}

export async function chatJsonGemini(system: string, user: string, key: string, model = geminiModels()[0], locale: UiLocale = getLocale()): Promise<unknown> {
  if (!key) throw new Error(tErr(locale, "noKey"));
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 60_000);
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
      method: "POST", signal: ctl.signal, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system_instruction: { parts: [{ text: system }] }, contents: [{ parts: [{ text: user }] }], generationConfig: { responseMimeType: "application/json" } }),
    });
    if (res.status === 401 || res.status === 403) throw new Error(tErr(locale, "invalidKey"));
    if (!res.ok) throw new Error(`gemini ${res.status}: ${await res.text()}`);
    const j = (await res.json()) as { candidates: { content: { parts: { text: string }[] } }[] };
    const text = j.candidates?.[0]?.content?.parts?.map((p) => p.text).join("");
    if (typeof text !== "string" || !text.trim()) throw new Error(tErr(locale, "emptyResponse"));
    const { extractJson } = await import("@/lib/json-text");
    return JSON.parse(extractJson(text));
  } finally { clearTimeout(t); }
}
