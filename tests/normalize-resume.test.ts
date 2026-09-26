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

describe("normalizeResume habilidades", () => {  const withHabs = (habilidades: unknown) => normalizeResume({ ...base, secoes: { ...base.secoes, habilidades } });
  it("accepts English keys (name/items)", () => {
    const r = withHabs([{ name: "Front", items: ["React"] }]);
    expect(r.secoes.habilidades[0]).toEqual({ nome: "Front", itens: ["React"] });
  });
  it("accepts categoria/skills with comma string", () => {
    const r = withHabs([{ categoria: "Back", skills: "Node, Express" }]);
    expect(r.secoes.habilidades[0]).toEqual({ nome: "Back", itens: ["Node", "Express"] });
  });
  it("accepts plain string groups", () => {
    const r = withHabs(["React, Next.js"]);
    expect(r.secoes.habilidades[0].itens).toEqual(["React", "Next.js"]);
  });
  it("defaults missing itens to empty array", () => {
    const r = withHabs([{ nome: "DevOps" }]);
    expect(r.secoes.habilidades[0]).toEqual({ nome: "DevOps", itens: [] });
  });
});

describe("normalizeResume experiencias", () => {
  const withExp = (experiencia: unknown) => normalizeResume({ ...base, secoes: { ...base.secoes, experiencia } });
  it("maps English keys and keeps full activity text", () => {
    const r = withExp([{
      role: "Dev Front-end", company: "CI&T", location: "Brasil (Remoto)",
      period: { inicio: "2025-08", fim: null, atual: true },
      description: "Atuo em projeto estratégico.",
      activities: ["Desenvolvimento de interfaces modernas em React.", "Integração com APIs REST."],
      stack: "React, Context API",
    }]);
    const e = r.secoes.experiencia[0];
    expect(e.cargo).toBe("Dev Front-end");
    expect(e.empresa).toBe("CI&T");
    expect(e.realizacoes).toEqual(["Desenvolvimento de interfaces modernas em React.", "Integração com APIs REST."]);
    expect(e.tecnologias).toEqual(["React", "Context API"]);
  });
  it("parses pt-BR periodo strings", () => {
    const r = withExp([{
      cargo: "Dev", empresa: "X", local: null, periodo: "Ago 2025 – atual",
      descricao: "x", realizacoes: [], tecnologias: [],
    }]);
    expect(r.secoes.experiencia[0].periodo).toEqual({ inicio: "2025-08", fim: null, atual: true });
    const r2 = withExp([{
      cargo: "Dev", empresa: "X", local: null, periodo: "Jul 2021 - Set 2022",
      descricao: "x", realizacoes: [], tecnologias: [],
    }]);
    expect(r2.secoes.experiencia[0].periodo).toEqual({ inicio: "2021-07", fim: "2022-09", atual: false });
  });
});
