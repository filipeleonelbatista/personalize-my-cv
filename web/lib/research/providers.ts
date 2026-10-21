export type ProviderName = "tavily" | "brave" | "jina" | "direct" | "user";
export type SearchHit = { url: string; title: string; snippet: string; publishedAt: string | null };
export type ReadDoc = { url: string; title: string; publishedAt: string | null; content: string; provider: ProviderName };

export function canonicalUrl(u: string): string {
  try {
    const url = new URL(u);
    url.hash = "";
    url.hostname = url.hostname.toLowerCase().replace(/^(?:www\.|m\.)+/, "");
    for (const key of [...url.searchParams.keys()]) {
      if (/^utm_/i.test(key) || key === "fbclid" || key === "gclid") url.searchParams.delete(key);
    }
    url.protocol = "https:";
    return url.toString().replace(/\/+$/, "");
  } catch {
    return u.trim();
  }
}

export function dedupeUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of urls) {
    const c = canonicalUrl(raw);
    if (!c || seen.has(c)) continue;
    seen.add(c);
    out.push(c);
  }
  return out;
}

export async function fetchWithTimeout(url: string, init?: RequestInit, timeoutMs = 30_000): Promise<Response> {
  const ctl = new AbortController();
  const caller = init?.signal ?? undefined;
  const onAbort = () => ctl.abort();
  if (caller) {
    if (caller.aborted) ctl.abort();
    else caller.addEventListener("abort", onAbort, { once: true });
  }
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctl.signal });
  } finally {
    clearTimeout(t);
    caller?.removeEventListener("abort", onAbort);
  }
}
