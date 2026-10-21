import { describe, expect, it } from "vitest";
import { DossierSchema, DossierMatchSchema } from "@/lib/dossier-schema";

const MIN = {
  id: "dsr_acme",
  companyKey: "acme",
  company: "Acme",
  lang: "pt-BR",
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
};

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
    expect(() => DossierMatchSchema.parse({ dossierId: "d", appId: "a", lang: "pt-BR", alignment: { score: 120, verdict: "vai" } })).toThrow();
  });

  it("limita produtos a 3, posts a 5, contatos a 8 e sources a 40", () => {
    const prod = Array.from({ length: 4 }, (_, i) => ({ name: `p${i}` }));
    expect(() => DossierSchema.parse({ ...MIN, products: prod })).toThrow();
    const social = { network: "linkedin", url: "https://x.com", posts: Array.from({ length: 6 }, () => ({ url: "https://x.com/1" })) };
    expect(() => DossierSchema.parse({ ...MIN, socials: [social] })).toThrow();
    const contacts = Array.from({ length: 9 }, (_, i) => ({ name: `c${i}` }));
    expect(() => DossierSchema.parse({ ...MIN, contacts })).toThrow();
    const sources = Array.from({ length: 41 }, (_, i) => ({ url: `https://s/${i}`, retrievedAt: "2026-10-21T00:00:00.000Z" }));
    expect(() => DossierSchema.parse({ ...MIN, sources })).toThrow();
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
