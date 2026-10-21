// web/lib/research/collect.ts
// Orquestração da coleta do corpus (spec §5, F0–F2): descoberta (queries
// planejadas) -> dado do registro (BrasilAPI) -> leitura (candidatos ordenados).
// Os provedores são injetados (`search`/`read`): quem chama controla o pro-
// vedor real e os testes mockam. Tudo é resolvido no cliente — nada de servidor.
//
// Invariantes duros, forçados em código (o caller pode BAIXAR um teto, nunca subir):
// - teto de buscas e de leituras (crédito real do Tavily);
// - leitura que falha NUNCA entra no corpus (a URL só vai para `failures`);
// - URL descoberta e não lida não vira citação depois.
import { canonicalUrl, dedupeUrls, type ReadDoc, type SearchHit } from "./providers";
import { fetchCnpj, type CnpjData } from "./direct";
import { buildQueryPlan } from "./queries";
import type { DossierSection } from "@/lib/dossier-schema";
import type { BaseLang } from "@/lib/llm/prompts";

export const DEFAULT_MAX_SEARCHES = 22;
export const DEFAULT_MAX_READS = 15;

// Orçamento de leituras por bloco (F1): máximo 4 URLs por bloco.
const SECTION_READ_CAP = 4;
// Ordem de prioridade de leitura depois do site oficial (F1).
const READ_PRIORITY: DossierSection[] = ["reputacao", "contatos", "redes", "produtos", "lideranca", "historia"];

const OFFICIAL_QUERY_RE = /site oficial|official site|sitio oficial/;

// Agregadores/redes sociais não caracterizam o site oficial da empresa.
const AGGREGATOR_HOSTS = [
  "linkedin.com", "instagram.com", "facebook.com", "youtube.com", "github.com", "x.com",
  "twitter.com", "tiktok.com", "glassdoor.com", "indeed.com", "wikipedia.org", "wikidata.org",
  "reclameaqui.com.br", "jusbrasil.com.br", "medium.com", "reddit.com", "youtube.com.br",
];

export type SearchFn = (query: string) => Promise<SearchHit[]>;
export type ReadFn = (url: string) => Promise<ReadDoc>;

export type CollectOptions = {
  company: string;
  lang: BaseLang;
  cnpj?: string | null;
  maxSearches?: number; // default 22 — teto; o caller pode baixar, nunca subir
  maxReads?: number; // default 15 — teto; o caller pode baixar, nunca subir
  search: SearchFn;
  read: ReadFn;
  /** Cache de leituras. As chaves DEVEM ser URLs canônicas (`canonicalUrl(url)`);
   * chave crua (com `www.`, trailing `/`, `utm_*`) vira miss silencioso e re-gasta a leitura. */
  cache?: Map<string, ReadDoc>;
  onStage?: (stage: "search" | "read" | "official") => void;
};

export type CollectResult = {
  docs: ReadDoc[];
  /** Descoberta COMPLETA: inclui URLs nunca lidas e duplicatas. `docs` é o corpus (único
   * material citável); na hora de citar, restrinja a `docs` e canonize com `canonicalUrl`. */
  hits: SearchHit[];
  legal: CnpjData | null;
  /** CNPJ resolvido (14 dígitos) — digitado pelo usuário ou descoberto nas queries;
   * null quando não houve. Fonte oficial correspondente: https://brasilapi.com.br/api/cnpj/v1/<cnpj> */
  cnpj: string | null;
  searchesUsed: number;
  readsUsed: number;
  failures: { section: DossierSection | null; url: string; reason: string }[];
};

// D11 — validação de homônimo: tokens significativos = minúsculas, sem acento,
// sem sufixo societário e sem conectivos.
const IGNORABLE_TOKENS = new Set([
  // sufixos societários
  "ltda", "limitada", "sa", "me", "mei", "epp", "eireli", "inc", "corp", "corporation",
  "ltd", "llc", "plc", "gmbh", "sociedad", "sociedade", "anonima", "simples",
  // conectivos
  "de", "da", "do", "das", "dos", "e", "of", "the", "and",
]);

