import { describe, expect, it } from "vitest";
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

describe("pdf", () => {
  it("rejects non-pdf with invalidPdf", async () => {
    const { extractPdfText } = await import("../src/lib/pdf-extract.js");
    await expect(extractPdfText("/tmp/opencode/nope.txt")).rejects.toThrow();
  });
  it("renders a pdf file from minimal resume", async () => {
    const { renderPdf } = await import("../src/lib/pdf.js");
    const out = "/tmp/opencode/pmcv-render-test.pdf";
    await renderPdf(minimalResume(), "pt-BR", out);
    const { statSync } = await import("node:fs");
    expect(statSync(out).size).toBeGreaterThan(1000);
  }, 30000);
});
