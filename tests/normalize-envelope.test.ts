import { describe, expect, it } from "vitest";
import { normalizeEnvelope } from "@/lib/tailor";const baseResume = { cabecalho: { nome: "N", titulo_profissional: "T", contatos: [{ tipo: "email", valor: "a", link: null }] },
  secoes: { resumo: "r", experiencia: [], formacao: [], habilidades: [], certificacoes: [], idiomas: [], projetos: [] } };
const full = { resume: baseResume, cargo: "Dev", empresa: "X", matchPercent: 82,
  strengths: ["React"], weaknesses: ["Inglês"], emailBody: "Olá", chatMessage: "Oi" };

describe("normalizeEnvelope", () => {
  it("passes a valid envelope through", () => {
    expect(normalizeEnvelope(full).cargo).toBe("Dev");
  });
  it("defaults missing cargo/empresa to Vaga/Empresa", () => {
    const { cargo, empresa, ...rest } = full;
    const env = normalizeEnvelope(rest);
    expect(env.cargo).toBe("Vaga");
    expect(env.empresa).toBe("Empresa");
  });
  it("defaults blank cargo/empresa to Vaga/Empresa", () => {
    const env = normalizeEnvelope({ ...full, cargo: "  ", empresa: "" });
    expect(env.cargo).toBe("Vaga");
    expect(env.empresa).toBe("Empresa");
  });
  it("still rejects out-of-range matchPercent", () => {
    expect(() => normalizeEnvelope({ ...full, matchPercent: 150 })).toThrow();
  });
  it("defaults missing cargo/empresa per language", () => {
    const { cargo, empresa, ...rest } = full;
    expect(normalizeEnvelope(rest, "en").cargo).toBe("Position");
    expect(normalizeEnvelope(rest, "en").empresa).toBe("Company");
    expect(normalizeEnvelope(rest, "es").cargo).toBe("Puesto");
  });
});

describe("normalizeEnvelope resume fallback", () => {
  it("uses base resume when the envelope omits it", () => {
    const { resume, ...rest } = full;
    const env = normalizeEnvelope(rest, "pt-BR", baseResume as never);
    expect(env.resume.cabecalho.nome).toBe("N");
    expect(env.cargo).toBe("Dev");
  });
  it("still rejects when resume is missing and no fallback given", () => {
    const { resume, ...rest } = full;
    expect(() => normalizeEnvelope(rest)).toThrow();
  });
});
