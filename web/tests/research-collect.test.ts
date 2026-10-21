import { afterEach, describe, expect, it, vi } from "vitest";
import { buildQueryPlan } from "@/lib/research/queries";
import { collectCompany } from "@/lib/research/collect";

afterEach(() => vi.restoreAllMocks());

const hit = (url: string) => ({ url, title: "t", snippet: "s", publishedAt: null });
const okRead = (url = "") => ({ url, title: "t", publishedAt: null, content: "x".repeat(300), provider: "jina" as const });

describe("query plan", () => {
  it("cobre as 7 seções e inclui a query de CNPJ", () => {
    const plan = buildQueryPlan("Acme", "pt-BR");
    const sections = new Set(plan.map((p) => p.section));
    for (const s of ["historia", "lideranca", "produtos", "reputacao", "contatos", "redes", "cnpj"]) expect(sections.has(s as never)).toBe(true);
    expect(plan.some((p) => p.query.includes("cnpj"))).toBe(true);
  });

  it("inclui o nome da empresa entre aspas", () => {
    expect(buildQueryPlan("Acme", "pt-BR").every((p) => p.query.includes('"Acme"'))).toBe(true);
  });
});

describe("collect", () => {
  it("respeita o teto de buscas e de leituras", async () => {
    const search = vi.fn().mockResolvedValue([hit("https://a.com/1")]);
    const read = vi.fn().mockResolvedValue(okRead("https://a.com/1"));
    await collectCompany({ company: "Acme", lang: "pt-BR", search, read });
    expect(search.mock.calls.length).toBeLessThanOrEqual(22);
    expect(read.mock.calls.length).toBeLessThanOrEqual(15);
  });

  it("nunca deixa o caller subir o teto de buscas", async () => {
    const search = vi.fn().mockResolvedValue([]);
    const read = vi.fn();
    // lang en: 21 PT + 6 variantes = 27 no plano; teto clampa em 22.
    const res = await collectCompany({ company: "Acme", lang: "en", search, read, maxSearches: 50 });
    expect(res.searchesUsed).toBe(22);
    expect(search.mock.calls.length).toBe(22);
  });

  it("aceita teto menor vindo do caller", async () => {
    const search = vi.fn().mockResolvedValue([]);
    const read = vi.fn();
    const res = await collectCompany({ company: "Acme", lang: "pt-BR", search, read, maxSearches: 3 });
    expect(res.searchesUsed).toBe(3);
    expect(search.mock.calls.length).toBe(3);
  });

  it("respeita o teto de 15 leituras com muitos hits distintos", async () => {
    let n = 0;
    const search = vi.fn(() => {
      const k = n++;
      return Promise.resolve(Array.from({ length: 6 }, (_, i) => hit(`https://q${k}-${i}.com/x`)));
    });
    const read = vi.fn().mockResolvedValue(okRead());
    const res = await collectCompany({ company: "Acme", lang: "pt-BR", search, read });
    expect(res.searchesUsed).toBe(21);
    expect(res.readsUsed).toBe(15);
    expect(read.mock.calls.length).toBe(15);
  });

  it("respeita a cota de 4 leituras por seção", async () => {
    const search = vi.fn((q: string) => {
      if (q.includes("site oficial")) return Promise.resolve([]);
      if (q.includes("linkedin.com/in") || q.includes("recruiter") || q.includes("head of") || q.includes("rh OR")) {
        return Promise.resolve(Array.from({ length: 8 }, (_, i) => hit(`https://contato-${i}.com/p`)));
      }
      return Promise.resolve([]);
    });
    const read = vi.fn().mockResolvedValue(okRead());
    const res = await collectCompany({ company: "Acme", lang: "pt-BR", search, read });
    expect(res.readsUsed).toBe(4);
    expect(res.docs).toHaveLength(4);
  });

  it("deduplica URLs e lê no máximo uma vez", async () => {
    const search = vi.fn().mockResolvedValue([hit("https://a.com/1"), hit("https://www.a.com/1/")]);
    const read = vi.fn().mockResolvedValue(okRead("https://a.com/1"));
    const res = await collectCompany({ company: "Acme", lang: "pt-BR", search, read, maxSearches: 2, maxReads: 5 });
    expect(read.mock.calls.length).toBe(1);
    expect(res.docs).toHaveLength(1);
  });

  it("usa o cache e não relê a mesma URL", async () => {
    const doc = okRead("https://a.com/1");
    const cache = new Map([["https://a.com/1", doc]]);
    const search = vi.fn().mockResolvedValue([hit("https://a.com/1")]);
    const read = vi.fn();
    const res = await collectCompany({ company: "Acme", lang: "pt-BR", search, read, cache, maxSearches: 2 });
    expect(read).not.toHaveBeenCalled();
    expect(res.docs).toHaveLength(1);
  });

  it("registra a falha de leitura com a seção e segue sem a página", async () => {
    const search = vi.fn().mockResolvedValue([hit("https://a.com/1")]);
    const read = vi.fn().mockRejectedValue(new Error("jina blocked"));
    const res = await collectCompany({ company: "Acme", lang: "pt-BR", search, read, maxSearches: 2 });
    expect(res.docs).toHaveLength(0);
    const readFailure = res.failures.find((f) => f.url === "https://a.com/1");
    expect(readFailure?.section).toBe("contatos");
    expect(readFailure?.reason).toBe("jina blocked");
  });

  it("emite os estágios search -> official -> read", async () => {
    const stages: string[] = [];
    const search = vi.fn().mockResolvedValue([]);
    const read = vi.fn();
    await collectCompany({ company: "Acme", lang: "pt-BR", search, read, onStage: (s) => stages.push(s) });
    expect(stages).toEqual(["search", "official", "read"]);
  });

  it("pula a variante de idioma quando a seção PT já tem hits", async () => {
    const search = vi.fn().mockResolvedValue([hit("https://a.com/1")]);
    const read = vi.fn();
    const res = await collectCompany({ company: "Acme", lang: "en", search, read });
    // Todas as seções voltaram com hits: nenhuma variante gasta crédito.
    expect(res.searchesUsed).toBe(21);
    expect(search.mock.calls.every(([q]) => !q.includes("about history founded") && !q.includes("official site"))).toBe(true);
  });

  it("roda a variante de idioma quando a seção ficou vazia", async () => {
    const search = vi.fn((q: string) => {
      const contatos = q.includes("site oficial") || q.includes("linkedin.com/in") || q.includes("recruiter") || q.includes("head of") || q.includes("rh OR");
      const historia = q.includes("sobre nós") || q.includes("fundada em") || q.includes("missão");
      return Promise.resolve(contatos || historia ? [hit("https://a.com/1")] : []);
    });
    const read = vi.fn();
    const res = await collectCompany({ company: "Acme", lang: "en", search, read });
    // 21 PT + 1 variante (lideranca, seção vazia) até o teto de 22; contatos/historia com hits pulam as variantes.
    expect(res.searchesUsed).toBe(22);
    expect(search.mock.calls.some(([q]) => q.includes("CEO founder owner director"))).toBe(true);
    expect(search.mock.calls.some(([q]) => q.includes("company official site contact"))).toBe(false);
    expect(search.mock.calls.some(([q]) => q.includes("company about history founded"))).toBe(false);
  });

  it("descarta o CNPJ de empresa homônima sem token em comum", async () => {
    const search = vi.fn((q: string) =>
      Promise.resolve(
        q.includes("cnpj")
          ? [{ url: "https://a.com/cnpj", title: "Consulta empresa", snippet: "CNPJ 12.345.678/0001-99 aberta em 2010", publishedAt: null }]
          : [],
      ),
    );
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ razao_social: "ZETA PARTICIPACOES LTDA" }), { status: 200, headers: { "content-type": "application/json" } }),
    );
    const read = vi.fn();
    const res = await collectCompany({ company: "Acme", lang: "pt-BR", search, read });
    expect(fetchSpy.mock.calls[0][0]).toBe("https://brasilapi.com.br/api/cnpj/v1/12345678000199");
    expect(res.legal).toBeNull();
    expect(res.cnpj).toBeNull();
    expect(res.failures.some((f) => f.section === "cnpj" && f.reason === "homonym")).toBe(true);
  });

  it("aceita o CNPJ quando a razão social compartilha token", async () => {
    const search = vi.fn((q: string) =>
      Promise.resolve(
        q.includes("cnpj")
          ? [{ url: "https://a.com/cnpj", title: "Consulta empresa", snippet: "CNPJ 12.345.678/0001-99", publishedAt: null }]
          : [],
      ),
    );
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ razao_social: "BANCO DO BRASIL S.A." }), { status: 200, headers: { "content-type": "application/json" } }),
    );
    const read = vi.fn();
    const res = await collectCompany({ company: "Banco do Brasil", lang: "pt-BR", search, read });
    expect(res.legal?.razaoSocial).toBe("BANCO DO BRASIL S.A.");
    expect(res.cnpj).toBe("12345678000199");
    expect(res.failures.some((f) => f.section === "cnpj")).toBe(false);
  });

  it("expõe o CNPJ descoberto em CollectResult.cnpj", async () => {
    const search = vi.fn((q: string) =>
      Promise.resolve(q.includes("cnpj") ? [{ url: "https://a.com/cnpj", title: "t", snippet: "CNPJ 00.000.000/0000-00", publishedAt: null }] : []),
    );
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ razao_social: "ACME LTDA" }), { status: 200, headers: { "content-type": "application/json" } }),
    );
    const read = vi.fn();
    const res = await collectCompany({ company: "Acme", lang: "pt-BR", search, read });
    expect(fetchSpy.mock.calls[0][0]).toBe("https://brasilapi.com.br/api/cnpj/v1/00000000000000");
    expect(res.cnpj).toBe("00000000000000");
    expect(res.legal?.razaoSocial).toBe("ACME LTDA");
  });

  it("sem CNPJ descoberto, registra o motivo com a seção", async () => {
    const search = vi.fn().mockResolvedValue([]);
    const read = vi.fn();
    const res = await collectCompany({ company: "Acme", lang: "pt-BR", search, read });
    const cnpjFailures = res.failures.filter((f) => f.section === "cnpj");
    expect(cnpjFailures).toHaveLength(1);
    expect(cnpjFailures[0].reason).toBe("no-digits");
  });

  it("digita CNPJ inválido: registra o motivo sem chamar o registro", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const search = vi.fn().mockResolvedValue([]);
    const read = vi.fn();
    const res = await collectCompany({ company: "Acme", lang: "pt-BR", search, read, cnpj: "123" });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(res.legal).toBeNull();
    expect(res.cnpj).toBeNull();
    expect(res.failures.some((f) => f.section === "cnpj" && f.reason === "invalid")).toBe(true);
  });

  it("CNPJ digitado válido mas 404 no registro: registra o motivo", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 404 }));
    const search = vi.fn().mockResolvedValue([]);
    const read = vi.fn();
    const res = await collectCompany({ company: "Acme", lang: "pt-BR", search, read, cnpj: "00000000000000" });
    expect(res.legal).toBeNull();
    expect(res.cnpj).toBe("00000000000000");
    expect(res.failures.some((f) => f.section === "cnpj" && f.reason === "not-found")).toBe(true);
  });
});
