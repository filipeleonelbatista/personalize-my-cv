// web/lib/dossier-client.ts
// Orquestrador do dossiê: coleta (determinística) -> síntese (2 chamadas Gemini)
// -> invariante de evidência -> cobertura. Tudo no cliente; nenhum dado sai do
// browser além das chamadas BYOK aos provedores.
import {
  DossierMatchSchema,
  DossierSchema,
  type Dossier,
  type DossierMatch,
  type SourceRef,
} from "@/lib/dossier-schema";
import {
  applyEvidenceInvariant,
  companyKey,
  computeCoverage,
  normalizeDossier,
  normalizeVerdict,
} from "@/lib/dossier";
import { collectCompany } from "@/lib/research/collect";
import { getDossierResearchConfig, isDossierEnabled } from "@/lib/research/config";
import { canonicalUrl, dedupeUrls, type ReadDoc } from "@/lib/research/providers";
import { jinaRead, parseReaderMeta } from "@/lib/research/jina";
import { tavilySearch } from "@/lib/research/tavily";
import {
  buildDossierSystem,
  buildDossierUser,
  buildMatchSystem,
  buildMatchUser,
  buildRepairUser,
  type BaseLang,
} from "@/lib/llm/prompts";
import { generateJsonLong } from "@/lib/llm/chain";
import {
  findDossierByCompany,
  loadApps,
  loadDossiers,
  loadReadCache,
  loadSettings,
  saveApps,
  saveReadCache,
  upsertDossier,
  type ReadCacheEntry,
  type Settings,
  type StoredApp,
} from "@/lib/store";
import { getLocale, tErr, type UiLocale } from "@/lib/i18n/locale";

export type DossierStage = "search" | "read" | "official" | "synthesize" | "match";

export type DossierJobResult =
  | { ok: true; dossier: Dossier; match: DossierMatch | null }
  | { ok: false; error: string; dossier: Dossier | null };

const CORPUS_DOC_CHARS = 1200;
const READ_CACHE_MAX_BYTES = 150 * 1024;
const READ_CACHE_ENTRY_MAX_CHARS = 40_000;
const READ_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_SOURCES = 40;

const DOSSIER_CALL_A_KEYS = ["history", "leadership", "products"] as const;
const DOSSIER_CALL_B_KEYS = ["reputation", "contacts", "socials"] as const;

