import { describe, expect, it, vi } from "vitest";
import { applyEvidenceInvariant, computeCoverage, companyKey, isPlaceholderCompany, normalizeDate, normalizeDossier, normalizeKind, normalizeSeverity, normalizeVerdict } from "@/lib/dossier";
import { canonicalUrl, dedupeUrls, fetchWithTimeout } from "@/lib/research/providers";

const base = {
  id: "dsr_acme", companyKey: "acme", company: "Acme", lang: "pt-BR" as const,
  createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-01T00:00:00.000Z",
};

const invalidFlag = {
  severity: "high" as const, category: "cultura" as const, title: "t", detail: "", date: null,
  evidence: [{ claim: "c", sourceUrl: "https://inventado.com/x", sourceTitle: "", date: null, quote: "", origin: "web" as const, unsourced: false }],
  mitigation: null,
};

describe("companyKey", () => {
  it("normaliza caixa, acento e sufixo societário", () => {
    expect(companyKey("Nu Pagamentos S.A.")).toBe("nu-pagamentos");
    expect(companyKey("ACME Ltda")).toBe("acme");
    expect(companyKey(" .Cloud  Corp ")).toBe("cloud");
  });
});

describe("isPlaceholderCompany", () => {
  it("reconhece o placeholder MISSING_JOB de cada idioma", () => {
    expect(isPlaceholderCompany("Empresa", "pt-BR")).toBe(true);
    expect(isPlaceholderCompany("Company", "en")).toBe(true);
    expect(isPlaceholderCompany("Empresa", "es")).toBe(true);
  });
  it("não confunde uma empresa chamada parecido com o placeholder", () => {
    expect(isPlaceholderCompany("Empresa X", "pt-BR")).toBe(false);
    expect(isPlaceholderCompany("Acme", "pt-BR")).toBe(false);
  });
});

