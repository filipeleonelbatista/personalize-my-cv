// @vitest-environment jsdom
// web/tests/tailor-job-url.test.ts
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { loadApps, saveApps, saveBase, saveSettings, type StoredApp, type StoredBase } from "@/lib/store";
import { runTailorJob, retryStoredApp } from "@/lib/tailor-client";

const base: StoredBase = {
  resume: { cabecalho: { nome: "Ana", titulo_profissional: "Dev", contatos: [{ tipo: "email", valor: "a@a.com", link: null }] }, secoes: { resumo: "X", experiencia: [], formacao: [], habilidades: [], certificacoes: [], idiomas: [], projetos: [] } },
  lang: "pt-BR" as const,
  updatedAt: new Date().toISOString(),
};

const envelope = {
  resume: base.resume,
  cargo: "Dev",
  empresa: "X",
  matchPercent: 80,
  strengths: ["React"],
  weaknesses: ["Inglês"],
  emailBody: "Olá",
  chatMessage: "Oi",
};

function stubOk() {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(envelope) }] } }] }) })) as never);
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("job url persistence", () => {
  it("saves the job url on a generated app", async () => {
    saveBase(base);
    saveSettings({ geminiKey: "K", models: ["gemini-3.8-flash"] });
    stubOk();
    const r = await runTailorJob("vaga com texto suficiente para passar na validacao", "pt-BR", "https://example.com/job");
    expect(r.ok).toBe(true);
    expect(loadApps()[0].jobUrl).toBe("https://example.com/job");
  });
  it("saves an empty job url when the field is omitted", async () => {
    saveBase(base);
    saveSettings({ geminiKey: "K", models: ["gemini-3.8-flash"] });
    stubOk();
    const r = await runTailorJob("vaga com texto suficiente para passar na validacao", "pt-BR");
    expect(r.ok).toBe(true);
    expect(loadApps()[0].jobUrl).toBe("");
  });
  it("keeps the job url on the failed app", async () => {
    saveBase(base);
    saveSettings({ geminiKey: "K", models: ["gemini-3.8-flash"] });
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ia fora do ar"); }));
    const r = await runTailorJob("vaga com texto suficiente para passar na validacao", "pt-BR", "https://example.com/job");
    expect(r.ok).toBe(false);
    expect(loadApps()[0].jobUrl).toBe("https://example.com/job");
  });
  it("preserves the job url when the app is retried", async () => {
    saveBase(base);
    saveSettings({ geminiKey: "K", models: ["gemini-3.8-flash"] });
    const existing: StoredApp = { id: "retry-1", jobText: "vaga com texto suficiente para passar na validacao", jobUrl: "https://example.com/job", fileName: "f.pdf", resume: base.resume, cargo: "Dev", empresa: "X", matchPercent: 0, strengths: ["—"], weaknesses: ["—"], emailBody: "—", chatMessage: "—", status: "failed", errorLog: "boom", lang: "pt-BR", dossierId: null, dossierMatch: null, createdAt: "2024-05-01T12:00:00.000Z" };
    saveApps([existing]);
    stubOk();
    const r = await retryStoredApp("retry-1");
    expect(r.ok).toBe(true);
    expect(loadApps()[0].jobUrl).toBe("https://example.com/job");
  });
});