function significantTokens(name: string): string[] {
  const tokens = name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  const kept = tokens.filter((t) => !IGNORABLE_TOKENS.has(t) && t.length >= 2);
  return kept.length > 0 ? kept : tokens;
}

function sharesToken(company: string, razaoSocial: string | null): boolean {
  if (!razaoSocial) return false;
  const mine = new Set(significantTokens(company));
  return significantTokens(razaoSocial).some((t) => mine.has(t));
}

// F0 — combinações exatas do CNPJ formatado (um número colado em texto não
// deve engolir o vizinho) e, como fallback, corridas de dígitos puras de
// exatamente 14 (não recortes de números maiores).
const CNPJ_FORMATTED_RE = /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g;

function extractCnpjCandidates(texts: string[]): string[] {
  const found: string[] = [];
  const push = (digits: string) => {
    if (digits.length === 14 && !found.includes(digits)) found.push(digits);
  };
  for (const text of texts) {
    for (const m of text.matchAll(CNPJ_FORMATTED_RE)) push(m[0].replace(/\D/g, ""));
  }
  if (found.length === 0) {
    for (const text of texts) {
      // corridas de dígitos puras: separadas por QUAISQUER não-dígitos, sem
      // misturar números adjacentes (o espaço não cola "1 2024" em "12024").
      for (const m of text.matchAll(/\d+/g)) {
        if (m[0].length === 14) push(m[0]);
      }
    }
  }
  return found;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^(?:www\.|m\.)+/, "");
  } catch {
    return "";
  }
}

function isAggregatorHost(host: string): boolean {
  return AGGREGATOR_HOSTS.some((d) => host === d || host.endsWith(`.${d}`));
}

// O 1º hit da query "site oficial" pode ser diretório/rede social;
// pega o primeiro hit cujo host não é agregador, senão o 1º hit.
function pickOfficialDomain(officialHits: SearchHit[]): string {
  for (const hit of officialHits) {
    const host = hostOf(hit.url);
    if (host && !isAggregatorHost(host)) return host;
  }
  return officialHits.length > 0 ? hostOf(officialHits[0].url) : "";
}

function errorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return message.slice(0, 120);
}