describe("invariante de evidência", () => {
  // O fixture do plano tinha uma única evidência inválida e, ao mesmo tempo,
  // esperava inspecioná-la depois do invariante — mas um red flag sem evidência
  // válida é descartado. A segunda evidência (válida) mantém o red flag vivo
  // para que a remoção da URL inventada seja observável.
  it("remove URL fora do corpus e marca a evidência como unsourced", () => {
    const d = {
      ...base,
      reputation: {
        reviews: [],
        redFlags: [{
          ...invalidFlag,
          evidence: [
            ...invalidFlag.evidence,
            { claim: "ok", sourceUrl: "https://lido.com/y", sourceTitle: "", date: null, quote: "", origin: "web" as const, unsourced: false },
          ],
        }],
      },
    };
    const out = applyEvidenceInvariant(d as never, ["https://lido.com/y"]);
    const ev = out.reputation.redFlags[0].evidence[0];
    expect(ev.sourceUrl).toBeNull();
    expect(ev.unsourced).toBe(true);
    expect(out.reputation.redFlags[0].evidence[1].sourceUrl).toBe("https://lido.com/y");
    expect(out.reputation.redFlags[0].evidence[1].unsourced).toBe(false);
  });

  it("mantém URL que está no corpus", () => {
    const d = {
      ...base,
      reputation: { reviews: [], redFlags: [{
        severity: "high" as const, category: "cultura" as const, title: "t", detail: "", date: null,
        evidence: [{ claim: "c", sourceUrl: "https://lido.com/y", sourceTitle: "", date: null, quote: "", origin: "web" as const, unsourced: false }],
        mitigation: null,
      }] },
    };
    const out = applyEvidenceInvariant(d as never, ["https://lido.com/y"]);
    expect(out.reputation.redFlags[0].evidence[0].sourceUrl).toBe("https://lido.com/y");
    expect(out.reputation.redFlags[0].evidence[0].unsourced).toBe(false);
  });

  it("descarta red flag sem nenhuma evidência válida", () => {
    const d = { ...base, reputation: { reviews: [], redFlags: [{ ...invalidFlag }] } };
    expect(applyEvidenceInvariant(d as never, ["https://lido.com/y"]).reputation.redFlags).toHaveLength(0);
  });

  it("não aceita origin=user do modelo como substituto de URL no corpus", () => {
    const d = {
      ...base,
      reputation: { reviews: [], redFlags: [{
        severity: "high" as const, category: "cultura" as const, title: "t", detail: "", date: null, mitigation: null,
        evidence: [{ claim: "c", sourceUrl: null, sourceTitle: "", date: null, quote: "", origin: "user" as const, unsourced: false }],
      }] },
    };
    expect(applyEvidenceInvariant(d as never, []).reputation.redFlags).toHaveLength(0);
  });

  it("descarta review sem URL no corpus", () => {
    const d = { ...base, reputation: { reviews: [{ source: "glassdoor" as const, sentiment: "pro" as const, topic: "", date: null, quote: "q", sourceUrl: "https://inventado.com/r" }], redFlags: [] } };
    expect(applyEvidenceInvariant(d as never, []).reputation.reviews).toHaveLength(0);
  });

  it("descarta review sem URL (não há como verificar a fonte)", () => {
    const d = { ...base, reputation: { reviews: [{ source: "other" as const, sentiment: "contra" as const, topic: "demissão", date: null, quote: "q", sourceUrl: null }], redFlags: [] } };
    expect(applyEvidenceInvariant(d as never, []).reputation.reviews).toHaveLength(0);
  });

  it("mantém review que cita material do usuário no corpus", () => {
    const d = { ...base, reputation: { reviews: [{ source: "other" as const, sentiment: "contra" as const, topic: "demissão", date: null, quote: "q", sourceUrl: "pmcv:material:1" }], redFlags: [] } };
    const out = applyEvidenceInvariant(d as never, ["pmcv:material:1"]);
    expect(out.reputation.reviews).toHaveLength(1);
    expect(out.reputation.reviews[0].sourceUrl).toBe("pmcv:material:1");
  });

  it("limpa evidências de produtos e highlights do CEO fora do corpus", () => {
    const d = {
      ...base,
      leadership: { ceo: { name: "Ana", role: "", bio: "", highlights: [
        { claim: "ok", sourceUrl: "https://lido.com/ceo", sourceTitle: "", date: null, quote: "", origin: "web" as const, unsourced: false },
        { claim: "bad", sourceUrl: "https://inventado.com/ceo", sourceTitle: "", date: null, quote: "", origin: "web" as const, unsourced: false },
      ] } },
      products: [{ name: "P", description: "", customerSignal: "", evidence: [
        { claim: "ok", sourceUrl: "https://lido.com/p", sourceTitle: "", date: null, quote: "", origin: "web" as const, unsourced: false },
        { claim: "bad", sourceUrl: "https://inventado.com/p", sourceTitle: "", date: null, quote: "", origin: "web" as const, unsourced: false },
      ] }],
    };
    const out = applyEvidenceInvariant(d as never, ["https://lido.com/ceo", "https://lido.com/p"]);
    expect(out.leadership.ceo?.highlights[0].sourceUrl).toBe("https://lido.com/ceo");
    expect(out.leadership.ceo?.highlights[1].sourceUrl).toBeNull();
    expect(out.leadership.ceo?.highlights[1].unsourced).toBe(true);
    expect(out.products[0].evidence[0].sourceUrl).toBe("https://lido.com/p");
    expect(out.products[0].evidence[1].sourceUrl).toBeNull();
    expect(out.products[0].evidence[1].unsourced).toBe(true);
  });

  it("zera URL de rede social e de post fora do corpus, mantendo a entrada", () => {
    const d = {
      ...base,
      socials: [
        { network: "linkedin" as const, handle: "acme", tone: "", url: "https://lido.com/in/acme", posts: [
          { date: null, text: "", url: "https://lido.com/post" },
          { date: null, text: "", url: "https://inventado.com/post" },
        ] },
        { network: "instagram" as const, handle: "acme", tone: "", url: "https://inventado.com/ig", posts: [] },
      ],
    };
    const out = applyEvidenceInvariant(d as never, ["https://lido.com/in/acme", "https://lido.com/post"]);
    expect(out.socials).toHaveLength(2);
    expect(out.socials[0].url).toBe("https://lido.com/in/acme");
    expect(out.socials[0].posts[0].url).toBe("https://lido.com/post");
    expect(out.socials[0].posts[1].url).toBeNull();
    expect(out.socials[1].url).toBeNull();
  });

  it("não muta o dossiê original", () => {
    const d = { ...base, reputation: { reviews: [], redFlags: [{ ...invalidFlag }] } };
    const before = JSON.stringify(d);
    applyEvidenceInvariant(d as never, []);
    expect(JSON.stringify(d)).toBe(before);
  });

  it("filtra contato cujo nome não aparece no corpus textual e zera URL fora do corpus", () => {
    const d = {
      ...base,
      contacts: [
        { name: "Ana Silva", role: "", kind: "rh" as const, channel: "linkedin" as const, url: "https://inventado.com/ana", hint: "", confidence: "high" as const },
        { name: "Bob Souza", role: "", kind: "gestor" as const, channel: "linkedin" as const, url: "https://lido.com/bob", hint: "", confidence: "high" as const },
      ],
    };
    const out = applyEvidenceInvariant(d as never, ["https://lido.com/bob"], "A Ana Silva é gerente de RH.");
    expect(out.contacts.map((c) => c.name)).toEqual(["Ana Silva"]);
    expect(out.contacts[0].url).toBeNull();
    expect(out.contacts[0].confidence).toBe("low");
  });
});

