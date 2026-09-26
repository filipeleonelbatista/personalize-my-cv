import { describe, expect, it } from "vitest";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { CVDocument, cvElement } from "@/lib/pdf/CVDocument";
import { extractCvText } from "@/lib/cv-text";

const resume = { cabecalho: { nome: "Filipe de Leonel Batista", titulo_profissional: "Desenvolvedor Front-end",
  contatos: [{ tipo: "email", valor: "a@b.com", link: "mailto:a@b.com" }] },
  secoes: { resumo: "Dev React.", experiencia: [], formacao: [],
    habilidades: [{ nome: "F", itens: ["React"] }],
    certificacoes: [{ nome: "AWS Certified", emissor: "Amazon", ano: 2023, link: null }],
    idiomas: [{ idioma: "Inglês", nivel: "Avançado" }], projetos: [] } } as never;

describe("CVDocument", () => {
  it("renders to buffer", async () => {
    const buf = await renderToBuffer(cvElement(resume));
    expect(buf.length).toBeGreaterThan(1000);
  }, 30000);
  it("includes certificacoes and idiomas text", async () => {
    const buf = await renderToBuffer(cvElement(resume));
    const text = await extractCvText(Buffer.from(buf));
    expect(text).toContain("AWS Certified");
    expect(text).toContain("Inglês");
  }, 30000);
});