export async function collectCompany(opts: CollectOptions): Promise<CollectResult> {
  // Teto é teto: caller pode baixar, nunca subir (crédito real do Tavily).
  const maxSearches = Math.min(opts.maxSearches ?? DEFAULT_MAX_SEARCHES, DEFAULT_MAX_SEARCHES);
  const maxReads = Math.min(opts.maxReads ?? DEFAULT_MAX_READS, DEFAULT_MAX_READS);
  const failures: { section: DossierSection | null; url: string; reason: string }[] = [];

  // 1. Estágio de descoberta.
  opts.onStage?.("search");
  const hits: SearchHit[] = [];
  const tagged: { hit: SearchHit; section: DossierSection }[] = [];
  const bySection = new Map<DossierSection, SearchHit[]>();
  let officialHits: SearchHit[] = [];
  let searchesUsed = 0;

  for (const item of buildQueryPlan(opts.company, opts.lang)) {
    if (searchesUsed >= maxSearches) break;
    // 2. CNPJ digitado pelo usuário: a query de CNPJ não gasta crédito.
    if (opts.cnpj && item.section === "cnpj") continue;
    // Variante de idioma: só gasta crédito quando a seção PT/ES ficou vazia.
    if (item.lang && (bySection.get(item.section)?.length ?? 0) > 0) continue;
    searchesUsed++;
    let found: SearchHit[];
    try {
      found = await opts.search(item.query);
    } catch {
      failures.push({ section: item.section, url: item.query, reason: "search" });
      continue;
    }
    hits.push(...found);
    for (const hit of found) tagged.push({ hit, section: item.section });
    // Base não consome cota de seção — só alimenta o passe de site oficial.
    if (!item.base) bySection.set(item.section, [...(bySection.get(item.section) ?? []), ...found]);
    // (a) hits da query "site oficial" definem o domínio do site oficial.
    if (officialHits.length === 0 && OFFICIAL_QUERY_RE.test(item.query)) officialHits = found;
  }

  // 4. Estágio oficial: CNPJ informado ou extraído dos hits do bloco cnpj.
  opts.onStage?.("official");
  let legal: CnpjData | null = null;
  let cnpj: string | null = null;
  if (opts.cnpj) {
    const digits = opts.cnpj.replace(/\D/g, "");
    if (digits.length === 14) {
      cnpj = digits;
      let data: CnpjData | null = null;
      let fetchFailed = false;
      try {
        data = await fetchCnpj(digits);
      } catch (err) {
        fetchFailed = true;
        failures.push({ section: "cnpj", url: "cnpj", reason: `official: ${errorMessage(err)}` });
      }
      if (data) legal = data;
      else if (!fetchFailed) failures.push({ section: "cnpj", url: "cnpj", reason: "not-found" });
    } else {
      // CNPJ digitado não fechou 14 dígitos — não vai ao registro.
      failures.push({ section: "cnpj", url: "cnpj", reason: "invalid" });
    }
  } else {
    const texts = (bySection.get("cnpj") ?? []).map((h) => `${h.title} ${h.snippet} ${h.url}`);
    const candidates = extractCnpjCandidates(texts);
    let sawHomonym = false;
    let sawNotFound = false;
    for (const cand of candidates) {
      let data: CnpjData | null = null;
      try {
        data = await fetchCnpj(cand);
      } catch (err) {
        failures.push({ section: "cnpj", url: "cnpj", reason: `official: ${errorMessage(err)}` });
        continue;
      }
      if (!data) {
        // 404 etc.: registro não existe para esse número; tenta o próximo.
        sawNotFound = true;
        continue;
      }
      if (sharesToken(opts.company, data.razaoSocial)) {
        legal = data;
        cnpj = cand;
        break;
      }
      // D11 — homônimo: tenta o próximo candidato antes de desistir.
      sawHomonym = true;
    }
    if (!cnpj) {
      failures.push({
        section: "cnpj",
        url: "cnpj",
        reason: candidates.length === 0 ? "no-digits" : sawHomonym ? "homonym" : "not-found",
      });
    }
  }

  // 6. Estágio de leitura: candidatos em ordem de prioridade com proveniência.
  opts.onStage?.("read");
  const officialDomain = pickOfficialDomain(officialHits);
  const candidates: { url: string; section: DossierSection }[] = [];
  if (officialDomain) {
    const officialTagged = tagged.filter((t) => hostOf(t.hit.url) === officialDomain);
    for (const t of officialTagged.slice(0, SECTION_READ_CAP)) {
      candidates.push({ url: t.hit.url, section: t.section });
    }
  }
  for (const section of READ_PRIORITY) {
    for (const hit of (bySection.get(section) ?? []).slice(0, SECTION_READ_CAP)) {
      candidates.push({ url: hit.url, section });
    }
  }

  const sectionOfUrl = new Map<string, DossierSection>();
  for (const c of candidates) {
    const k = canonicalUrl(c.url);
    if (!sectionOfUrl.has(k)) sectionOfUrl.set(k, c.section);
  }

  const docs: ReadDoc[] = [];
  let readsUsed = 0;
  for (const url of dedupeUrls(candidates.map((c) => c.url.trim()).filter(Boolean))) {
    const key = canonicalUrl(url);
    const section = sectionOfUrl.get(key) ?? null;
    const cached = opts.cache?.get(key);
    if (cached) {
      docs.push(cached); // cache não gasta leitura nem crédito.
      continue;
    }
    if (readsUsed >= maxReads) continue;
    readsUsed++;
    try {
      const doc = await opts.read(url);
      docs.push(doc);
      opts.cache?.set(key, doc);
    } catch (err) {
      failures.push({ section, url: key, reason: errorMessage(err) });
    }
  }

  return { docs, hits, legal, cnpj, searchesUsed, readsUsed, failures };
}
