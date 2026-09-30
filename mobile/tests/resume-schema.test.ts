import { describe, expect, it } from "vitest";
import { parseResume } from "../lib/resume-schema";

const minimal = {
  cabecalho: { nome: "Ana", titulo_profissional: "Dev", contatos: [{ tipo: "email", valor: "a@a.com", link: null }] },
  secoes: { resumo: "X", experiencia: [], formacao: [], habilidades: [], certificacoes: [], idiomas: [], projetos: [] },
};

describe("mobile resume-schema", () => {
  it("accepts a minimal valid resume", () => {
    expect(parseResume(minimal).cabecalho.nome).toBe("Ana");
  });
  it("rejects missing nome", () => {
    expect(() => parseResume({ ...minimal, cabecalho: { ...minimal.cabecalho, nome: "" } })).toThrow();
  });
});
