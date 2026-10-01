import { describe, expect, it } from "vitest";
import { normalizeEnvelope } from "../src/lib/tailor.js";
import type { Resume } from "../src/lib/schemas.js";

function minimalResume(): Resume {
  return {
    cabecalho: { nome: "Teste", titulo_profissional: "Dev", contatos: [{ tipo: "email", valor: "a@b.c", link: null }] },
    secoes: {
      resumo: "r",
      experiencia: [],
      formacao: [],
      habilidades: [{ nome: "H", itens: ["x"] }],
      certificacoes: [],
      idiomas: [],
      projetos: [],
    },
  };
}

describe("tailor", () => {
  it("rejects short job before AI (jobShort)", async () => {
    const { runTailorJob } = await import("../src/lib/tailor.js");
    await expect(runTailorJob("curta", "pt-BR", "pt-BR")).rejects.toThrow();
  });
  it("fills missing cargo/empresa with MISSING_JOB", () => {
    const env = normalizeEnvelope(
      {
        resume: minimalResume(),
        cargo: "",
        empresa: "  ",
        matchPercent: 80,
        strengths: ["s1"],
        weaknesses: ["w1"],
        emailBody: "mail",
        chatMessage: "chat",
      },
      "pt-BR",
    );
    expect(env.cargo).toBe("Vaga");
    expect(env.empresa).toBe("Empresa");
  });
});
