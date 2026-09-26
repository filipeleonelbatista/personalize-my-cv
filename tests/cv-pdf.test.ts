import { describe, expect, it } from "vitest";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { CVDocument, cvElement, cvStyles } from "@/lib/pdf/CVDocument";
import { extractCvText } from "@/lib/cv-text";

const resume = { cabecalho: { nome: "Filipe de Leonel Batista", titulo_profissional: "Desenvolvedor Front-end",
  contatos: [{ tipo: "email", valor: "a@b.com", link: "mailto:a@b.com" }] },
  secoes: { resumo: "Dev React.", experiencia: [], formacao: [],
    habilidades: [{ nome: "F", itens: ["React"] }],
    certificacoes: [{ nome: "AWS Certified", emissor: "Amazon", ano: 2023, link: null }],
    idiomas: [{ idioma: "Inglês", nivel: "Avançado" }], projetos: [] } };

describe("CVDocument", () => {
  it("renders to buffer", async () => {
    const buf = await renderToBuffer(cvElement(resume as never));
    expect(buf.length).toBeGreaterThan(1000);
  }, 30000);
  it("includes certificacoes and idiomas text", async () => {
    const buf = await renderToBuffer(cvElement(resume as never));
    const text = await extractCvText(Buffer.from(buf));
    expect(text).toContain("AWS Certified");
    expect(text).toContain("Inglês");
  }, 30000);
  it("renders at most 6 bullets of up to 3 skills", async () => {
    const itens = Array.from({ length: 20 }, (_, i) => `SK${i + 1}`);
    const many = { ...resume, secoes: { ...resume.secoes,
      habilidades: [{ nome: "Tudo", itens }] } } as never;
    const buf = await renderToBuffer(cvElement(many));
    const text = await extractCvText(Buffer.from(buf));
    expect(text).toContain("SK1, SK2, SK3");
    expect(text).toContain("SK16, SK17, SK18");
    expect(text).not.toContain("SK19");
  }, 30000);
  it("renders English labels and dates when lang is en", async () => {
    const en = { ...resume, secoes: { ...resume.secoes,
      experiencia: [{ cargo: "Dev", empresa: "CI&T", local: "Brazil (Remote)",
        periodo: { inicio: "2025-08", fim: null, atual: true },
        descricao: "Working on a project.",
        realizacoes: ["Building interfaces."],
        tecnologias: ["React"] }] } } as never;
    const buf = await renderToBuffer(cvElement(en, "en"));
    const text = await extractCvText(Buffer.from(buf));
    expect(text).toContain("Experience");
    expect(text).toContain("Key activities");
    expect(text).toContain("Skills");
    expect(text).not.toContain("Technologies");
    expect(text).toContain("Aug 2025");
    expect(text).toContain("Present");
    expect(text).not.toContain("Experiências");
  }, 30000);
  it("renders dates as 3-letter month and local with city", async () => {
    const job = { ...resume, secoes: { ...resume.secoes,
      experiencia: [{ cargo: "Dev", empresa: "CI&T", local: "São Paulo, SP, Brasil (Remoto)",
        periodo: { inicio: "2025-08", fim: null, atual: true },
        descricao: "Atuo em projeto.",
        realizacoes: ["Interfaces modernas em React.", "Integração com APIs REST."],
        tecnologias: ["React", "Context API"] }] } } as never;
    const buf = await renderToBuffer(cvElement(job));
    const text = await extractCvText(Buffer.from(buf));
    expect(text).toContain("Ago 2025");
    expect(text).toContain("atual");
    expect(text).toContain("São Paulo, SP, Brasil (Remoto)");
    expect(text).not.toContain("2025-08");
    expect(text).toContain("Principais atividades");
    expect(text).toContain("Interfaces modernas em React.");
    expect(text).toContain("Competências");
    expect(text).toContain("React, Context API");
  }, 30000);
});

describe("CVDocument spacing", () => {
  it("gives breathing room after name, role and section titles", () => {
    expect(cvStyles.name.marginBottom).toBeGreaterThanOrEqual(4);
    expect(cvStyles.contact.marginTop).toBeGreaterThanOrEqual(4);
    expect(cvStyles.role.marginBottom).toBeGreaterThanOrEqual(4);
    expect(cvStyles.h2.marginBottom).toBeGreaterThanOrEqual(6);
    expect(cvStyles.h2.marginTop).toBeGreaterThanOrEqual(8);
  });
});
