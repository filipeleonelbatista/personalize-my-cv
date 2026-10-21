import { canonicalUrl, fetchWithTimeout, type SearchHit } from "./providers";

export const BRAVE_ENABLED = false;

export async function braveSearch(query: string, key: string): Promise<SearchHit[]> {
  if (!BRAVE_ENABLED) throw new Error("brave-cors-not-supported");
  const res = await fetchWithTimeout(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=8&country=BR&search_lang=pt`, { headers: { "X-Subscription-Token": key, Accept: "application/json" } });
  if (!res.ok) throw new Error(`brave ${res.status}`);
  const json = (await res.json()) as { web?: { results?: { url?: string; title?: string; description?: string; page_age?: string }[] } };
  return (json.web?.results ?? []).filter((r) => r.url).map((r) => ({ url: canonicalUrl(r.url as string), title: r.title ?? "", snippet: r.description ?? "", publishedAt: r.page_age ?? null }));
}
