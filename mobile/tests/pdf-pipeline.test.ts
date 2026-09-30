import { describe, expect, it } from "vitest";
import { cvHtml } from "../lib/cv-html";
import { readFileSync, existsSync } from "node:fs";

const resume: any = {
  cabecalho: {
    nome: "Ana",
    titulo_profissional: "Dev",
    contatos: [{ tipo: "email" as const, valor: "a@a.com", link: null }],
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
  it("pdf-share never statically imports media-library (route must load without it)", () => {
    const s = readFileSync("lib/pdf-share.ts", "utf8");
    expect(s).not.toContain('from "expo-media-library"');
    expect(s).toMatch(/await import\("expo-media-library"\)/);
  });
  it("downloadResumePdf saves via the device library", async () => {
    const { downloadResumePdf } = await import("../lib/pdf-share");
    const app = {
      id: "1",
      jobText: "job",
      fileName: "cv.pdf",
      status: "done" as const,
      errorLog: "",
      lang: "pt-BR" as const,
      createdAt: new Date().toISOString(),
      resume: {
        cabecalho: { nome: "Ana", titulo_profissional: "Dev", contatos: [{ tipo: "email" as const, valor: "a@a.com", link: null }] },
        secoes: { resumo: "X", experiencia: [], formacao: [], habilidades: [], certificacoes: [], idiomas: [], projetos: [] },
      },
      cargo: "Dev",
      empresa: "Acme",
      matchPercent: 80,
      strengths: ["a"],
      weaknesses: ["b"],
      emailBody: "e",
      chatMessage: "c",
    };
    await expect(downloadResumePdf(app)).resolves.toBe("/mock-documents/cv.pdf");
  });
  it("extractor WebView allows local file access", () => {
    const s = readFileSync("components/PdfExtractorHost.tsx", "utf8");
    expect(s).toMatch(/allowFileAccess=\{true\}/);
  });
  it("extractor WebView is provably non-visual", () => {
    const s = readFileSync("components/PdfExtractorHost.tsx", "utf8");
    expect(s).toMatch(/pointerEvents="none"/);
    expect(s).toMatch(/opacity:\s*0/);
    expect(s).toMatch(/scrollEnabled=\{false\}/);
    expect(s).toMatch(/overflow:\s*"hidden"/);
    expect(s).not.toMatch(/position:\s*"absolute"/);
  });
  it("unreadable picked files fail with guidance, not raw IOException", async () => {
    const fs = await import("./__mocks__/file-system");
    (fs as unknown as { __getFiles: () => Map<string, string> }).__getFiles().clear();
    const { createBaseFromFile } = await import("../lib/pdf-extract");
    await expect(createBaseFromFile({ uri: "/missing.pdf", name: "cv.pdf" }, "pt-BR")).rejects.toThrow(
      /Não foi possível ler/,
    );
  });
  it("copies the picked file into app storage before reading", async () => {
    const fs = await import("./__mocks__/file-system");
    const files = (fs as unknown as { __getFiles: () => Map<string, string> }).__getFiles();
    files.clear();
    files.set("content://provider/doc.pdf", "PDFBYTES");
    const { createBaseFromFile } = await import("../lib/pdf-extract");
    // No WebView host in tests → fails at extraction, but only AFTER a
    // successful local copy (proves the copy path, not the picker cache).
    await expect(createBaseFromFile({ uri: "content://provider/doc.pdf", name: "doc.pdf" }, "pt-BR")).rejects.toThrow(
      /Extrator de PDF indisponível/,
    );
    expect([...files.keys()].some((k) => k.includes("incoming-") && k.endsWith(".pdf"))).toBe(true);
  });
});
