import { describe, expect, it } from "vitest";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { cvElement } from "@/lib/pdf/CVDocument";

const resume = { cabecalho: { nome: "Filipe de Leonel Batista", titulo_profissional: "Desenvolvedor Front-end",
  contatos: [{ tipo: "email", valor: "a@b.com", link: "mailto:a@b.com" }] },
  secoes: { resumo: "Dev React.", experiencia: [], formacao: [],
    habilidades: [{ nome: "F", itens: ["React"] }], certificacoes: [], idiomas: [], projetos: [] } } as never;

describe("CVDocument", () => {
  it("renders to buffer", async () => {
    const buf = await renderToBuffer(cvElement(resume));
    expect(buf.length).toBeGreaterThan(1000);
  }, 30000);
});
