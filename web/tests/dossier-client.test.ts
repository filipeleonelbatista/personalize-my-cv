// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { buildCorpus, buildSources, runDossierFromDocs, runDossierJob, runDossierMatch } from "@/lib/dossier-client";
import { DossierSchema } from "@/lib/dossier-schema";
import { tErr } from "@/lib/i18n/locale";
import { loadApps, loadDossiers, loadReadCache, saveApps, saveBase, saveDossiers, saveReadCache, saveSettings, StoredAppSchema } from "@/lib/store";

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

function makeApp(overrides: Record<string, unknown> = {}) {
  return StoredAppSchema.parse({
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
    ...overrides,
  });
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.stubEnv("NEXT_PUBLIC_IS_DOSSIE_ENABLED", "true");
  vi.stubEnv("NEXT_PUBLIC_TAVILY_API_KEY", "tvly-key");
  vi.stubEnv("NEXT_PUBLIC_BRAVE_API_KEY", "brave-key");
  vi.stubEnv("NEXT_PUBLIC_JINA_API_KEY", "jina-key");
  vi.stubEnv("NEXT_PUBLIC_YOUTUBE_API_KEY", "youtube-key");
  vi.stubEnv("NEXT_PUBLIC_GITHUB_TOKEN", "github-token");
  saveBase({ resume: RESUME, lang: "pt-BR", updatedAt: new Date().toISOString() });
  saveSettings({
    geminiKey: "gemini-key",
    models: ["gemini-3.8-flash", "gemini-3.7-flash"],
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("runDossierJob", () => {
  it("persiste o dossiê em pmcv:dossiers com id determinístico", async () => {
    const fetchMock = installFetch();
    const r = await runDossierJob({ company: "Acme", lang: "pt-BR" });
    expect(r.ok).toBe(true);
    const tavilyCall = fetchMock.mock.calls.find((call) => String(call[0]).includes("api.tavily.com"));
    const jinaCall = fetchMock.mock.calls.find((call) => String(call[0]).includes("r.jina.ai"));
    expect((tavilyCall?.[1] as RequestInit | undefined)?.headers).toMatchObject({ Authorization: "Bearer tvly-key" });
    expect((jinaCall?.[1] as RequestInit | undefined)?.headers).toMatchObject({ Authorization: "Bearer jina-key" });
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

  it("não chama a rede quando falta qualquer credencial de pesquisa do ambiente", async () => {
    vi.stubEnv("NEXT_PUBLIC_BRAVE_API_KEY", "");
    const fetchMock = installFetch();
    const r = await runDossierJob({ company: "Acme", lang: "pt-BR" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe(tErr("pt-BR", "dossierDisabled"));
    expect(r.dossier).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("bloqueia a flag false mesmo com todas as credenciais presentes", async () => {
    vi.stubEnv("NEXT_PUBLIC_IS_DOSSIE_ENABLED", "false");
    const fetchMock = installFetch();
    const r = await runDossierJob({ company: "Acme", lang: "pt-BR" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe(tErr("pt-BR", "dossierDisabled"));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("bloqueia síntese manual e análise de candidatura quando o dossiê está desabilitado", async () => {
    vi.stubEnv("NEXT_PUBLIC_IS_DOSSIE_ENABLED", "false");
    seedDossier();
    saveApps([makeApp()]);
    const fetchMock = installFetch();
    const docsResult = await runDossierFromDocs({
      company: "Acme",
      lang: "pt-BR",
      docs: [{ url: "https://acme.com", title: "Acme", publishedAt: null, content: DOC_TEXT, provider: "jina" }],
    });
    const matchResult = await runDossierMatch(loadApps()[0]);
    expect(docsResult.ok).toBe(false);
    expect(matchResult.ok).toBe(false);
    if (!docsResult.ok) expect(docsResult.error).toBe(tErr("pt-BR", "dossierDisabled"));
    if (!matchResult.ok) expect(matchResult.error).toBe(tErr("pt-BR", "dossierDisabled"));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("não dispara pesquisa sem chave Gemini", async () => {
    saveSettings({ geminiKey: "" });
    const fetchMock = installFetch();
    const r = await runDossierJob({ company: "Acme", lang: "pt-BR" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe(tErr("pt-BR", "noKey"));
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
    if (!r.ok) expect(r.error).toBe(tErr("pt-BR", "dossierFailed"));
  });

  it("tenta o reparo uma vez quando o JSON é válido mas o Zod falha", async () => {
    const fetchMock = installFetch({
      geminiText: (user) => {
        if (user.includes("Corrija este JSON")) {
          return JSON.stringify({
            history: { summary: "reparado" },
            products: [],
            reputation: { reviews: [], redFlags: [] },
            contacts: [],
            socials: [],
          });
        }
        if (user.includes("reputation")) return JSON.stringify({ reputation: "invalido" });
        return JSON.stringify({ products: "invalido" });
      },
    });
    const r = await runDossierJob({ company: "Acme", lang: "pt-BR" });
    expect(r.ok).toBe(true);
    expect(loadDossiers()[0].history.summary).toBe("reparado");
    const geminiCalls = fetchMock.mock.calls.filter((call) => String(call[0]).includes("generativelanguage"));
    expect(geminiCalls).toHaveLength(3); // A + B + 1 reparo
  });

  it("retry de dossiê failed usa o readcache sem refazer buscas", async () => {
    installFetch({ geminiText: () => "{nao é json" });
    const first = await runDossierJob({ company: "Acme", lang: "pt-BR" });
    expect(first.ok).toBe(false);
    expect(loadDossiers()[0].status).toBe("failed");

    // O retry deve funcionar do cache sem disparar outra busca.
    const retryFetch = installFetch({ geminiText: () => JSON.stringify({ history: { summary: "do cache" } }) });
    const stages: string[] = [];
    const retry = await runDossierJob({ company: "Acme", lang: "pt-BR", onStage: (s) => stages.push(s) });

    expect(retry.ok).toBe(true);
    expect(retryFetch.mock.calls.every((call) => String(call[0]).includes("generativelanguage"))).toBe(true);
    expect(stages).toEqual(["synthesize"]);
    expect(loadDossiers()[0].status).toBe("done");
    expect(loadDossiers()[0].history.summary).toBe("do cache");
  });

  it("chama onStage na ordem search/official/read/synthesize", async () => {
    installFetch();
    const stages: string[] = [];
    await runDossierJob({ company: "Acme", lang: "pt-BR", onStage: (s) => stages.push(s) });
    expect(stages).toEqual(["search", "official", "read", "synthesize"]);
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

  it("não substitui um dossiê done quando a re-síntese falha", async () => {
    seedDossier({ history: { summary: "bom" } });
    installFetch({ geminiText: () => "{nao é json" });
    const r = await runDossierFromDocs({
      company: "Acme",
      lang: "en",
      docs: [{ url: "https://acme.com", title: "Acme", publishedAt: null, content: DOC_TEXT, provider: "jina" }],
    });
    expect(r.ok).toBe(false);
    expect(r.dossier).toBeNull();
    const [kept] = loadDossiers();
    expect(kept.status).toBe("done");
    expect(kept.history.summary).toBe("bom");
    expect(kept.lang).toBe("pt-BR");
  });

  it("mantém citável a URL de docs além do teto de 40 sources", async () => {
    const docs = Array.from({ length: 41 }, (_, i) => ({
      url: `https://site.example/doc-${i}`,
      title: `Doc ${i}`,
      publishedAt: null,
      content: `conteúdo ${i}`,
      provider: "jina" as const,
    }));
    installFetch({
      geminiText: (user) =>
        user.includes("reputation")
          ? JSON.stringify({ reputation: { reviews: [], redFlags: [] }, contacts: [], socials: [] })
          : JSON.stringify({
              history: { summary: "x" },
              products: [{ name: "P", evidence: [{ claim: "c", sourceUrl: docs[40].url }] }],
            }),
    });
    const r = await runDossierFromDocs({ company: "Acme", lang: "pt-BR", docs });
    expect(r.ok).toBe(true);
    const d = loadDossiers()[0];
    expect(d.sources).toHaveLength(40);
    expect(d.products[0].evidence[0].sourceUrl).toBe(docs[40].url);
  });

  it("pula entradas do readcache que não couberem, sem descartar as antigas menores", async () => {
    saveReadCache([{ url: "https://antigo.example", content: "curto", publishedAt: null, fetchedAt: new Date(Date.now() - 60_000).toISOString() }]);
    const docs = Array.from({ length: 4 }, (_, i) => ({
      url: `https://grande.example/${i}`,
      title: `G${i}`,
      publishedAt: null,
      content: "x".repeat(50_000),
      provider: "jina" as const,
    }));
    installFetch();
    const r = await runDossierFromDocs({ company: "Acme", lang: "pt-BR", docs });
    expect(r.ok).toBe(true);
    const cache = loadReadCache();
    expect(cache.map((entry) => entry.url)).toContain("https://antigo.example");
    expect(cache.length).toBeGreaterThanOrEqual(4);
    expect(JSON.stringify(cache).length).toBeLessThanOrEqual(150 * 1024);
  });
});

describe("runDossierMatch", () => {
  it("grava o match na candidatura usando o resume tailored", async () => {
    const dossier = seedDossier();
    const app = makeApp();
    saveApps([app]);
    const fetchMock = installFetch({
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
    const geminiCall = fetchMock.mock.calls.find((call) => String(call[0]).includes("generativelanguage"));
    const body = String((geminiCall?.[1] as RequestInit | undefined)?.body ?? "");
    expect(body).toContain("vaga de devs");
    expect(body).toContain("Ana");
  });

  it("devolve notFound quando não há dossiê da empresa", async () => {
    const app = makeApp({ id: "a2", jobText: "j", empresa: "Nope" });
    saveApps([app]);
    const fetchMock = installFetch();
    const r = await runDossierMatch(loadApps()[0]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/encontrado|not found/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("guarda o detalhe técnico no errorLog da candidatura quando o match falha", async () => {
    seedDossier();
    saveApps([makeApp()]);
    installFetch({ geminiText: () => "{nao é json" });
    const r = await runDossierMatch(loadApps()[0]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe(tErr("pt-BR", "dossierFailed"));
    expect(loadApps()[0].errorLog).toContain("gemini-3.8-flash");
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
