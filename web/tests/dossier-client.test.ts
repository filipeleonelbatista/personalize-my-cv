// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { buildCorpus, buildSources, runDossierFromDocs, runDossierJob, runDossierMatch } from "@/lib/dossier-client";
import { DossierSchema } from "@/lib/dossier-schema";
import { loadApps, loadDossiers, loadReadCache, saveApps, saveBase, saveDossiers, saveSettings, StoredAppSchema } from "@/lib/store";

// Mesmo fixture inline de tests/store.test.ts (linha 6) — sem fixture compartilhado.
const RESUME = { cabecalho: { nome: "Ana", titulo_profissional: "Dev", contatos: [{ tipo: "email" as const, valor: "a@a.com", link: null }] }, secoes: { resumo: "X", experiencia: [], formacao: [], habilidades: [], certificacoes: [], idiomas: [], projetos: [] } };

const DOC_TEXT = "Title: Acme\n\nURL Source: https://acme.com\n\nPublished Time: Tue, 01 Sep 2026 10:00:00 GMT\n\n" + "conteúdo da página ".repeat(40);

const ISO = "2026-10-01T00:00:00.000Z";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

type StubOptions = {
  tavilyResults?: unknown[];
  jinaText?: string;
  brasilapi?: unknown;
  geminiText?: (user: string) => string;
};

function installFetch(opts: StubOptions = {}): Mock {
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("api.tavily.com")) {
      return json({ results: opts.tavilyResults ?? [{ url: "https://acme.com", title: "Acme", content: "sobre a acme" }] });
    }
    if (url.includes("r.jina.ai")) return new Response(opts.jinaText ?? DOC_TEXT, { status: 200 });
    if (url.includes("brasilapi")) return json(opts.brasilapi ?? {});
    if (url.includes("generativelanguage")) {
      const body = JSON.parse(String(init?.body ?? "{}")) as { contents?: { parts?: { text?: string }[] }[] };
      const user = body.contents?.[0]?.parts?.[0]?.text ?? "";
      const text = opts.geminiText
        ? opts.geminiText(user)
        : JSON.stringify({ history: { summary: "empresa" } });
      return json({ candidates: [{ content: { parts: [{ text }] } }] });
    }
    return json({}, 404);
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

