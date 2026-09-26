import { TailorEnvelopeSchema, type TailorEnvelope } from "./resume-schema";

function defaulted(v: unknown, fallback: string): string {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

export function normalizeEnvelope(data: unknown): TailorEnvelope {
  if (typeof data !== "object" || data === null) throw new Error("Envelope da IA inválido.");
  const obj = data as Record<string, unknown>;
  return TailorEnvelopeSchema.parse({
    ...obj,
    cargo: defaulted(obj.cargo, "Vaga"),
    empresa: defaulted(obj.empresa, "Empresa"),
  });
}
