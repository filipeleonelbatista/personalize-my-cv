// web/lib/dossier.ts
// Normalização do dossiê e invariante de evidência: o modelo só pode citar
// URLs que foram efetivamente lidas (o corpus). Cobertura é sempre computada
// aqui, nunca emitida pelo modelo.
import { DossierSchema, DOSSIER_SECTIONS, type Dossier, type DossierSection, type Evidence } from "./dossier-schema";
import { canonicalUrl } from "./research/providers";
import { MISSING_JOB } from "./pdf/i18n";
import type { BaseLang } from "./llm/prompts";

const LEGAL_SUFFIXES = new Set([
  "ltda", "limitada", "sa", "me", "mei", "eireli", "inc", "corp", "corporation", "ltd", "group",
]);

export function companyKey(name: string): string {
  // Remove pontos antes de tokenizar para que "S.A." vire "sa".
  const base = name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\./g, "");
  const tokens = base.replace(/[^\p{L}\p{N}]+/gu, " ").split(/\s+/).filter(Boolean);
  const kept = tokens.filter((t) => !LEGAL_SUFFIXES.has(t));
  const finalTokens = kept.length > 0 ? kept : tokens;
  return finalTokens.join("-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

export function isPlaceholderCompany(name: string, lang: BaseLang): boolean {
  return name.trim().toLowerCase() === MISSING_JOB[lang].empresa.toLowerCase();
}

function enumKey(v: unknown): string {
  return typeof v === "string"
    ? v.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase()
    : "";
}

export function normalizeSeverity(v: unknown): "high" | "medium" | "low" {
  const key = enumKey(v);
  if (key === "high" || key === "alta" || key === "alto") return "high";
  if (key === "low" || key === "baixa" || key === "baixo") return "low";
  return "medium";
}

export function normalizeKind(v: unknown): "rh" | "gestor" | "dpo" | "recrutador" | "executivo" | "other" {
  const key = enumKey(v);
  if (key === "rh" || key === "recrutador" || key === "recruiter" || key === "talent") return "rh";
  if (key === "gestor" || key === "manager" || key === "gerente") return "gestor";
  if (key === "dpo") return "dpo";
  if (key === "executivo" || key === "ceo" || key === "fundador") return "executivo";
  return "other";
}

export function normalizeVerdict(v: unknown): "vai" | "cautela" | "desistir" {
  const key = enumKey(v);
  if (key === "vai" || key === "go") return "vai";
  if (key === "cautela" || key === "caution") return "cautela";
  if (key === "desistir" || key === "no-go") return "desistir";
  return "cautela";
}

export function normalizeDate(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(v);
  if (!match) return null;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  if (match[3] === undefined) return v;
  const day = Number(match[3]);
  const daysInMonth = new Date(Date.UTC(Number(match[1]), month, 0)).getUTCDate();
  return day >= 1 && day <= daysInMonth ? v : null;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function withNormalizedDate(raw: unknown): Record<string, unknown> {
  const item = isRecord(raw) ? { ...raw } : {};
  return { ...item, date: normalizeDate(item.date) };
}

function withNormalizedEvidenceDates(v: unknown): unknown {
  return Array.isArray(v) ? v.map(withNormalizedDate) : v;
}

export function normalizeDossier(
  raw: unknown,
  envelope: {
    id: string;
    companyKey: string;
    company: string;
    lang: BaseLang;
    cnpj?: string | null;
    createdAt: string;
    updatedAt: string;
  },
): Dossier {
  const content: Record<string, unknown> = isRecord(raw) ? { ...raw } : {};

  if (isRecord(content.reputation)) {
    const reputation = content.reputation;
    content.reputation = {
      ...reputation,
      reviews: Array.isArray(reputation.reviews) ? reputation.reviews.map(withNormalizedDate) : reputation.reviews,
      redFlags: asArray(reputation.redFlags).map((rawFlag) => {
        const flag = isRecord(rawFlag) ? { ...rawFlag } : {};
        return {
          ...flag,
          severity: normalizeSeverity(flag.severity),
          evidence: withNormalizedEvidenceDates(flag.evidence),
        };
      }),
    };
  }

  if (isRecord(content.leadership) && isRecord(content.leadership.ceo)) {
    const ceo = content.leadership.ceo;
    content.leadership = {
      ...content.leadership,
      ceo: { ...ceo, highlights: withNormalizedEvidenceDates(ceo.highlights) },
    };
  }

  if (Array.isArray(content.products)) {
    content.products = content.products.map((rawProduct) => {
      const product = isRecord(rawProduct) ? { ...rawProduct } : {};
      return { ...product, evidence: withNormalizedEvidenceDates(product.evidence) };
    });
  }

  if (Array.isArray(content.contacts)) {
    content.contacts = content.contacts.map((rawContact) => {
      const contact = isRecord(rawContact) ? { ...rawContact } : {};
      return { ...contact, kind: normalizeKind(contact.kind) };
    });
  }

  return DossierSchema.parse({
    ...content,
    ...envelope,
    cnpj: envelope.cnpj ?? null,
    legal: {},
    status: "done",
    errorLog: "",
    // `coverage` e `sources` são escritos pelo código (D13), nunca pelo modelo.
    coverage: [],
    sources: [],
  });
}

function normalizeWords(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function nameAppearsInText(name: string, text: string): boolean {
  const needle = normalizeWords(name);
  if (!needle) return false;
  return ` ${normalizeWords(text)} `.includes(` ${needle} `);
}

function scrubEvidence(evidence: Evidence, corpus: Set<string>): Evidence {
  if (evidence.sourceUrl !== null) {
    if (corpus.has(canonicalUrl(evidence.sourceUrl))) {
      return { ...evidence, unsourced: false };
    }
    return { ...evidence, sourceUrl: null, unsourced: true };
  }
  return evidence.origin === "web" ? { ...evidence, unsourced: true } : { ...evidence };
}

export function applyEvidenceInvariant(d: Dossier, corpusUrls: string[], corpusText?: string): Dossier {
  const corpus = new Set(corpusUrls.map(canonicalUrl));

  const reputation = d.reputation ?? { reviews: [], redFlags: [] };
  const products = d.products ?? [];
  const contacts = d.contacts ?? [];
  const socials = d.socials ?? [];
  const ceo = d.leadership?.ceo ?? null;

  const redFlags = reputation.redFlags
    .map((flag) => ({ ...flag, evidence: flag.evidence.map((e) => scrubEvidence(e, corpus)) }))
    .filter((flag) => flag.evidence.some((e) => e.sourceUrl !== null));

  // Review só sobrevive com URL no corpus: material do usuário cita
  // `pmcv:material:<n>`, que entra no corpus como qualquer outra fonte.
  const reviews = reputation.reviews
    .filter((review) => review.sourceUrl !== null && corpus.has(canonicalUrl(review.sourceUrl)))
    .map((review) => ({ ...review }));

  const cleanContacts = contacts
    .map((contact) => {
      const url = contact.url !== null && !corpus.has(canonicalUrl(contact.url)) ? null : contact.url;
      return { ...contact, url, confidence: url === null ? "low" as const : contact.confidence };
    })
    .filter((contact) => corpusText === undefined || nameAppearsInText(contact.name, corpusText));

  const leadership = ceo
    ? { ceo: { ...ceo, highlights: ceo.highlights.map((e) => scrubEvidence(e, corpus)) } }
    : { ceo: null };

  const cleanSocials = socials.map((social) => ({
    ...social,
    url: social.url !== null && !corpus.has(canonicalUrl(social.url)) ? null : social.url,
    posts: social.posts.map((post) => ({
      ...post,
      url: post.url !== null && !corpus.has(canonicalUrl(post.url)) ? null : post.url,
    })),
  }));

  return {
    ...d,
    leadership,
    products: products.map((product) => ({
      ...product,
      evidence: product.evidence.map((e) => scrubEvidence(e, corpus)),
    })),
    reputation: { ...reputation, reviews, redFlags },
    contacts: cleanContacts,
    socials: cleanSocials,
  };
}

type CoverageStatus = Dossier["coverage"][number]["status"];

function hasText(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function computeCoverage(d: Dossier): Dossier["coverage"] {
  const history = d.history ?? { founded: null, timeline: [], mission: null, vision: null, values: [], summary: "" };
  const reputation = d.reputation ?? { reviews: [], redFlags: [] };
  const products = d.products ?? [];
  const socials = d.socials ?? [];
  const contacts = d.contacts ?? [];

  const statusFor = (section: DossierSection): CoverageStatus => {
    switch (section) {
      case "historia": {
        const parts = [
          hasText(history.founded),
          history.timeline.length > 0,
          hasText(history.mission),
          hasText(history.vision),
          history.values.length > 0,
          hasText(history.summary),
        ];
        const filled = parts.filter(Boolean).length;
        return filled === 0 ? "ausente" : filled === parts.length ? "ok" : "parcial";
      }
      case "lideranca":
        return d.leadership?.ceo == null ? "ausente" : "ok";
      case "produtos":
        if (products.length === 0) return "ausente";
        return products.some((product) => product.evidence.length === 0) ? "parcial" : "ok";
      case "reputacao": {
        const { reviews, redFlags } = reputation;
        if (reviews.length === 0 && redFlags.length === 0) return "ausente";
        // Depois do invariante toda review restante tem URL no corpus.
        const hasValidEvidence =
          reviews.some((review) => review.sourceUrl !== null) ||
          redFlags.some((flag) => flag.evidence.some((e) => e.sourceUrl !== null));
        return hasValidEvidence ? "ok" : "parcial";
      }
      case "contatos":
        if (contacts.length === 0) return "ausente";
        return contacts.length < 5 ? "parcial" : "ok";
      case "redes":
        if (socials.length === 0) return "ausente";
        return socials.some((social) => social.posts.length === 0) ? "parcial" : "ok";
      case "cnpj":
        return d.legal?.razaoSocial == null && d.legal?.openedAt == null ? "ausente" : "ok";
    }
  };

  return DOSSIER_SECTIONS.map((section) => ({ section, status: statusFor(section) }));
}