function seedDossier(extra: Record<string, unknown> = {}) {
  const dossier = DossierSchema.parse({
    id: "dsr_acme",
    companyKey: "acme",
    company: "Acme",
    lang: "pt-BR",
    createdAt: ISO,
    updatedAt: ISO,
    ...extra,
  });
  saveDossiers([dossier]);
  return dossier;
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  saveBase({ resume: RESUME, lang: "pt-BR", updatedAt: new Date().toISOString() });
  saveSettings({
    geminiKey: "gemini-key",
    models: ["gemini-3.8-flash", "gemini-3.7-flash"],
    research: { tavilyKey: "tvly-key", braveKey: "", jinaKey: "", youtubeKey: "", githubToken: "" },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("runDossierJob", () => {
  it("persiste o dossiê em pmcv:dossiers com id determinístico", async () => {
    installFetch();
    const r = await runDossierJob({ company: "Acme", lang: "pt-BR" });
    expect(r.ok).toBe(true);
    expect(loadDossiers()).toHaveLength(1);
    expect(loadDossiers()[0].companyKey).toBe("acme");
    expect(loadDossiers()[0].id).toBe("dsr_acme");
    expect(loadDossiers()[0].sources[0].url).toBe("https://acme.com");
    expect(loadDossiers()[0].coverage).toHaveLength(7);
    expect(loadReadCache().map((entry) => entry.url)).toContain("https://acme.com");
  });

  it("preenche legal com os dados verbatim do registro (nunca do modelo)", async () => {
    installFetch({
      brasilapi: { razao_social: "ACME LTDA", nome_fantasia: "Acme", data_inicio_atividade: "2010-05-01", qsa: [] },
      geminiText: () => JSON.stringify({ history: { summary: "empresa" }, legal: { razaoSocial: "INVENTADA" } }),
    });
    const r = await runDossierJob({ company: "Acme", lang: "pt-BR", cnpj: "11222333000181" });
    expect(r.ok).toBe(true);
    expect(loadDossiers()[0].legal.razaoSocial).toBe("ACME LTDA");
    expect(loadDossiers()[0].cnpj).toBe("11222333000181");
  });

  it("reaproveita o dossiê existente sem refazer a pesquisa", async () => {
    const fetchMock = installFetch();
    const r1 = await runDossierJob({ company: "Acme", lang: "pt-BR" });
    expect(r1.ok).toBe(true);
    const before = fetchMock.mock.calls.length;
    const r2 = await runDossierJob({ company: "Acme", lang: "pt-BR" });
    expect(r2.ok).toBe(true);
    expect(fetchMock.mock.calls.length).toBe(before);
    expect(loadDossiers()).toHaveLength(1);
  });

  it("não chama a rede quando falta a chave de pesquisa", async () => {
    saveSettings({ research: { tavilyKey: "", braveKey: "", jinaKey: "", youtubeKey: "", githubToken: "" } });
    const fetchMock = installFetch();
    const r = await runDossierJob({ company: "Acme", lang: "pt-BR" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("noResearchKey");
    expect(r.dossier).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("persiste status failed com sources quando a síntese falha", async () => {
    installFetch({ geminiText: () => "{nao é json" });
    const r = await runDossierJob({ company: "Acme", lang: "pt-BR" });
    expect(r.ok).toBe(false);
    const [failed] = loadDossiers();
    expect(failed.status).toBe("failed");
    expect(failed.errorLog.length).toBeGreaterThan(0);
    expect(failed.sources[0].url).toBe("https://acme.com");
    expect(loadReadCache().map((entry) => entry.url)).toContain("https://acme.com");
    if (!r.ok) expect(r.error).toBe("dossierFailed");
  });

  it("chama onStage na ordem search/read/official/synthesize", async () => {
    installFetch();
    const stages: string[] = [];
    await runDossierJob({ company: "Acme", lang: "pt-BR", onStage: (s) => stages.push(s) });
    expect(stages).toContain("search");
    expect(stages).toContain("read");
    expect(stages).toContain("official");
    expect(stages).toContain("synthesize");
  });

  it("aplica o invariante: derruba URL inventada e preserva deep link lido", async () => {
    const text = `${DOC_TEXT}\n\nContato: Ana Real (RH) — https://www.linkedin.com/in/ana-real\nVídeo: https://acme.com/deep`;
    installFetch({
      jinaText: text,
      geminiText: (user) =>
        user.includes("reputation")
          ? JSON.stringify({
              reputation: {
                reviews: [],
                redFlags: [{ severity: "high", category: "cultura", title: "T", evidence: [{ claim: "c", sourceUrl: "https://acme.com/deep" }] }],
              },
              contacts: [
                { name: "Ana Real", role: "RH", kind: "rh", channel: "linkedin", url: "https://www.linkedin.com/in/ana-real" },
                { name: "Bob Falso", role: "CEO", kind: "executivo", channel: "linkedin", url: "https://www.linkedin.com/in/bob" },
              ],
              socials: [],
            })
          : JSON.stringify({
              history: { summary: "empresa" },
              leadership: { ceo: null },
              products: [{ name: "P", evidence: [{ claim: "c", sourceUrl: "https://fake.example/x" }] }],
            }),
    });
    const r = await runDossierJob({ company: "Acme", lang: "pt-BR" });
    expect(r.ok).toBe(true);
    const d = loadDossiers()[0];
    expect(d.products[0].evidence[0].sourceUrl).toBeNull();
    expect(d.products[0].evidence[0].unsourced).toBe(true);
    expect(d.reputation.redFlags).toHaveLength(1);
    expect(d.reputation.redFlags[0].evidence[0].sourceUrl).toBe("https://acme.com/deep");
    expect(d.contacts.map((c) => c.name)).toEqual(["Ana Real"]);
  });
});

describe("runDossierFromDocs", () => {
  it("re-sintetiza a partir dos docs sem pesquisar e preserva o legal", async () => {
    seedDossier({ cnpj: "11222333000181", legal: { razaoSocial: "ACME LTDA" } });
    const fetchMock = installFetch();
    const r = await runDossierFromDocs({
      company: "Acme",
      lang: "en",
      docs: [{ url: "https://acme.com", title: "Acme", publishedAt: "2026-09-01", content: DOC_TEXT, provider: "jina" }],
    });
    expect(r.ok).toBe(true);
    expect(fetchMock.mock.calls.every((call) => String(call[0]).includes("generativelanguage"))).toBe(true);
    const d = loadDossiers()[0];
    expect(d.lang).toBe("en");
    expect(d.legal.razaoSocial).toBe("ACME LTDA");
    expect(d.sources[0].url).toBe("https://acme.com");
  });
});

describe("runDossierMatch", () => {
  it("grava o match na candidatura usando o resume tailored", async () => {
    const dossier = seedDossier();
    const app = StoredAppSchema.parse({
      id: "a1",
      jobText: "vaga de devs",
      fileName: "f.pdf",
      resume: RESUME,
      cargo: "Dev",
      empresa: "Acme",
      matchPercent: 80,
      strengths: ["s"],
      weaknesses: ["w"],
      emailBody: "e",
      chatMessage: "c",
      status: "done",
      errorLog: "",
      lang: "pt-BR",
      createdAt: ISO,
    });
    saveApps([app]);
    installFetch({
      geminiText: () =>
        JSON.stringify({
          alignment: { score: 70, verdict: "vai", dimensions: [] },
          attentionPoints: ["a"],
          correlations: [],
          gaps: [],
          questions: [],
          outreach: [],
          redFlagSummary: [],
          sources: [],
        }),
    });
    const r = await runDossierMatch(loadApps()[0]);
    expect(r.ok).toBe(true);
    const saved = loadApps()[0];
    expect(saved.dossierMatch?.alignment.score).toBe(70);
    expect(saved.dossierId).toBe(dossier.id);
    expect(saved.dossierMatch?.createdAt).toBeTruthy();
    expect(saved.dossierMatch?.updatedAt).toBeTruthy();
  });

  it("devolve notFound quando não há dossiê da empresa", async () => {
    const app = StoredAppSchema.parse({
      id: "a1",
      jobText: "j",
      fileName: "f.pdf",
      resume: RESUME,
      cargo: "Dev",
      empresa: "Nope",
      matchPercent: 80,
      strengths: ["s"],
      weaknesses: ["w"],
      emailBody: "e",
      chatMessage: "c",
      status: "done",
      createdAt: ISO,
    });
    saveApps([app]);
    const fetchMock = installFetch();
    const r = await runDossierMatch(loadApps()[0]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/encontrado|not found/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("buildCorpus / buildSources", () => {
  it("inclui título, url e data de cada documento", () => {
    const c = buildCorpus([{ url: "https://a.com", title: "A", publishedAt: "2026-09-01", content: "texto", provider: "jina" }]);
    expect(c).toContain("https://a.com");
    expect(c).toContain("A");
    expect(c).toContain("2026-09-01");
  });

  it("devolve (sem documentos) com corpus vazio", () => {
    expect(buildCorpus([])).toBe("(sem documentos)");
  });

  it("deduplica sources por URL canônica", () => {
    const sources = buildSources([
      { url: "https://www.a.com/x/", title: "A", publishedAt: null, content: "1", provider: "jina" },
      { url: "https://a.com/x", title: "A2", publishedAt: null, content: "2", provider: "jina" },
      { url: "https://b.com", title: "B", publishedAt: null, content: "3", provider: "tavily" },
    ]);
    expect(sources.map((s) => s.url)).toEqual(["https://a.com/x", "https://b.com"]);
    expect(sources[0].provider).toBe("jina");
  });
});
