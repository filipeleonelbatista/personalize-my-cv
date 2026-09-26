import { describe, expect, it } from "vitest";
import { normalizeResume, mapContatoTipo } from "@/lib/tailor";

const base = {
  cabecalho: { nome: "Filipe", titulo_profissional: "Dev",
    contatos: [
      { tipo: "E-mail", valor: "a@b.com", link: null },
      { tipo: "LinkedIn", valor: "linkedin.com/in/x", link: null },
    ] },
  secoes: { resumo: "r", experiencia: [], formacao: [], habilidades: [], certificacoes: [], idiomas: [], projetos: [] },
};

describe("mapContatoTipo", () => {
  it("maps the reported variants", () => {
    expect(mapContatoTipo("E-mail")).toBe("email");
    expect(mapContatoTipo("LinkedIn")).toBe("linkedin");
  });
  it("maps common pt-BR variants", () => {
    expect(mapContatoTipo("WhatsApp")).toBe("telefone");
    expect(mapContatoTipo("GitHub")).toBe("github");
    expect(mapContatoTipo("Portfólio")).toBe("portfolio");
    expect(mapContatoTipo("Localização")).toBe("localizacao");
  });
  it("returns null for unknown", () => {
    expect(mapContatoTipo("Fax")).toBeNull();
  });
});

describe("normalizeResume", () => {
  it("accepts LLM-cased contato tipos", () => {
    const r = normalizeResume(base);
    expect(r.cabecalho.contatos.map((c) => c.tipo)).toEqual(["email", "linkedin"]);
  });
  it("drops unknown tipos but keeps valid ones", () => {
    const r = normalizeResume({ ...base, cabecalho: { ...base.cabecalho,
      contatos: [...base.cabecalho.contatos, { tipo: "Fax", valor: "123", link: null }] } });
    expect(r.cabecalho.contatos).toHaveLength(2);
  });
  it("rejects when no valid contato remains", () => {
    expect(() => normalizeResume({ ...base, cabecalho: { ...base.cabecalho,
      contatos: [{ tipo: "Fax", valor: "123", link: null }] } })).toThrow();
  });
});