type Envelope = {
  id: string;
  companyKey: string;
  company: string;
  lang: BaseLang;
  cnpj: string | null;
  createdAt: string;
  updatedAt: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

function emptyLegal(): Dossier["legal"] {
  return { razaoSocial: null, nomeFantasia: null, openedAt: null, cnae: null, porte: null, capitalSocial: null, partners: [] };
}

function errorText(err: unknown): string {
  return String(err instanceof Error ? err.message : err).slice(0, 1000);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pickKeys(raw: unknown, keys: readonly string[]): Record<string, unknown> {
  const source = isRecord(raw) ? raw : {};
  const out: Record<string, unknown> = {};
  for (const key of keys) if (key in source) out[key] = source[key];
  return out;
}

/** Fontes = documentos realmente lidos, deduplicados por URL canônica. */
export function buildSources(docs: ReadDoc[]): SourceRef[] {
  const retrievedAt = nowIso();
  const seen = new Set<string>();
  const out: SourceRef[] = [];
  for (const doc of docs) {
    const url = canonicalUrl(doc.url);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push({ url, title: doc.title, publishedAt: doc.publishedAt, retrievedAt, provider: doc.provider });
  }
  return out.slice(0, MAX_SOURCES);
}

/** Corpus enviado ao modelo: cabeçalho `title | url | publishedAt` + trecho. */
export function buildCorpus(docs: ReadDoc[]): string {
  if (docs.length === 0) return "(sem documentos)";
  return docs
    .map((doc) => {
      const header = `${doc.title} | ${doc.url} | ${doc.publishedAt ?? "null"}`;
      return `${header}\n${doc.content.slice(0, CORPUS_DOC_CHARS)}`;
    })
    .join("\n\n---\n\n");
}

const URL_IN_TEXT = /https?:\/\/[^\s<>"'`]+/gi;

function urlsInText(text: string): string[] {
  return (text.match(URL_IN_TEXT) ?? [])
    .map((raw) => raw.replace(/[.,;:!?*_)\]}"']+$/, ""))
    .filter(Boolean);
}

/** Corpus citável = URLs de TODOS os docs lidos + URLs que aparecem no texto
 * lido (deep links legítimos, como um vídeo do YouTube citado na página). Não
 * usa apenas `sources`, que tem teto de 40. */
function corpusUrls(docs: ReadDoc[], sources: SourceRef[]): string[] {
  return dedupeUrls([
    ...docs.map((doc) => canonicalUrl(doc.url)),
    ...sources.map((source) => source.url),
    ...docs.flatMap((doc) => [...urlsInText(doc.title), ...urlsInText(doc.content)]),
  ]);
}

/** Texto integral do que foi lido — o filtro de contatos exige que o nome da
 * pessoa exista no material lido, não apenas no trecho enviado ao modelo. */
function corpusText(docs: ReadDoc[]): string {
  return docs.map((doc) => `${doc.title}\n${doc.content}`).join("\n\n");
}

function readCacheMap(): Map<string, ReadDoc> {
  const now = Date.now();
  const map = new Map<string, ReadDoc>();
  for (const entry of loadReadCache()) {
    const fetched = Date.parse(entry.fetchedAt);
    if (Number.isFinite(fetched) && now - fetched > READ_CACHE_TTL_MS) continue;
    const meta = parseReaderMeta(entry.content);
    map.set(canonicalUrl(entry.url), {
      url: canonicalUrl(entry.url),
      title: meta.title,
      publishedAt: entry.publishedAt,
      content: entry.content,
      provider: "jina",
    });
  }
  return map;
}

/** Reconstrói os `docs` do retry a partir do readcache, cobrindo exatamente as
 * `sources` do dossiê que falhou. `null` = cache não cobre tudo (aí sim vale
 * refazer a coleta). */
function docsFromSources(sources: SourceRef[]): ReadDoc[] | null {
  if (sources.length === 0) return null;
  const cache = readCacheMap();
  const docs: ReadDoc[] = [];
  for (const source of sources) {
    const cached = cache.get(canonicalUrl(source.url));
    if (!cached) return null;
    docs.push({
      ...cached,
      title: cached.title || source.title,
      publishedAt: cached.publishedAt ?? source.publishedAt,
    });
  }
  return docs;
}

/** Grava o cache de leitura respeitando o teto de 150 KB (mantém os mais
 * recentes), o TTL de 7 dias e um teto por entrada. Entradas que não couberem
 * são puladas (não interrompem as mais antigas e menores). Best-effort: falha
 * de cache não invalida o dossiê já sintetizado. */
function persistReadCache(docs: ReadDoc[]): void {
  try {
    const now = Date.now();
    const fetchedAt = new Date(now).toISOString();
    const merged = new Map<string, ReadCacheEntry>();
    for (const entry of loadReadCache()) {
      const url = canonicalUrl(entry.url);
      merged.set(url, { ...entry, url, content: entry.content.slice(0, READ_CACHE_ENTRY_MAX_CHARS) });
    }
    for (const doc of docs) {
      const url = canonicalUrl(doc.url);
      merged.set(url, {
        url,
        content: doc.content.slice(0, READ_CACHE_ENTRY_MAX_CHARS),
        publishedAt: doc.publishedAt,
        fetchedAt,
      });
    }
    const sorted = [...merged.values()]
      .filter((entry) => {
        const fetched = Date.parse(entry.fetchedAt);
        return !Number.isFinite(fetched) || now - fetched <= READ_CACHE_TTL_MS;
      })
      .sort((a, b) => (Date.parse(b.fetchedAt) || 0) - (Date.parse(a.fetchedAt) || 0));

    const kept: ReadCacheEntry[] = [];
    let bytes = 2; // "[]"
    for (const entry of sorted) {
      const size = JSON.stringify(entry).length + 1; // + vírgula
      if (bytes + size > READ_CACHE_MAX_BYTES) continue;
      kept.push(entry);
      bytes += size;
    }
    saveReadCache(kept);
  } catch {
    /* cache é best-effort */
  }
}

async function synthesize(params: {
  company: string;
  key: string;
  lang: BaseLang;
  cnpj: string | null;
  legal: Dossier["legal"];
  docs: ReadDoc[];
  sources: SourceRef[];
  settings: Settings;
  locale: UiLocale;
}): Promise<Dossier> {
  const createdAt = nowIso();
  const envelope: Envelope = {
    id: `dsr_${params.key}`,
    companyKey: params.key,
    company: params.company,
    lang: params.lang,
    cnpj: params.cnpj,
    createdAt,
    updatedAt: createdAt,
  };

  const corpus = buildCorpus(params.docs);
  const system = buildDossierSystem(params.lang);
  const callA = await generateJsonLong(
    system,
    `${buildDossierUser(corpus)}\n\nRetorne SOMENTE as chaves history, leadership e products.`,
    params.settings.geminiKey,
    params.settings.models,
    params.locale,
    2,
  );
  const callB = await generateJsonLong(
    system,
    `${buildDossierUser(corpus)}\n\nRetorne SOMENTE as chaves reputation, contacts e socials.`,
    params.settings.geminiKey,
    params.settings.models,
    params.locale,
    2,
  );
  const merged = {
    ...pickKeys(callA.data, DOSSIER_CALL_A_KEYS),
    ...pickKeys(callB.data, DOSSIER_CALL_B_KEYS),
  };

  let dossier: Dossier;
  try {
    dossier = normalizeDossier(merged, envelope);
  } catch (err) {
    // Uma única tentativa de reparo: mesmo padrão de `lib/tailor-client.ts`.
    const repaired = await generateJsonLong(
      system,
      buildRepairUser(JSON.stringify(merged), errorText(err)),
      params.settings.geminiKey,
      params.settings.models,
      params.locale,
      2,
    );
    dossier = normalizeDossier(repaired.data, envelope);
  }

  dossier = {
    ...dossier,
    legal: params.legal,
    sources: params.sources,
    status: "done",
    errorLog: "",
  };
  dossier = applyEvidenceInvariant(dossier, corpusUrls(params.docs, params.sources), corpusText(params.docs));
  return { ...dossier, coverage: computeCoverage(dossier) };
}

function buildFailedDossier(
  base: Envelope,
  legal: Dossier["legal"],
  sources: SourceRef[],
  err: unknown,
): Dossier | null {
  try {
    return DossierSchema.parse({
      ...base,
      legal,
      coverage: [],
      sources,
      status: "failed",
      errorLog: errorText(err),
    });
  } catch {
    return null;
  }
}

async function synthesizeAndStore(params: {
  base: Envelope;
  legal: Dossier["legal"];
  docs: ReadDoc[];
  sources: SourceRef[];
  settings: Settings;
  locale: UiLocale;
  onStage?: (stage: DossierStage) => void;
  /** Um dossiê `done` existente não é substituído por um `failed`. */
  preserveExistingOnFailure?: boolean;
}): Promise<DossierJobResult> {
  params.onStage?.("synthesize");
  try {
    const dossier = await synthesize({
      company: params.base.company,
      key: params.base.companyKey,
      lang: params.base.lang,
      cnpj: params.base.cnpj,
      legal: params.legal,
      docs: params.docs,
      sources: params.sources,
      settings: params.settings,
      locale: params.locale,
    });
    upsertDossier(dossier);
    persistReadCache(params.docs);
    return { ok: true, dossier, match: null };
  } catch (err) {
    // O que já foi lido é preservado para o retry não refazer as buscas.
    if (params.docs.length > 0) persistReadCache(params.docs);
    const failed = params.preserveExistingOnFailure
      ? null
      : buildFailedDossier(params.base, params.legal, params.sources, err);
    if (failed) upsertDossier(failed);
    return { ok: false, error: tErr(params.locale, "dossierFailed"), dossier: failed };
  }
}

export async function runDossierJob(opts: {
  company: string;
  cnpj?: string | null;
  lang: BaseLang;
  force?: boolean;
  locale?: UiLocale;
  onStage?: (stage: DossierStage) => void;
}): Promise<DossierJobResult> {
  const locale = opts.locale ?? getLocale();
  if (!isDossierEnabled()) {
    return { ok: false, error: tErr(locale, "dossierDisabled"), dossier: null };
  }
  const key = companyKey(opts.company);
  const existing = findDossierByCompany(key);
  if (existing && existing.status === "done" && opts.force !== true) {
    return { ok: true, dossier: existing, match: null };
  }

  const settings = loadSettings();
  const research = getDossierResearchConfig();
  if (!settings.geminiKey.trim()) {
    return { ok: false, error: tErr(locale, "noKey"), dossier: null };
  }

  const createdAt = nowIso();

  // Retry de uma síntese que falhou: re-sintetiza do readcache, sem refazer as
  // buscas (que custam crédito). Só cai para `collectCompany` se o cache não
  // cobrir todas as URLs já lidas.
  if (existing?.status === "failed" && opts.force !== true) {
    const cachedDocs = docsFromSources(existing.sources);
    if (cachedDocs) {
      const base: Envelope = {
        id: existing.id,
        companyKey: key,
        company: opts.company,
        lang: opts.lang,
        cnpj: existing.cnpj ?? opts.cnpj ?? null,
        createdAt,
        updatedAt: createdAt,
      };
      return synthesizeAndStore({
        base,
        legal: existing.legal,
        docs: cachedDocs,
        sources: existing.sources,
        settings,
        locale,
        onStage: opts.onStage,
      });
    }
  }

  const base: Envelope = {
    id: `dsr_${key}`,
    companyKey: key,
    company: opts.company,
    lang: opts.lang,
    cnpj: opts.cnpj ?? null,
    createdAt,
    updatedAt: createdAt,
  };
  let sources: SourceRef[] = [];
  let docs: ReadDoc[] = [];
  let legal = emptyLegal();

  try {
    const collected = await collectCompany({
      company: opts.company,
      lang: opts.lang,
      cnpj: opts.cnpj,
      search: (query) => tavilySearch(query, research.tavilyKey),
      read: (url) => jinaRead(url, research.jinaKey),
      cache: readCacheMap(),
      onStage: (stage) => opts.onStage?.(stage),
    });

    docs = collected.docs;
    sources = buildSources(docs);
    base.cnpj = collected.cnpj ?? opts.cnpj ?? null;
    legal = collected.legal ?? emptyLegal();

    return await synthesizeAndStore({
      base,
      legal,
      docs,
      sources,
      settings,
      locale,
      onStage: opts.onStage,
    });
  } catch (err) {
    if (docs.length > 0) persistReadCache(docs);
    const failed = buildFailedDossier(base, legal, sources, err);
    if (failed) upsertDossier(failed);
    return { ok: false, error: tErr(locale, "dossierFailed"), dossier: failed };
  }
}

export async function runDossierFromDocs(opts: {
  company: string;
  lang: BaseLang;
  docs: ReadDoc[];
  locale?: UiLocale;
  onStage?: (stage: DossierStage) => void;
}): Promise<DossierJobResult> {
  const locale = opts.locale ?? getLocale();
  if (!isDossierEnabled()) {
    return { ok: false, error: tErr(locale, "dossierDisabled"), dossier: null };
  }
  const key = companyKey(opts.company);
  const settings = loadSettings();
  const existing = findDossierByCompany(key);
  const createdAt = nowIso();
  const base: Envelope = {
    id: `dsr_${key}`,
    companyKey: key,
    company: opts.company,
    lang: opts.lang,
    cnpj: existing?.cnpj ?? null,
    createdAt,
    updatedAt: createdAt,
  };
  const legal = existing?.legal ?? emptyLegal();
  const sources = buildSources(opts.docs);

  return synthesizeAndStore({
    base,
    legal,
    docs: opts.docs,
    sources,
    settings,
    locale,
    onStage: opts.onStage,
    preserveExistingOnFailure: existing?.status === "done",
  });
}

export async function runDossierMatch(
  app: StoredApp,
  locale: UiLocale = getLocale(),
): Promise<{ ok: true; match: DossierMatch } | { ok: false; error: string }> {
  if (!isDossierEnabled()) {
    return { ok: false, error: tErr(locale, "dossierDisabled") };
  }
  const dossier =
    (app.dossierId ? loadDossiers().find((item) => item.id === app.dossierId) ?? null : null) ??
    findDossierByCompany(companyKey(app.empresa));
  if (!dossier) return { ok: false, error: tErr(locale, "notFound") };

  const settings = loadSettings();
  const payload = JSON.stringify({ dossier, jobText: app.jobText, resume: app.resume, cargo: app.cargo });
  try {
    const { data } = await generateJsonLong(
      buildMatchSystem(app.lang),
      buildMatchUser(payload),
      settings.geminiKey,
      settings.models,
      locale,
      2,
    );
    const raw = isRecord(data) ? data : {};
    const alignment = isRecord(raw.alignment)
      ? { ...raw.alignment, verdict: normalizeVerdict(raw.alignment.verdict) }
      : raw.alignment;
    const now = nowIso();
    const match = DossierMatchSchema.parse({
      ...raw,
      dossierId: dossier.id,
      appId: app.id,
      lang: app.lang,
      alignment,
      stale: false,
      createdAt: now,
      updatedAt: now,
    });
    saveApps(loadApps().map((item) => (item.id === app.id ? { ...item, dossierId: dossier.id, dossierMatch: match } : item)));
    return { ok: true, match };
  } catch (err) {
    // O toast recebe uma chave; o detalhe técnico fica no errorLog da candidatura.
    const errorLog = errorText(err);
    saveApps(loadApps().map((item) => (item.id === app.id ? { ...item, errorLog } : item)));
    return { ok: false, error: tErr(locale, "dossierFailed") };
  }
}
