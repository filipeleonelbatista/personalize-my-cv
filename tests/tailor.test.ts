import { describe, expect, it } from "vitest";
import { buildFileName } from "@/lib/filename";
import { parseEnvelope } from "@/lib/resume-schema";
import { tailorResume, retryTailor } from "@/app/actions";

describe("tailor envelope", () => {
  it("parses envelope with match bounds", () => {
    const env = { resume: { cabecalho: { nome: "N", titulo_profissional: "T", contatos: [{ tipo: "email", valor: "a", link: null }] },
      secoes: { resumo: "r", experiencia: [], formacao: [], habilidades: [], certificacoes: [], idiomas: [], projetos: [] } },
      cargo: "Dev", empresa: "X", matchPercent: 82, strengths: ["React"], weaknesses: ["Inglês"],
      emailBody: "Olá", chatMessage: "Oi" };
    expect(parseEnvelope(env).matchPercent).toBe(82);
    expect(buildFileName("N", "Dev", "X", new Date("2026-09-25T00:00:00")).endsWith(".pdf")).toBe(true);
  });
  it("rejects jobText too short without calling LLMs", async () => {
    const r = await tailorResume("curto");
    expect(r.ok).toBe(false);
  });
  it("retry on unknown id returns not found", async () => {
    const r = await retryTailor(999999);
    expect(r.ok).toBe(false);
  });
});
