// web/lib/research/collect.ts
// Orquestração da coleta do corpus (spec §5, F0–F2): descoberta (queries
// planejadas) -> dado do registro (BrasilAPI) -> leitura (candidatos ordenados).
// Os provedores são injetados (`search`/`read`): quem chama controla o pro-
// vedor real e os testes mockam. Tudo é resolvido no cliente — nada de servidor.
//
// Invariantes duros, forçados em código:
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

export type SearchFn = (query: string) => Promise<SearchHit[]>;
export type ReadFn = (url: string) => Promise<ReadDoc>;

export type CollectOptions = {
  company: string;
  lang: BaseLang;
  cnpj?: string | null;
  maxSearches?: number; // default 22
  maxReads?: number; // default 15
  search: SearchFn;
  read: ReadFn;
  cache?: Map<string, ReadDoc>;
  onStage?: (stage: "search" | "read" | "official") => void;
};

export type CollectResult = {
  docs: ReadDoc[];
  hits: SearchHit[];
  legal: CnpjData | null;
  searchesUsed: number;
  readsUsed: number;
  failures: { url: string; reason: string }[];
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

// F0 — extrai um CNPJ (14 dígitos) dos hits do bloco `cnpj`.
function extractCnpjDigits(texts: string[]): string | null {
  for (const text of texts) {
    const chunks = text.match(/\d[\d.,\s/?-]*\d/g) ?? [];
    for (const chunk of chunks) {
      const digits = chunk.replace(/\D/g, "");
      if (digits.length === 14) return digits;
    }
  }
  return null;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^(?:www\.|m\.)+/, "");
  } catch {
    return "";
  }
}

function errorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return message.slice(0, 120);
}

export async function collectCompany(opts: CollectOptions): Promise<CollectResult> {
  const maxSearches = opts.maxSearches ?? DEFAULT_MAX_SEARCHES;
  const maxReads = opts.maxReads ?? DEFAULT_MAX_READS;
  const failures: { url: string; reason: string }[] = [];

  // 1. Estágio de descoberta.
  opts.onStage?.("search");
  const hits: SearchHit[] = [];
  const bySection = new Map<DossierSection, SearchHit[]>();
  let officialHits: SearchHit[] = [];
  let searchesUsed = 0;

  for (const item of buildQueryPlan(opts.company, opts.lang)) {
    if (searchesUsed >= maxSearches) break;
    // 2. CNPJ digitado pelo usuário: a query de CNPJ não gasta crédito.
    if (opts.cnpj && item.section === "cnpj") continue;
    searchesUsed++;
    let found: SearchHit[];
    try {
      found = await opts.search(item.query);
    } catch {
      failures.push({ url: item.query, reason: "search" });
      continue;
    }
    hits.push(...found);
    bySection.set(item.section, [...(bySection.get(item.section) ?? []), ...found]);
    // (a) domínio do site oficial = host do 1º hit da query "site oficial".
    if (officialHits.length === 0 && OFFICIAL_QUERY_RE.test(item.query)) officialHits = found;
  }

  // 4. Estágio oficial: CNPJ informado ou extraído dos hits do bloco cnpj.
  opts.onStage?.("official");
  let legal: CnpjData | null = null;
  const informed = opts.cnpj ?? null;
  const cnpj = informed ?? extractCnpjDigits((bySection.get("cnpj") ?? []).map((h) => `${h.title} ${h.snippet} ${h.url}`));
  if (cnpj && cnpj.replace(/\D/g, "").length === 14) {
    try {
      legal = await fetchCnpj(cnpj.replace(/\D/g, ""));
    } catch (err) {
      legal = null;
      failures.push({ url: "cnpj", reason: `official: ${errorMessage(err)}` });
    }
  }
  // 5. D11 — homônimo: só valida quando o CNPJ NÃO vem do usuário.
  if (legal && !informed && !sharesToken(opts.company, legal.razaoSocial)) {
    legal = null;
    failures.push({ url: "cnpj", reason: "homonym" });
  }

  // 6. Estágio de leitura: candidatos em ordem de prioridade.
  opts.onStage?.("read");
  const officialDomain = officialHits.length > 0 ? hostOf(officialHits[0].url) : "";
  const candidates: SearchHit[] = [
    ...hits.filter((h) => officialDomain && hostOf(h.url) === officialDomain).slice(0, SECTION_READ_CAP),
  ];
  for (const section of READ_PRIORITY) {
    candidates.push(...(bySection.get(section) ?? []).slice(0, SECTION_READ_CAP));
  }

  const docs: ReadDoc[] = [];
  let readsUsed = 0;
  for (const url of dedupeUrls(candidates.map((h) => h.url.trim()).filter(Boolean))) {
    const key = canonicalUrl(url);
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
      failures.push({ url: key, reason: errorMessage(err) });
    }
  }

  return { docs, hits, legal, searchesUsed, readsUsed, failures };
}
