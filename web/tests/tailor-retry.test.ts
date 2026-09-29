// @vitest-environment jsdom
import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import { saveApps, loadApps, saveBase, saveSettings, type StoredApp, type StoredBase } from "@/lib/store";
import { retryStoredApp } from "@/lib/tailor-client";

const base: StoredBase = { resume: { cabecalho: { nome: "Ana", titulo_profissional: "Dev", contatos: [{ tipo: "email", valor: "a@a.com", link: null }] }, secoes: { resumo: "X", experiencia: [], formacao: [], habilidades: [], certificacoes: [], idiomas: [], projetos: [] } }, lang: "pt-BR" as const, updatedAt: new Date().toISOString() };

function failedApp(): StoredApp {
  return { id: "retry-1", jobText: "vaga com texto suficiente para passar na validacao", fileName: "failed.pdf", resume: base.resume, cargo: "Dev", empresa: "X", matchPercent: 0, strengths: ["—"], weaknesses: ["—"], emailBody: "—", chatMessage: "—", status: "failed", errorLog: "boom anterior", lang: "pt-BR", createdAt: "2024-05-01T12:00:00.000Z" };
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("retryStoredApp failure path", () => {
  it("preserves the original createdAt when retry fails", async () => {
    saveBase(base);
    saveApps([failedApp()]);
    saveSettings({ geminiKey: "K", models: ["gemini-2.5-flash"] });
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ia fora do ar"); }));
    const r = await retryStoredApp("retry-1");
    expect(r.ok).toBe(false);
    const [app] = loadApps();
    expect(app.status).toBe("failed");
    expect(app.createdAt).toBe("2024-05-01T12:00:00.000Z");
    expect(app.errorLog).toContain("ia fora do ar");
  });
});
