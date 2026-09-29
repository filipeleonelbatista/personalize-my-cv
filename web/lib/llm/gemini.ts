export const DEFAULT_GEMINI_MODELS = ["gemini-3-flash-preview", "gemini-2.5-flash", "gemini-2.5-flash-lite"];

export function geminiModels(models?: string[]): string[] {
  if (models && models.length) {
    const clean = models.map((s) => s.trim()).filter(Boolean);
    if (clean.length) return clean;
  }
  return [...DEFAULT_GEMINI_MODELS];
}

export async function chatJsonGemini(system: string, user: string, key: string, model = geminiModels()[0]): Promise<unknown> {
  if (!key) throw new Error("Configure a chave Gemini no onboarding.");
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 60_000);
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
      method: "POST", signal: ctl.signal, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system_instruction: { parts: [{ text: system }] }, contents: [{ parts: [{ text: user }] }], generationConfig: { responseMimeType: "application/json" } }),
    });
    if (res.status === 401 || res.status === 403) throw new Error("Chave Gemini inválida (401/403). Confira em https://aistudio.google.com/apikey");
    if (!res.ok) throw new Error(`gemini ${res.status}: ${await res.text()}`);
    const j = (await res.json()) as { candidates: { content: { parts: { text: string }[] } }[] };
    const text = j.candidates?.[0]?.content?.parts?.map((p) => p.text).join("");
    if (typeof text !== "string" || !text.trim()) throw new Error("gemini: resposta vazia da IA.");
    const { extractJson } = await import("@/lib/json-text");
    return JSON.parse(extractJson(text));
  } finally { clearTimeout(t); }
}
