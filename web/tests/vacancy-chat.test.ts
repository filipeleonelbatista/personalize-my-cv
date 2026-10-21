// @vitest-environment jsdom
// web/tests/vacancy-chat.test.ts
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { buildVacancyChatSystem, buildVacancyChatUser, askVacancy } from "@/lib/vacancy-chat";
import { saveSettings, type StoredApp } from "@/lib/store";

const app: StoredApp = {
  id: "1",
  jobText: "Vaga de Desenvolvedor Front-end com React e TypeScript",
  jobUrl: "https://example.com/job",
  fileName: "f.pdf",
  resume: {
    cabecalho: { nome: "Ana", titulo_profissional: "Dev Front-end", contatos: [{ tipo: "email", valor: "a@a.com", link: null }] },
    secoes: { resumo: "Dev front-end", experiencia: [], formacao: [], habilidades: [{ nome: "Front-end", itens: ["React", "TypeScript"] }], certificacoes: [], idiomas: [], projetos: [] },
  },
  cargo: "Dev Front-end",
  empresa: "Acme",
  matchPercent: 80,
  strengths: ["React no currículo", "TypeScript"],
  weaknesses: ["Falta testar"],
  emailBody: "Olá, quero a vaga",
  chatMessage: "Oi, tudo bem?",
  status: "done",
  errorLog: "",
  lang: "pt-BR",
  dossierId: null,
  dossierMatch: null,
  createdAt: new Date().toISOString(),
};

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("buildVacancyChatSystem", () => {
  it("answers in the interface language", () => {
    expect(buildVacancyChatSystem("pt-BR")).toMatch(/Português do Brasil/i);
    expect(buildVacancyChatSystem("en-US")).toMatch(/English/i);
    expect(buildVacancyChatSystem("es-ES")).toMatch(/Español/i);
  });
  it("tells the model to stick to the given context", () => {
    expect(buildVacancyChatSystem("pt-BR")).toMatch(/contexto/i);
  });
});

describe("buildVacancyChatUser", () => {
  it("carries the analysis, the generated data and the original job text", () => {
    const u = buildVacancyChatUser(app, "Quais skills devo citar?");
    expect(u).toContain("Dev Front-end");
    expect(u).toContain("Acme");
    expect(u).toContain("80");
    expect(u).toContain("React no currículo");
    expect(u).toContain("Falta testar");
    expect(u).toContain("Vaga de Desenvolvedor Front-end com React e TypeScript");
    expect(u).toContain("Ana");
    expect(u).toContain("Olá, quero a vaga");
    expect(u).toContain("Quais skills devo citar?");
  });
  it("keeps the previous turns when a history is given", () => {
    const u = buildVacancyChatUser(app, "E mais?", [{ role: "user", content: "primeira" }, { role: "assistant", content: "resposta" }]);
    expect(u).toContain("primeira");
    expect(u).toContain("resposta");
  });
});

describe("askVacancy", () => {
  it("calls the API with the user key and returns the plain answer", async () => {
    saveSettings({ geminiKey: "KEY123", models: ["gemini-3.8-flash"] });
    const fetch = vi.fn(async (..._a: unknown[]) => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: "Cite React e TypeScript." }] } }] }) }));
    vi.stubGlobal("fetch", fetch);
    const answer = await askVacancy(app, "Quais skills devo citar?");
    expect(answer).toBe("Cite React e TypeScript.");
    expect(String(fetch.mock.calls[0][0])).toContain("key=KEY123");
  });
  it("surfaces the API error", async () => {
    saveSettings({ geminiKey: "K", models: ["gemini-3.8-flash"] });
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ia fora do ar"); }));
    await expect(askVacancy(app, "oi")).rejects.toThrow(/ia fora do ar/);
  });
});