describe("cobertura", () => {
  it("marca 'ausente' quando a seção está vazia e 'parcial' quando falta um campo", () => {
    const vazio = { ...base, history: { founded: null, timeline: [], mission: null, vision: null, values: [], summary: "" }, contacts: [], products: [], socials: [], leadership: { ceo: null }, reputation: { reviews: [], redFlags: [] }, legal: {} };
    const cov = computeCoverage(vazio as never);
    expect(cov.find((c) => c.section === "historia")?.status).toBe("ausente");
    expect(cov.find((c) => c.section === "contatos")?.status).toBe("ausente");
    const parcial = { ...vazio, history: { founded: "2010", timeline: [], mission: null, vision: null, values: [], summary: "" } };
    expect(computeCoverage(parcial as never).find((c) => c.section === "historia")?.status).toBe("parcial");
  });

  it("marca reputação parcial quando os itens não têm evidência válida", () => {
    const d = {
      ...base,
      reputation: {
        reviews: [],
        redFlags: [{
          severity: "high" as const, category: "cultura" as const, title: "t", mitigation: null,
          evidence: [{ claim: "c", sourceUrl: null, sourceTitle: "", date: null, quote: "", origin: "web" as const, unsourced: true }],
        }],
      },
    };
    expect(computeCoverage(d as never).find((c) => c.section === "reputacao")?.status).toBe("parcial");
  });

  it("devolve as 7 seções na ordem do schema", () => {
    const d = { ...base, history: { founded: null, timeline: [], mission: null, vision: null, values: [], summary: "" }, contacts: [], products: [], socials: [], leadership: { ceo: null }, reputation: { reviews: [], redFlags: [] }, legal: {} };
    expect(computeCoverage(d as never).map((c) => c.section)).toEqual([
      "historia", "lideranca", "produtos", "reputacao", "contatos", "redes", "cnpj",
    ]);
  });
});

describe("normalização de enums", () => {
  it("aceita variantes em português e devolve o literal em inglês", () => {
    expect(normalizeSeverity("alta")).toBe("high");
    expect(normalizeSeverity("HIGH")).toBe("high");
    expect(normalizeSeverity("média")).toBe("medium");
    expect(normalizeSeverity("qualquer")).toBe("medium");
    expect(normalizeSeverity("baixa")).toBe("low");
    expect(normalizeSeverity("LOW")).toBe("low");
    expect(normalizeVerdict("vai")).toBe("vai");
    expect(normalizeVerdict("Cautela")).toBe("cautela");
    expect(normalizeVerdict("desistir")).toBe("desistir");
    expect(normalizeVerdict("no-go")).toBe("desistir");
    expect(normalizeVerdict("qualquer")).toBe("cautela");
  });

  it("normaliza os tipos de contato", () => {
    expect(normalizeKind("recrutador")).toBe("rh");
    expect(normalizeKind("gerente")).toBe("gestor");
    expect(normalizeKind("CEO")).toBe("executivo");
    expect(normalizeKind("dpo")).toBe("dpo");
    expect(normalizeKind("qualquer")).toBe("other");
  });
});

