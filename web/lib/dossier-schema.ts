// web/lib/dossier-schema.ts
// Modelo de dados do dossiê de empresa — blocos copiados literalmente da spec
// §4.1 (literais de enum persistidos em código; rótulos humanos ficam na i18n).
import { z } from "zod";

export const SourceRefSchema = z.object({
  url: z.string().min(1),
  title: z.string().default(""),
  publishedAt: z.string().nullable().default(null),   // "YYYY-MM" | "YYYY-MM-DD" | null
  retrievedAt: z.string(),
  provider: z.enum(["tavily", "brave", "jina", "direct", "user"]),
});

export const EvidenceSchema = z.object({
  claim: z.string().min(1),
  sourceUrl: z.string().nullable().default(null),     // null = sem fonte verificável
  sourceTitle: z.string().default(""),
  date: z.string().nullable().default(null),
  quote: z.string().default(""),
  origin: z.enum(["web", "user"]).default("web"),     // "user" = material colado pelo usuário
  unsourced: z.boolean().default(false),              // true = o modelo inventou a URL; foi removida
});

export const RedFlagSchema = z.object({
  severity: z.enum(["high", "medium", "low"]),        // literais em inglês no código; rótulo via i18n
  category: z.enum(["processo_trabalhista", "cultura", "financeiro", "produto", "reputacao", "outro"]),
  title: z.string().min(1),
  detail: z.string().default(""),
  date: z.string().nullable().default(null),
  evidence: z.array(EvidenceSchema).default([]),
  mitigation: z.string().nullable().default(null),
});

export const ReviewSchema = z.object({
  source: z.enum(["glassdoor", "linkedin", "jusbrasil", "reclameaqui", "indeed", "reddit", "other"]),
  sentiment: z.enum(["pro", "contra", "neutro"]),
  topic: z.string().default(""),        // sobre o que o processo/reclamação tratava
  date: z.string().nullable().default(null),
  quote: z.string().default(""),
  sourceUrl: z.string().nullable().default(null),
});

export const ContactSchema = z.object({
  name: z.string().min(1),
  role: z.string().default(""),
  kind: z.enum(["rh", "gestor", "dpo", "recrutador", "executivo", "other"]),
  channel: z.enum(["linkedin", "email", "telefone", "site", "other"]),
  url: z.string().nullable().default(null),
  hint: z.string().default(""),           // por que abordar essa pessoa
  confidence: z.enum(["high", "medium", "low"]).default("medium"),
});

export const SocialPostSchema = z.object({
  date: z.string().nullable().default(null),
  text: z.string().default(""),
  url: z.string().nullable().default(null),
});

export const SocialSchema = z.object({
  network: z.enum(["linkedin", "instagram", "youtube", "x", "facebook", "github", "tiktok", "other"]),
  handle: z.string().nullable().default(null),
  url: z.string().nullable().default(null),
  tone: z.string().default(""),           // tom de comunicação da rede
  posts: z.array(SocialPostSchema).max(5).default([]),
});

export const ProductSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  customerSignal: z.string().default(""),  // como os clientes qualificam o produto
  evidence: z.array(EvidenceSchema).default([]),
});

export const DossierSchema = z.object({
  id: z.string().min(1),                  // "dsr_" + companyKey (determinístico)
  companyKey: z.string().min(1),          // slug normalizado
  company: z.string().min(1),
  cnpj: z.string().nullable().default(null),
  lang: z.enum(["pt-BR", "en", "es"]),
  status: z.enum(["done", "failed"]).default("done"),
  errorLog: z.string().default(""),
  legal: z.object({
    razaoSocial: z.string().nullable().default(null),
    nomeFantasia: z.string().nullable().default(null),
    openedAt: z.string().nullable().default(null),
    cnae: z.string().nullable().default(null),
    porte: z.string().nullable().default(null),
    capitalSocial: z.string().nullable().default(null),
    partners: z.array(z.object({
      name: z.string(),
      role: z.string().default(""),
      since: z.string().nullable().default(null),
    })).max(20).default([]),
  }).default({}),
  history: z.object({
    founded: z.string().nullable().default(null),
    timeline: z.array(z.object({ year: z.string(), event: z.string() })).max(10).default([]),
    mission: z.string().nullable().default(null),
    vision: z.string().nullable().default(null),
    values: z.array(z.string()).max(10).default([]),
    summary: z.string().default(""),
  }).default({}),
  leadership: z.object({
    ceo: z.object({
      name: z.string(),
      role: z.string().default(""),
      bio: z.string().default(""),
      highlights: z.array(EvidenceSchema).max(10).default([]),
    }).nullable().default(null),
  }).default({}),
  products: z.array(ProductSchema).max(3).default([]),
  reputation: z.object({
    reviews: z.array(ReviewSchema).max(20).default([]),
    redFlags: z.array(RedFlagSchema).max(12).default([]),
  }).default({}),
  contacts: z.array(ContactSchema).max(8).default([]),
  socials: z.array(SocialSchema).max(8).default([]),
  coverage: z.array(z.object({
    section: z.enum(["historia", "lideranca", "produtos", "reputacao", "contatos", "redes", "cnpj"]),
    status: z.enum(["ok", "parcial", "ausente"]),
  })).default([]),
  sources: z.array(SourceRefSchema).max(40).default([]),   // escrito pelo código (D13)
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const DossierMatchSchema = z.object({
  dossierId: z.string().min(1),
  appId: z.string().min(1),
  lang: z.enum(["pt-BR", "en", "es"]),
  alignment: z.object({
    score: z.number().int().min(0).max(100),
    verdict: z.enum(["vai", "cautela", "desistir"]),
    dimensions: z.array(z.object({
      key: z.enum(["cultura", "produto", "processo", "gestao", "setor", "cargo"]),
      score: z.number().int().min(0).max(100),
      note: z.string().default(""),
    })).max(6).default([]),
  }),
  attentionPoints: z.array(z.string()).max(10).default([]),
  correlations: z.array(z.object({
    theme: z.string(),
    theirs: z.string(),
    mine: z.string(),
  })).max(10).default([]),
  gaps: z.array(z.string()).max(10).default([]),
  questions: z.array(z.object({
    question: z.string(),
    why: z.string().default(""),
    sourceUrl: z.string().nullable().default(null),
  })).max(8).default([]),
  outreach: z.array(z.object({
    target: z.string(),
    role: z.string().default(""),
    goal: z.enum(["rh", "gestor", "indicacao", "cargo"]),
    channel: z.enum(["linkedin", "email", "telefone", "site", "other"]),
    angle: z.string().default(""),
    message: z.string().default(""),
    sourceUrl: z.string().nullable().default(null),
  })).max(5).default([]),
  redFlagSummary: z.array(z.string()).max(10).default([]),
  sources: z.array(z.string()).max(40).default([]),
  stale: z.boolean().default(false),       // true quando o dossiê foi atualizado depois
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const DOSSIER_SECTIONS = ["historia", "lideranca", "produtos", "reputacao", "contatos", "redes", "cnpj"] as const;
export type DossierSection = (typeof DOSSIER_SECTIONS)[number];
export type Dossier = z.infer<typeof DossierSchema>;
export type DossierMatch = z.infer<typeof DossierMatchSchema>;
export type Evidence = z.infer<typeof EvidenceSchema>;
export type SourceRef = z.infer<typeof SourceRefSchema>;
