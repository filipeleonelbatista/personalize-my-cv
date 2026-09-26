import { describe, expect, it } from "vitest";
import { normalizeEnvelope } from "@/lib/tailor";

const baseResume = { cabecalho: { nome: "N", titulo_profissional: "T", contatos: [{ tipo: "email", valor: "a", link: null }] },
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
});
