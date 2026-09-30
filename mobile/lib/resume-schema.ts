// mobile/lib/resume-schema.ts
import { z } from "zod";

export const ContatoSchema = z.object({
  tipo: z.enum(["email", "telefone", "linkedin", "github", "portfolio", "localizacao"]),
  valor: z.string().min(1),
  link: z.string().nullable().default(null),
});

export const PeriodoSchema = z.object({
  inicio: z.string().regex(/^\d{4}-\d{2}$/, "inicio deve ser YYYY-MM"),
  fim: z.string().regex(/^\d{4}-\d{2}$/).nullable().default(null),
  atual: z.boolean().default(false),
});

export const ExperienciaSchema = z.object({
  cargo: z.string().min(1),
  empresa: z.string().min(1),
  local: z.string().nullable().default(null),
  periodo: PeriodoSchema,
  descricao: z.string().default(""),
  realizacoes: z.array(z.string()).default([]),
  tecnologias: z.array(z.string()).default([]),
});

export const FormacaoSchema = z.object({
  curso: z.string().min(1),
  instituicao: z.string().min(1),
  local: z.string().nullable().default(null),
  periodo: PeriodoSchema,
  descricao: z.string().nullable().default(null),
});

export const ResumeSchema = z.object({
  cabecalho: z.object({
    nome: z.string().min(1),
    titulo_profissional: z.string().min(1),
    contatos: z.array(ContatoSchema).min(1),
  }),
  secoes: z.object({
    resumo: z.string().min(1),
    experiencia: z.array(ExperienciaSchema).default([]),
    formacao: z.array(FormacaoSchema).default([]),
    habilidades: z.array(z.object({ nome: z.string(), itens: z.array(z.string()) })).default([]),
    certificacoes: z.array(z.object({ nome: z.string(), emissor: z.string(), ano: z.number().int(), link: z.string().nullable().default(null) })).default([]),
    idiomas: z.array(z.object({ idioma: z.string(), nivel: z.string() })).default([]),
    projetos: z.array(z.object({ nome: z.string(), descricao: z.string(), link: z.string().nullable().default(null), tecnologias: z.array(z.string()).default([]) })).default([]),
  }),
});

export const TailorEnvelopeSchema = z.object({
  resume: ResumeSchema,
  cargo: z.string().min(1),
  empresa: z.string().min(1),
  matchPercent: z.number().int().min(0).max(100),
  strengths: z.array(z.string()).min(1).max(8),
  weaknesses: z.array(z.string()).min(1).max(8),
  emailBody: z.string().min(1),
  chatMessage: z.string().min(1),
});

export type Resume = z.infer<typeof ResumeSchema>;
export type TailorEnvelope = z.infer<typeof TailorEnvelopeSchema>;

export function parseResume(json: unknown): Resume {
  return ResumeSchema.parse(json);
}

export function parseEnvelope(json: unknown): TailorEnvelope {
  return TailorEnvelopeSchema.parse(json);
}
