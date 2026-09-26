export async function chatJsonOpenrouter(system: string, user: string): Promise<unknown> {
  const model = process.env.OPENROUTER_MODEL || "openai/gpt-oss-20b:free";
  const key = process.env.OPENROUTER_API_KEY || "";
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 60_000);
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: ctl.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "personalize-my-cv",
      },
      body: JSON.stringify({ model, messages: [{ role: "system", content: system }, { role: "user", content: user }], response_format: { type: "json_object" } }),
    });
    if (!res.ok) throw new Error(`openrouter ${res.status}: ${await res.text()}`);
    const j = (await res.json()) as { choices: { message: { content: string } }[] };
    const { extractJson } = await import("@/lib/json-text");
    return JSON.parse(extractJson(j.choices[0].message.content));
  } finally {
    clearTimeout(t);
  }
}
