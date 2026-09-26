export const DEFAULT_GEMINI_MODELS = ["gemini-3-flash-preview", "gemini-2.5-flash", "gemini-2.5-flash-lite"];

export function geminiModels(): string[] {
  const list = (process.env.GEMINI_MODELS || "").split(",").map((s) => s.trim()).filter(Boolean);
  return list.length ? list : [...DEFAULT_GEMINI_MODELS];
}

export async function chatJsonGemini(system: string, user: string, model = geminiModels()[0]): Promise<unknown> {
  const key = process.env.GEMINI_API_KEY || "";
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 60_000);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: "POST",
        signal: ctl.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: system }] },
          contents: [{ parts: [{ text: user }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      }
    );
    if (!res.ok) throw new Error(`gemini ${res.status}: ${await res.text()}`);
    const j = (await res.json()) as { candidates: { content: { parts: { text: string }[] } }[] };
    const text = j.candidates?.[0]?.content?.parts?.map((p) => p.text).join("");
    if (typeof text !== "string" || !text.trim()) throw new Error("gemini: resposta vazia da IA.");
    const { extractJson } = await import("@/lib/json-text");
    return JSON.parse(extractJson(text));
  } finally {
    clearTimeout(t);
  }
}
