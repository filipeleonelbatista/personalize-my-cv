// mobile/lib/json-text.ts
export function extractJson(raw: string): string {
  if (typeof raw !== "string" || !raw.trim()) throw new Error("Resposta da IA vazia ou inválida.");
  const m = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const inner = (m ? m[1] : raw).trim();
  const s = inner.indexOf("{");
  const e = inner.lastIndexOf("}");
  return s >= 0 && e > s ? inner.slice(s, e + 1) : inner;
}
