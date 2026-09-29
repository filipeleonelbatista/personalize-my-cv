// @vitest-environment jsdom
// web/tests/store.test.ts
import { describe, expect, it, beforeEach, vi } from "vitest";
import { saveBase, loadBase, saveApps, loadApps, saveSettings, loadSettings, exportBackup, importBackup, type StoredBase } from "@/lib/store";

const base: StoredBase = { resume: { cabecalho: { nome: "Ana", titulo_profissional: "Dev", contatos: [{ tipo: "email", valor: "a@a.com", link: null }] }, secoes: { resumo: "X", experiencia: [], formacao: [], habilidades: [], certificacoes: [], idiomas: [], projetos: [] } }, lang: "pt-BR" as const, updatedAt: new Date().toISOString() };

beforeEach(() => localStorage.clear());

describe("store", () => {
  it("round-trips base", () => {
    saveBase(base);
    expect(loadBase()?.resume.cabecalho.nome).toBe("Ana");
  });
  it("rejects corrupted JSON with empty fallback", () => {
    localStorage.setItem("pmcv:apps", "[[[");
    expect(loadApps()).toEqual([]);
  });
  it("exports and imports backup", () => {
    saveBase(base); saveApps([]);
    const json = exportBackup();
    localStorage.clear();
    importBackup(json);
    expect(loadBase()?.resume.cabecalho.nome).toBe("Ana");
  });
  it("surfaces quota errors with guidance", () => {
    const big = "x".repeat(100);
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => { throw new DOMException("full", "QuotaExceededError"); });
    expect(() => saveApps([{ id: "1", jobText: big, fileName: "f.pdf", resume: base.resume, cargo: "Vaga", empresa: "Empresa", matchPercent: 0, strengths: ["a"], weaknesses: ["b"], emailBody: "e", chatMessage: "c", status: "done", errorLog: "", lang: "pt-BR", createdAt: new Date().toISOString() }])).toThrow(/Armazenamento cheio/);
    setItem.mockRestore();
  });
  it("defaults missing app lang to pt-BR and keeps explicit lang", () => {
    const app = { id: "1", jobText: "j", fileName: "f.pdf", resume: base.resume, cargo: "Vaga", empresa: "Empresa", matchPercent: 50, strengths: ["a"], weaknesses: ["b"], emailBody: "e", chatMessage: "c", status: "done" as const, errorLog: "", lang: "en" as const, createdAt: new Date().toISOString() };
    const legacy = { ...app, id: "0" } as Record<string, unknown>;
    delete legacy.lang;
    localStorage.setItem("pmcv:apps", JSON.stringify([legacy, app]));
    const [old, cur] = loadApps();
    expect(old.lang).toBe("pt-BR");
    expect(cur.lang).toBe("en");
  });
  it("discards invalid items but keeps valid ones", () => {
    const valid = { id: "1", jobText: "j", fileName: "f.pdf", resume: base.resume, cargo: "Vaga", empresa: "Empresa", matchPercent: 50, strengths: ["a"], weaknesses: ["b"], emailBody: "e", chatMessage: "c", status: "done", errorLog: "", lang: "pt-BR", createdAt: new Date().toISOString() };
    localStorage.setItem("pmcv:apps", JSON.stringify([valid, { garbage: true }, null, "x"]));
    const apps = loadApps();
    expect(apps).toHaveLength(1);
    expect(apps[0].id).toBe("1");
  });
  it("round-trips settings through secure storage", () => {
    saveSettings({ geminiKey: "K", models: ["m1", "m2"] });
    expect(loadSettings()).toEqual({ geminiKey: "K", models: ["m1", "m2"] });
  });
  it("saveBase surfaces quota errors with guidance", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => { throw new DOMException("full", "QuotaExceededError"); });
    expect(() => saveBase(base)).toThrow(/Armazenamento cheio/);
    setItem.mockRestore();
  });
});
