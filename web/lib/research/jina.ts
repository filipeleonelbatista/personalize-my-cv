import { fetchWithTimeout, type ReadDoc } from "./providers";

const BLOCKED_MARKERS = /^(warning|error)\b/i;

export function parseReaderMeta(text: string): { title: string; publishedAt: string | null } {
  const title = /^Title:\s*(.+)$/m.exec(text)?.[1]?.trim() ?? "";
  const raw = /^Published Time:\s*(.+)$/m.exec(text)?.[1]?.trim() ?? "";
  let publishedAt: string | null = null;
  const isoDay = /^(\d{4}-\d{2}-\d{2})(?:$|[T\s])/.exec(raw)?.[1];
  if (isoDay) {
    // Data ISO completa: usa o dia declarado, sem normalizar para UTC (evita virar o dia seguinte).
    publishedAt = isoDay;
  } else if (/^\d{4}(-\d{2})?(?:$|[T\s])/.test(raw)) {
    // Data parcial ("2026-09", "2026"): nunca fabricar um dia que o cabeçalho não declarou.
    publishedAt = null;
  } else if (raw) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) publishedAt = d.toISOString().slice(0, 10);
  }
  return { title, publishedAt };
}

export async function jinaRead(url: string, key?: string): Promise<ReadDoc> {
  const headers: Record<string, string> = { accept: "text/plain" };
  if (key) headers.Authorization = `Bearer ${key}`;
  const res = await fetchWithTimeout(`https://r.jina.ai/${url}`, { headers }, 30_000);
  if (!res.ok) throw new Error(`jina ${res.status}`);
  const text = await res.text();
  const meta = parseReaderMeta(text);
  const body = text
    .replace(/^(Title|URL Source|Published Time|Markdown Content):.*$/gm, "")
    .replace(/\s+/g, " ")
    .trim();
  if (BLOCKED_MARKERS.test(text.trim()) || body.length < 200) throw new Error(`jina blocked-or-empty: ${url}`);
  return { url, title: meta.title, publishedAt: meta.publishedAt, content: text, provider: "jina" };
}
