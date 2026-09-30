import { describe, expect, it } from "vitest";
import { runTailorJob } from "../lib/tailor-client";
import { normalizeResume } from "../lib/tailor";

describe("mobile tailor", () => {
  it("rejects short job text in default locale", async () => {
    await expect(runTailorJob("curto", "pt-BR")).rejects.toThrow(/20 caracteres/);
  });
  it("rejects short job text in UI locale", async () => {
    await expect(runTailorJob("curto", "pt-BR", "en-US")).rejects.toThrow(/20 characters/);
  });
  it("normalizeResume parses web-shaped data", () => {
    const r = normalizeResume({
      cabecalho: { nome: "Ana", titulo_profissional: "Dev", contatos: [{ tipo: "E-mail", valor: "a@a.com", link: null }] },
      secoes: { resumo: "X", experiencia: [], formacao: [], habilidades: [], certificacoes: [], idiomas: [], projetos: [] },
    });
    expect(r.cabecalho.contatos[0].tipo).toBe("email");
  });
});
