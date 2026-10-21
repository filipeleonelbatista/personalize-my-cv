// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { DossierSchema, DossierMatchSchema } from "@/lib/dossier-schema";

const T = "2026-10-01T00:00:00.000Z";
const MIN = {
  id: "dsr_acme",
  companyKey: "acme",
  company: "Acme",
  lang: "pt-BR",
  createdAt: T,
  updatedAt: T,
};
const MATCH_MIN = { dossierId: "d", appId: "a", lang: "pt-BR", alignment: { score: 70, verdict: "vai" }, createdAt: T, updatedAt: T };

const fill = <X,>(n: number, f: (i: number) => X): X[] => Array.from({ length: n }, (_, i) => f(i));
const contact = (i: number) => ({ name: `c${i}`, kind: "rh" as const, channel: "linkedin" as const });
const source = (i: number) => ({ url: `https://s/${i}`, retrievedAt: T, provider: "tavily" as const });

describe("dossier schema", () => {
  it("aceita um dossiê mínimo e preenche os blocos", () => {
    const d = DossierSchema.parse(MIN);
    expect(d.status).toBe("done");
    expect(d.errorLog).toBe("");
    expect(d.products).toEqual([]);
    expect(d.contacts).toEqual([]);
    expect(d.socials).toEqual([]);
    expect(d.sources).toEqual([]);
    expect(d.coverage).toEqual([]);
  });

  it("rejeita score de alinhamento fora de 0-100", () => {
    expect(() => DossierMatchSchema.parse({ ...MATCH_MIN, alignment: { score: 120, verdict: "vai" } })).toThrow();
  });

  it("aceita evidence sem fonte (sourceUrl nulo) e marca unsourced", () => {
    const d = DossierSchema.parse({
      ...MIN,
      reputation: { reviews: [], redFlags: [{ severity: "high", category: "cultura", title: "t", evidence: [{ claim: "c" }] }] },
    });
    expect(d.reputation.redFlags[0].evidence[0].sourceUrl).toBeNull();
    expect(d.reputation.redFlags[0].evidence[0].unsourced).toBe(false);
  });
});

// Controles positivos exatamente no limite + negativos em limite+1, por campo,
// para que a remoção de um `.max(...)` fique vermelha aqui.
const BOUNDS: Array<{ label: string; limit: number; schema: { parse(x: unknown): unknown }; build: (n: number) => unknown }> = [
  { label: "produtos (max 3)", limit: 3, schema: DossierSchema, build: (n) => ({ ...MIN, products: fill(n, (i) => ({ name: `p${i}` })) }) },
  { label: "contatos (max 8)", limit: 8, schema: DossierSchema, build: (n) => ({ ...MIN, contacts: fill(n, contact) }) },
  { label: "sources (max 40)", limit: 40, schema: DossierSchema, build: (n) => ({ ...MIN, sources: fill(n, source) }) },
  { label: "posts por rede (max 5)", limit: 5, schema: DossierSchema, build: (n) => ({ ...MIN, socials: [{ network: "linkedin", posts: fill(n, () => ({ url: "https://x.com/1" })) }] }) },
  { label: "reviews (max 20)", limit: 20, schema: DossierSchema, build: (n) => ({ ...MIN, reputation: { reviews: fill(n, () => ({ source: "glassdoor", sentiment: "pro" })) } }) },
  { label: "redFlags (max 12)", limit: 12, schema: DossierSchema, build: (n) => ({ ...MIN, reputation: { redFlags: fill(n, () => ({ severity: "low", category: "outro", title: "t" })) } }) },
  { label: "timeline da história (max 10)", limit: 10, schema: DossierSchema, build: (n) => ({ ...MIN, history: { timeline: fill(n, (i) => ({ year: `${2000 + i}`, event: "e" })) } }) },
  { label: "values da história (max 10)", limit: 10, schema: DossierSchema, build: (n) => ({ ...MIN, history: { values: fill(n, () => "v") } }) },
  { label: "highlights do CEO (max 10)", limit: 10, schema: DossierSchema, build: (n) => ({ ...MIN, leadership: { ceo: { name: "Ana", highlights: fill(n, () => ({ claim: "c" })) } } }) },
  { label: "dimensions do match (max 6)", limit: 6, schema: DossierMatchSchema, build: (n) => ({ ...MATCH_MIN, alignment: { score: 70, verdict: "vai", dimensions: fill(n, () => ({ key: "cultura", score: 50 })) } }) },
  { label: "questions do match (max 8)", limit: 8, schema: DossierMatchSchema, build: (n) => ({ ...MATCH_MIN, questions: fill(n, () => ({ question: "q" })) }) },
  { label: "outreach do match (max 5)", limit: 5, schema: DossierMatchSchema, build: (n) => ({ ...MATCH_MIN, outreach: fill(n, () => ({ target: "x", goal: "rh", channel: "linkedin" })) }) },
  { label: "score de alinhamento (max 100)", limit: 100, schema: DossierMatchSchema, build: (n) => ({ ...MATCH_MIN, alignment: { score: n, verdict: "vai" } }) },
];

for (const c of BOUNDS) {
  it(`bounds: ${c.label} parseia exatamente no limite`, () => {
    expect(() => c.schema.parse(c.build(c.limit))).not.toThrow();
  });
  it(`bounds: ${c.label} jorra em limite+1`, () => {
    expect(() => c.schema.parse(c.build(c.limit + 1))).toThrow();
  });
}
