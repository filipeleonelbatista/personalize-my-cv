import { describe, expect, it, vi } from "vitest";
import { buildQueryPlan } from "@/lib/research/queries";
import { collectCompany } from "@/lib/research/collect";

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
    const search = vi.fn().mockResolvedValue([{ url: "https://a.com/1", title: "t", snippet: "s", publishedAt: null }]);
    const read = vi.fn().mockResolvedValue({ url: "https://a.com/1", title: "t", publishedAt: null, content: "x".repeat(300), provider: "jina" });
    await collectCompany({ company: "Acme", lang: "pt-BR", search, read });
    expect(search.mock.calls.length).toBeLessThanOrEqual(22);
    expect(read.mock.calls.length).toBeLessThanOrEqual(15);
  });

  it("deduplica URLs e lê no máximo uma vez", async () => {
    const search = vi.fn().mockResolvedValue([{ url: "https://a.com/1", title: "t", snippet: "s", publishedAt: null }, { url: "https://www.a.com/1/", title: "t", snippet: "s", publishedAt: null }]);
    const read = vi.fn().mockResolvedValue({ url: "https://a.com/1", title: "t", publishedAt: null, content: "x".repeat(300), provider: "jina" });
    const res = await collectCompany({ company: "Acme", lang: "pt-BR", search, read, maxSearches: 2, maxReads: 5 });
    expect(read.mock.calls.length).toBe(1);
    expect(res.docs).toHaveLength(1);
  });

  it("usa o cache e não relê a mesma URL", async () => {
    const doc = { url: "https://a.com/1", title: "t", publishedAt: null, content: "x".repeat(300), provider: "jina" as const };
    const cache = new Map([["https://a.com/1", doc]]);
    const search = vi.fn().mockResolvedValue([{ url: "https://a.com/1", title: "t", snippet: "s", publishedAt: null }]);
    const read = vi.fn();
    const res = await collectCompany({ company: "Acme", lang: "pt-BR", search, read, cache, maxSearches: 2 });
    expect(read).not.toHaveBeenCalled();
    expect(res.docs).toHaveLength(1);
  });

  it("registra a falha de leitura e segue sem a página", async () => {
    const search = vi.fn().mockResolvedValue([{ url: "https://a.com/1", title: "t", snippet: "s", publishedAt: null }]);
    const read = vi.fn().mockRejectedValue(new Error("jina blocked"));
    const res = await collectCompany({ company: "Acme", lang: "pt-BR", search, read, maxSearches: 2 });
    expect(res.docs).toHaveLength(0);
    expect(res.failures[0].url).toBe("https://a.com/1");
  });

  it("emite os estágios search -> official -> read", async () => {
    const stages: string[] = [];
    const search = vi.fn().mockResolvedValue([]);
    const read = vi.fn();
    await collectCompany({ company: "Acme", lang: "pt-BR", search, read, onStage: (s) => stages.push(s) });
    expect(stages[0]).toBe("search");
    expect(stages).toContain("official");
  });
});