describe("normalizeDate", () => {
  it("aceita YYYY-MM e YYYY-MM-DD sem alterar", () => {
    expect(normalizeDate("2026-10")).toBe("2026-10");
    expect(normalizeDate("2026-10-05")).toBe("2026-10-05");
    expect(normalizeDate("2024-02-29")).toBe("2024-02-29");
  });

  it("devolve null para vazio, formato inválido ou não-string", () => {
    for (const value of ["", "2026", "2026-1", "2026-13", "2026-10-32", "2023-02-29", "10/2026", null, undefined, 20261005]) {
      expect(normalizeDate(value)).toBeNull();
    }
  });
});

describe("normalizeDossier", () => {
  it("aplica os enums antes do parse e deixa o envelope vencer o modelo", () => {
    const envelope = { ...base, cnpj: null };
    const out = normalizeDossier({
      id: "dsr_inventado", companyKey: "inventado", company: "Inventado", lang: "en",
      status: "failed", errorLog: "modelo tentou escrever",
      legal: { razaoSocial: "Inventada S.A.", openedAt: "1999-01-01" },
      reputation: {
        reviews: [{ source: "glassdoor", sentiment: "pro", topic: "", quote: "q", sourceUrl: "pmcv:material:1", date: "2026-13-01" }],
        redFlags: [{ severity: "alta", category: "cultura", title: "t", evidence: [{ claim: "c", origin: "web", date: "2026-10-05" }] }],
      },
      leadership: { ceo: { name: "Ana", highlights: [{ claim: "c", date: "invalida" }] } },
      products: [{ name: "P", evidence: [{ claim: "c", date: "2026-10" }] }],
      contacts: [{ name: "Ana", kind: "gerente", channel: "linkedin" }],
      coverage: [{ section: "historia", status: "ok" }],
      sources: [{ url: "https://inventado.com/x", retrievedAt: base.createdAt, provider: "tavily" }],
    }, envelope);
    expect(out.id).toBe("dsr_acme");
    expect(out.companyKey).toBe("acme");
    expect(out.company).toBe("Acme");
    expect(out.lang).toBe("pt-BR");
    expect(out.status).toBe("done");
    expect(out.errorLog).toBe("");
    expect(out.legal.razaoSocial).toBeNull();
    expect(out.legal.openedAt).toBeNull();
    expect(out.reputation.redFlags[0].severity).toBe("high");
    expect(out.reputation.redFlags[0].evidence[0].date).toBe("2026-10-05");
    expect(out.reputation.reviews[0].date).toBeNull();
    expect(out.leadership.ceo?.highlights[0].date).toBeNull();
    expect(out.products[0].evidence[0].date).toBe("2026-10");
    expect(out.contacts[0].kind).toBe("gestor");
    expect(out.coverage).toEqual([]);
    expect(out.sources).toEqual([]);
  });
});

describe("URLs canônicas", () => {
  it("remove hash, tracking e normaliza host/protocolo", () => {
    expect(canonicalUrl("http://www.Example.com/a/?utm_source=x&fbclid=y#top")).toBe("https://example.com/a");
    expect(dedupeUrls(["https://www.acme.com/", "https://acme.com", "http://acme.com/#x"])).toEqual(["https://acme.com"]);
  });

  it("remove prefixos www/m repetidos e barras finais repetidas", () => {
    expect(canonicalUrl("https://www.m.Example.com///")).toBe("https://example.com");
  });
});

describe("fetchWithTimeout", () => {
  const hangingFetch = () => vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
  }));

  it("ainda aborta pelo timeout quando o chamador passa um signal", async () => {
    vi.stubGlobal("fetch", hangingFetch());
    try {
      await expect(fetchWithTimeout("https://x.com", { signal: new AbortController().signal }, 10)).rejects.toMatchObject({ name: "AbortError" });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("propaga o abort do signal do chamador", async () => {
    vi.stubGlobal("fetch", hangingFetch());
    const caller = new AbortController();
    try {
      const pending = fetchWithTimeout("https://x.com", { signal: caller.signal }, 10_000);
      caller.abort();
      await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
