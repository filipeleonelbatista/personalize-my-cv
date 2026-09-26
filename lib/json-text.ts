export function extractJson(raw: string): string {
  const m = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const inner = (m ? m[1] : raw).trim();
  const s = inner.indexOf("{");
  const e = inner.lastIndexOf("}");
  return s >= 0 && e > s ? inner.slice(s, e + 1) : inner;
}
