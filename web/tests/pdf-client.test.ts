// web/tests/pdf-client.test.ts
import { describe, expect, it } from "vitest";
import { resumeToBlob } from "@/lib/pdf/client";
const resume: any = { cabecalho: { nome: "Ana", titulo_profissional: "Dev", contatos: [{ tipo: "email", valor: "a@a.com", link: null }] }, secoes: { resumo: "X", experiencia: [], formacao: [], habilidades: [], certificacoes: [], idiomas: [], projetos: [] } };
describe("pdf-client", () => {
  it("generates a pdf blob", async () => {
    const b = await resumeToBlob(resume, "pt-BR");
    expect(b.type).toBe("application/pdf");
    expect(b.size).toBeGreaterThan(500);
  });
});
