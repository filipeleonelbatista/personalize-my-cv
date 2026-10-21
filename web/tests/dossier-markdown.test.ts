import { describe, expect, it } from "vitest";
import { buildDossierMarkdown, dossierMarkdownFileName } from "@/lib/dossier-markdown";
import { DossierMatchSchema, DossierSchema } from "@/lib/dossier-schema";

const dossier = DossierSchema.parse({
  id: "dsr_acme",
  companyKey: "acme",
  company: "Acme",
  lang: "pt-BR",
  history: {
    founded: "2010",
    timeline: [{ year: "2012", event: "Lançou o produto X" }],
    mission: "Missão",
    vision: "Visão",
    values: ["Transparência"],
    summary: "Resumo da empresa.",
  },
  legal: { razaoSocial: "Acme S.A.", openedAt: "2010-01-01" },
  leadership: {
    ceo: {
      name: "JOÃO",
      role: "CEO",
      bio: "Biografia",
      highlights: [{
        claim: "Destaque",
        sourceUrl: "https://a.com",
        sourceTitle: "Fonte A",
        date: "2026-09-01",
        quote: "Citação",
        origin: "web",
        unsourced: false,
      }],
    },
  },
  products: [{ name: "Produto", description: "Descrição", customerSignal: "Sinal de clientes" }],
  reputation: {
    reviews: [{ source: "glassdoor", sentiment: "contra", topic: "Demissões", date: "2026-08-01", quote: "Relato", sourceUrl: "https://g.com" }],
    redFlags: [{ severity: "high", category: "cultura", title: "Alerta", detail: "Detalhe", date: "2026-08-01", mitigation: "Mitigação" }],
  },
  contacts: [{ name: "MARIA", role: "RH", kind: "rh", channel: "linkedin", url: "https://li.com/m", hint: "Contato relevante", confidence: "high" }],
  socials: [{
    network: "linkedin",
    handle: "acme",
    url: "https://li.com/acme",
    tone: "Tom profissional",
    posts: [{ date: "2026-09-02", text: "Publicação", url: "https://li.com/p" }],
  }],
  coverage: [{ section: "historia", status: "ok" }],
  sources: [{ url: "https://a.com", title: "Fonte A", publishedAt: "2026-09-01", retrievedAt: "2026-10-01T00:00:00.000Z", provider: "jina" }],
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
});

describe("markdown do dossiê", () => {
  it("inclui os blocos do dossiê e fontes rastreáveis", () => {
    const md = buildDossierMarkdown(dossier, null);
    expect(md).toContain("# Dossiê — Acme");
    expect(md).toContain("## Empresa");
    expect(md).toContain("## Liderança");
    expect(md).toContain("## Produtos");
    expect(md).toContain("## Reputação");
    expect(md).toContain("## Contatos");
    expect(md).toContain("## Redes sociais");
    expect(md).toContain("## Fontes");
    expect(md).toContain("JOÃO");
    expect(md).toContain("https://a.com");
    expect(md).toContain("[Fonte A](<https://a.com/>)");
  });

  it("inclui alinhamento, correlações, abordagem, perguntas e alertas do match", () => {
    const match = DossierMatchSchema.parse({
      dossierId: dossier.id,
      appId: "app-1",
      lang: "pt-BR",
      alignment: { score: 70, verdict: "vai", dimensions: [{ key: "cultura", score: 80, note: "Boa aderência" }] },
      attentionPoints: ["Ponto de atenção"],
      correlations: [{ theme: "Liderança", theirs: "Experiência deles", mine: "Minha experiência" }],
      gaps: ["Lacuna"],
      outreach: [{ target: "MARIA", role: "RH", goal: "rh", channel: "linkedin", angle: "Experiência", message: "Mensagem pronta", sourceUrl: "https://li.com/m" }],
      questions: [{ question: "Pergunta?", why: "Motivo", sourceUrl: "https://a.com" }],
      redFlagSummary: ["Resumo de alerta"],
      sources: ["https://a.com"],
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
    });
    const md = buildDossierMarkdown(dossier, match);
    expect(md).toContain("## Panorama");
    expect(md).toContain("Ponto de atenção");
    expect(md).toContain("Experiência deles");
    expect(md).toContain("Mensagem pronta");
    expect(md).toContain("Pergunta?");
    expect(md).toContain("Resumo de alerta");
  });

  it("não transforma alegações sem URL em links e gera um nome seguro", () => {
    const md = buildDossierMarkdown(DossierSchema.parse({
      ...dossier,
      leadership: { ceo: { name: "CEO", highlights: [{ claim: "Sem fonte" }] } },
    }), null);
    expect(md).toContain("Sem fonte");
    expect(md).not.toContain("[Sem fonte](");
    expect(dossierMarkdownFileName(dossier)).toBe("dossie-acme.md");
    expect(dossierMarkdownFileName({ ...dossier, companyKey: "../out/file" })).toBe("dossie-out-file.md");
  });
});
