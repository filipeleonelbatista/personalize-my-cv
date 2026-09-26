export async function chatJsonGemini(system: string, user: string): Promise<unknown> {
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
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
    const { extractJson } = await import("@/lib/json-text");
    return JSON.parse(extractJson(j.candidates[0].content.parts.map((p) => p.text).join("")));
  } finally {
    clearTimeout(t);
  }
}
