import { canonicalUrl, fetchWithTimeout, type SearchHit } from "./providers";

export async function tavilySearch(query: string, key: string, opts: { maxResults?: number; rawContent?: boolean } = {}): Promise<SearchHit[]> {
  const res = await fetchWithTimeout("https://api.tavily.com/search", {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      query,
      max_results: opts.maxResults ?? 8,
      search_depth: "basic",
      include_raw_content: opts.rawContent ?? false,
      include_published_date: true,
      topic: "general",
    }),
  });
  if (!res.ok) throw new Error(`tavily ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { results?: { url?: string; title?: string; content?: string; published_date?: string | null }[] };
  return (json.results ?? [])
    .filter((r) => typeof r.url === "string" && r.url)
    .map((r) => ({
      url: canonicalUrl(r.url as string),
      title: r.title ?? "",
      snippet: r.content ?? "",
      publishedAt: r.published_date ?? null,
    }));
}
