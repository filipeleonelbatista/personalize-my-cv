// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadDossiers, saveDossiers, upsertDossier, findDossierByCompany, deleteDossier, loadReadCache, saveReadCache, loadSettings, saveSettings, loadApps, saveApps, exportBackup, importBackup, wipeAll, type StoredDossier, type ReadCacheEntry } from "@/lib/store";
import { DossierSchema } from "@/lib/dossier-schema";

// Fixture completo (parse preenche os blocos) para passar no tipo StoredDossier.
const dossier = DossierSchema.parse({ id: "dsr_acme", companyKey: "acme", company: "Acme", lang: "pt-BR", createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-01T00:00:00.000Z" });
const RESUME = { cabecalho: { nome: "Ana", titulo_profissional: "Dev", contatos: [{ tipo: "email" as const, valor: "a@a.com", link: null }] }, secoes: { resumo: "X", experiencia: [], formacao: [], habilidades: [], certificacoes: [], idiomas: [], projetos: [] } };

describe("store: dossiês", () => {
  beforeEach(() => { localStorage.clear(); });

  it("faz round-trip de dossiês", () => {
    saveDossiers([dossier]);
    expect(loadDossiers()).toHaveLength(1);
    expect(loadDossiers()[0].companyKey).toBe("acme");
  });

  it("descarta dossiê inválido pelo Zod e mantém os válidos", () => {
    localStorage.setItem("pmcv:dossiers", JSON.stringify([dossier, { garbage: true }]));
    expect(loadDossiers()).toHaveLength(1);
  });

  it("upsert por companyKey não duplica (id determinístico)", () => {
    upsertDossier(dossier);
    upsertDossier({ ...dossier, updatedAt: "2026-11-01T00:00:00.000Z" });
    const all = loadDossiers();
    expect(all).toHaveLength(1);
    expect(findDossierByCompany("acme")?.updatedAt).toBe("2026-11-01T00:00:00.000Z");
  });

  it("deleteDossier remove o dossiê e zera o dossierId das apps, preservando o match", () => {
    saveDossiers([dossier]);
    saveApps([{ id: "a1", jobText: "j", fileName: "f.pdf", resume: RESUME, cargo: "Vaga", empresa: "Acme", matchPercent: 50, strengths: ["a"], weaknesses: ["b"], emailBody: "e", chatMessage: "c", status: "done", errorLog: "", lang: "pt-BR", createdAt: "2026-10-01T00:00:00.000Z", dossierId: "dsr_acme", dossierMatch: { dossierId: "dsr_acme", appId: "a1", lang: "pt-BR", alignment: { score: 70, verdict: "vai", dimensions: [] }, attentionPoints: [], correlations: [], gaps: [], questions: [], outreach: [], redFlagSummary: [], sources: [], stale: false, createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-01T00:00:00.000Z" } }]);
    deleteDossier("dsr_acme");
    expect(loadDossiers()).toHaveLength(0);
    const app = loadApps()[0];
    expect(app.dossierId).toBeNull();
    expect(app.dossierMatch).not.toBeNull();
  });

  it("salva dossiê e sinaliza cota cheia com a mensagem de quota", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => { throw new DOMException("full", "QuotaExceededError"); });
    expect(() => saveDossiers([dossier])).toThrow(/Armazenamento cheio/);
    setItem.mockRestore();
  });

  it("saveDossiers lança com item inválido (valida na escrita, como saveBase)", () => {
    expect(() => saveDossiers([{ garbage: true } as unknown as StoredDossier])).toThrow();
  });

  it("saveReadCache lança com entrada inválida (valida na escrita)", () => {
    expect(() => saveReadCache([{ garbage: true } as unknown as ReadCacheEntry])).toThrow();
  });

  it("faz round-trip do cache de leitura", () => {
    saveReadCache([{ url: "https://a.com", content: "x", publishedAt: null, fetchedAt: "2026-10-01T00:00:00.000Z" }]);
    expect(loadReadCache()[0].url).toBe("https://a.com");
  });
});

describe("store: settings com research", () => {
  it("saveSettings MESCLA e não apaga as chaves de pesquisa", () => {
    saveSettings({ geminiKey: "K", models: ["m1"], research: { tavilyKey: "tvly-x", braveKey: "", jinaKey: "", youtubeKey: "", githubToken: "" } });
    saveSettings({ geminiKey: "K2", models: ["m1"] });
    expect(loadSettings().research.tavilyKey).toBe("tvly-x");
    expect(loadSettings().geminiKey).toBe("K2");
  });
});

describe("store: backup", () => {
  it("exportBackup inclui dossiês", () => {
    saveDossiers([dossier]);
    expect(JSON.parse(exportBackup()).dossiers).toHaveLength(1);
  });

  it("importBackup de backup ANTIGO (sem dossiês) preserva os dossiês locais", () => {
    saveDossiers([dossier]);
    importBackup(JSON.stringify({ base: null, apps: [] }));
    expect(loadDossiers()).toHaveLength(1);
  });

  it("importBackup com a chave dossiers SUBSTITUI os dossiês locais", () => {
    saveDossiers([dossier]);
    importBackup(JSON.stringify({ base: null, apps: [], dossiers: [{ ...dossier, id: "dsr_beta", companyKey: "beta" }] }));
    expect(loadDossiers().map((d) => d.companyKey)).toEqual(["beta"]);
  });
});

describe("store: wipeAll", () => {
  it("remove pmcv:dossiers e pmcv:readcache", () => {
    saveDossiers([dossier]);
    saveReadCache([{ url: "https://a.com", content: "x", publishedAt: null, fetchedAt: "2026-10-01T00:00:00.000Z" }]);
    wipeAll();
    expect(localStorage.getItem("pmcv:dossiers")).toBeNull();
    expect(localStorage.getItem("pmcv:readcache")).toBeNull();
  });
});
