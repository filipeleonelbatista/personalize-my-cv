import { describe, expect, it } from "vitest";
import { parseResume } from "@/lib/resume-schema";

const valid = {
  cabecalho: { nome: "Filipe de Leonel Batista", titulo_profissional: "Desenvolvedor Front-end",
    contatos: [{ tipo: "email", valor: "filipe.x2016@gmail.com", link: "mailto:filipe.x2016@gmail.com" }] },
  secoes: { resumo: "Dev front-end com React.", experiencia: [], formacao: [],
    habilidades: [{ nome: "Front", itens: ["React"] }], certificacoes: [],
    idiomas: [{ idioma: "Português", nivel: "Nativo" }], projetos: [] },
};

describe("parseResume", () => {
  it("accepts minimal valid resume", () => {
    expect(parseResume(valid).cabecalho.nome).toContain("Filipe");
  });
  it("rejects missing nome", () => {
    expect(() => parseResume({ ...valid, cabecalho: { ...valid.cabecalho, nome: "" } })).toThrow();
  });
  it("accepts periodo atual with fim null", () => {
    const r = parseResume({ ...valid, secoes: { ...valid.secoes,
      experiencia: [{ cargo: "Dev", empresa: "CI&T", local: "Remoto",
        periodo: { inicio: "2025-08", fim: null, atual: true },
        descricao: "x", realizacoes: ["y"], tecnologias: ["React"] }] } });
    expect(r.secoes.experiencia[0].periodo.atual).toBe(true);
  });
});
