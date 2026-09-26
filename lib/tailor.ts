import { ResumeSchema, TailorEnvelopeSchema, type Resume, type TailorEnvelope } from "./resume-schema";

const TIPO_MAP: Record<string, string> = {
  email: "email", "e-mail": "email", "e mail": "email", mail: "email",
  telefone: "telefone", tel: "telefone", fone: "telefone", phone: "telefone",
  celular: "telefone", whatsapp: "telefone", mobile: "telefone",
  linkedin: "linkedin",
  github: "github",
  portfolio: "portfolio", "portfólio": "portfolio", site: "portfolio", website: "portfolio",
  localizacao: "localizacao", "localização": "localizacao", local: "localizacao",
  endereco: "localizacao", "endereço": "localizacao", cidade: "localizacao",
  location: "localizacao", address: "localizacao",
};

export function mapContatoTipo(v: unknown): string | null {
  if (typeof v !== "string") return null;
  return TIPO_MAP[v.trim().toLowerCase()] ?? null;
}

function normalizeContatos(root: Record<string, unknown>): void {
  const resume = (root.resume ?? root) as { cabecalho?: { contatos?: unknown } };
  const contatos = resume?.cabecalho?.contatos;
  if (!Array.isArray(contatos)) return;
  resume.cabecalho!.contatos = contatos
    .map((c) =>
      typeof c === "object" && c !== null
        ? { ...(c as Record<string, unknown>), tipo: mapContatoTipo((c as { tipo?: unknown }).tipo) }
        : c
    )
    .filter((c) => typeof c === "object" && c !== null && (c as { tipo?: unknown }).tipo !== null);
}

function deepCopy(data: unknown): Record<string, unknown> {
  return JSON.parse(JSON.stringify(data)) as Record<string, unknown>;
}

export function normalizeResume(data: unknown): Resume {
  if (typeof data !== "object" || data === null) throw new Error("Currículo da IA inválido.");
  const copy = deepCopy(data);
  normalizeContatos(copy);
  return ResumeSchema.parse(copy);
}

function defaulted(v: unknown, fallback: string): string {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

export function normalizeEnvelope(data: unknown): TailorEnvelope {
  if (typeof data !== "object" || data === null) throw new Error("Envelope da IA inválido.");
  const copy = deepCopy(data);
  normalizeContatos(copy);
  return TailorEnvelopeSchema.parse({
    ...copy,
    cargo: defaulted(copy.cargo, "Vaga"),
    empresa: defaulted(copy.empresa, "Empresa"),
  });
}
