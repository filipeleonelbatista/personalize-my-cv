export async function chatJsonZen(system: string, user: string): Promise<unknown> {
  const base = process.env.OPENCODE_ZEN_BASE_URL || "https://opencode.ai/zen/v1";
  const model = process.env.OPENCODE_ZEN_MODEL || "glm-4.6";
  const key = process.env.OPENCODE_ZEN_API_KEY || "";
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 60_000);
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      signal: ctl.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, messages: [{ role: "system", content: system }, { role: "user", content: user }], response_format: { type: "json_object" } }),
    });
    if (!res.ok) throw new Error(`zen ${res.status}: ${await res.text()}`);
    const j = (await res.json()) as { choices: { message: { content: string } }[] };
    const { extractJson } = await import("@/lib/json-text");
    return JSON.parse(extractJson(j.choices[0].message.content));
  } finally {
    clearTimeout(t);
  }
}
