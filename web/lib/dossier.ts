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

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
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
      redFlags: asArray(reputation.redFlags).map((rawFlag) => {
        const flag = isRecord(rawFlag) ? { ...rawFlag } : {};
        return { ...flag, severity: normalizeSeverity(flag.severity) };
      }),
    };
  }

  if (Array.isArray(content.contacts)) {
    content.contacts = content.contacts.map((rawContact) => {
      const contact = isRecord(rawContact) ? { ...rawContact } : {};
      return { ...contact, kind: normalizeKind(contact.kind) };
    });
  }

  // `alignment` não faz parte de `Dossier`, mas o plano manda normalizar o
  // veredito antes do parse; mantém a normalização para chamadas futuras.
  if (isRecord(content.alignment)) {
    content.alignment = { ...content.alignment, verdict: normalizeVerdict(content.alignment.verdict) };
  }

  return DossierSchema.parse({
    ...content,
    ...envelope,
    cnpj: envelope.cnpj ?? null,
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
  const ceo = d.leadership?.ceo ?? null;

  const redFlags = reputation.redFlags
    .map((flag) => ({ ...flag, evidence: flag.evidence.map((e) => scrubEvidence(e, corpus)) }))
    .filter((flag) => flag.evidence.some((e) => e.sourceUrl !== null || e.origin === "user"));

  // Review só sobrevive sem URL (material colado pelo usuário) ou com URL no corpus.
  const reviews = reputation.reviews
    .filter((review) => review.sourceUrl === null || corpus.has(canonicalUrl(review.sourceUrl)))
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

  return {
    ...d,
    leadership,
    products: products.map((product) => ({
      ...product,
      evidence: product.evidence.map((e) => scrubEvidence(e, corpus)),
    })),
    reputation: { ...reputation, reviews, redFlags },
    contacts: cleanContacts,
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
        // Depois do invariante toda review restante é válida: ou tem URL no
        // corpus, ou é material do usuário (sourceUrl null, mantido de propósito).
        const hasValidEvidence =
          reviews.length > 0 ||
          redFlags.some((flag) => flag.evidence.some((e) => e.sourceUrl !== null || e.origin === "user"));
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
