// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from "vitest";
import { buildFileName } from "@/lib/filename";
import { parseEnvelope } from "@/lib/resume-schema";
import { runTailorJob, retryStoredApp } from "@/lib/tailor-client";

beforeEach(() => localStorage.clear());

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
    await expect(runTailorJob("curto", "pt-BR")).rejects.toThrow(/20 caracteres/);
  });
  it("accepts a language override without calling LLMs on short input", async () => {
    await expect(runTailorJob("curto", "en")).rejects.toThrow(/20 caracteres/);
  });
  it("retry on unknown id returns not found", async () => {
    const r = await retryStoredApp("missing-id");
    expect(r.ok).toBe(false);
  });
});
