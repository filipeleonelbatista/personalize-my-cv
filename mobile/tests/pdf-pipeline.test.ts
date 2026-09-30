import { describe, expect, it } from "vitest";
import { cvHtml } from "../lib/cv-html";
import { readFileSync, existsSync } from "node:fs";

const resume: any = {
  cabecalho: {
    nome: "Ana",
    titulo_profissional: "Dev",
    contatos: [{ tipo: "email", valor: "a@a.com", link: null }],
  },
  secoes: {
    resumo: "X",
    experiencia: [
      {
        cargo: "Dev",
        empresa: "Acme",
        local: null,
        periodo: { inicio: "2023-01", fim: null, atual: true },
        descricao: "d",
        realizacoes: ["r1"],
        tecnologias: ["TS"],
      },
    ],
    formacao: [],
    habilidades: [],
    certificacoes: [],
    idiomas: [],
    projetos: [],
  },
};

describe("pdf pipeline", () => {
  it("cv html mirrors CV sections with localized titles", () => {
    const html = cvHtml(resume, "pt-BR");
    expect(html).toContain("Ana");
    expect(html).toContain("Experiência");
    expect(cvHtml(resume, "en")).toContain("Experience");
  });
  it("cv html uses the CV language for periodo and trophies", () => {
    const html = cvHtml(resume, "en");
    expect(html).toContain("Present");
    expect(html).toContain("Skills:");
    expect(html).not.toContain("Competências");
    expect(html).not.toContain("atual");
  });
  it("cv html titles the resumo section", () => {
    expect(cvHtml(resume, "pt-BR")).toContain("<h2>Resumo</h2>");
    expect(cvHtml(resume, "es")).toContain("<h2>Resumen</h2>");
  });
  it("long content cannot overflow the page", () => {
    const big = { ...resume, secoes: { ...resume.secoes, resumo: "x".repeat(5000) } };
    const html = cvHtml(big, "pt-BR");
    expect(html).toMatch(/overflow-wrap: ?break-word|word-break: ?break-word/);
    expect(html).toMatch(/@page/);
  });
  it("pdf.js harness vendored", () => {
    for (const f of ["assets/pdfjs/pdf.min.mjs", "assets/pdfjs/pdf.worker.min.mjs", "assets/pdfjs/extract.html"]) {
      expect(existsSync(f), f).toBe(true);
    }
  });
  it("pipeline modules expose Task 3 contract", async () => {
    const ex = await import("../lib/pdf-extract");
    const sh = await import("../lib/pdf-share");
    const bk = await import("../lib/backup-files");
    expect(typeof ex.createBaseFromFile).toBe("function");
    expect(typeof sh.shareResumePdf).toBe("function");
    expect(typeof bk.exportBackupToFile).toBe("function");
    expect(typeof bk.importBackupFromFile).toBe("function");
  });
});
