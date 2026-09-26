// Opencode Zen — Responses API (ex.: muse-spark-1.3-contributor-free).
// Docs: https://opencode.ai/docs/zen/ → POST {base}/responses
type ResponsesContent = { type: string; text?: string };
type ResponsesItem = { type: string; content?: ResponsesContent[] };
type ResponsesBody = { output?: ResponsesItem[]; output_text?: string };

export async function chatJsonZen(system: string, user: string): Promise<unknown> {
  const base = (process.env.OPENCODE_ZEN_BASE_URL || "https://opencode.ai/zen/v1").replace(/\/$/, "");
  const model = process.env.OPENCODE_ZEN_MODEL || "muse-spark-1.3-contributor-free";
  const key = process.env.OPENCODE_ZEN_API_KEY || "";
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 60_000);
  try {
    const res = await fetch(`${base}/responses`, {
      method: "POST",
      signal: ctl.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        input: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        text: { format: { type: "json_object" } },
      }),
    });
    if (!res.ok) throw new Error(`zen ${res.status}: ${await res.text()}`);
    const j = (await res.json()) as ResponsesBody;
    const parts: string[] = [];
    if (typeof j.output_text === "string" && j.output_text.trim()) parts.push(j.output_text);
    for (const item of j.output ?? []) {
      if (item.type !== "message") continue;
      for (const c of item.content ?? []) {
        if ((c.type === "output_text" || c.type === "text") && c.text) parts.push(c.text);
      }
    }
    const text = parts.join("");
    if (!text.trim()) throw new Error("zen: resposta vazia da IA.");
    const { extractJson } = await import("@/lib/json-text");
    return JSON.parse(extractJson(text));
  } finally {
    clearTimeout(t);
  }
}
