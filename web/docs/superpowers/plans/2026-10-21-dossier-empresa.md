# Dossiê de Empresa — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um botão "Montar dossiê" na candidatura que pesquisa a empresa (Tavily + Jina + fetch direto), monta um dossiê por empresa com evidência rastreável (URL + data), e produz uma análise por candidatura com veredito de alinhamento, red flags e um plano de abordagem para contornar o ATS.

**Architecture:** 100% cliente, sem servidor. `output: "export"` intacto. Retrieval e síntese são camadas separadas: provedores de busca/leitura coletam um corpus determinístico (URL + data), o Gemini só estrutura esse corpus em JSON validado por Zod. O dossiê é 1 por empresa (`pmcv:dossiers`); a análise é 1 por candidatura (`StoredApp.dossierMatch`). Nenhuma URL pode ser citada se não estiver no corpus lido — o invariante é verificado em código, não só no prompt.

**Tech Stack:** Next.js 15 (`output: "export"`), React 19, TypeScript, Zod 3, Vitest + jsdom, `next-intl` (provider-only, 3 locales), Tailwind 4, `localStorage` + `secure-ls`, BYOK.

**Spec:** `web/docs/superpowers/specs/2026-10-21-dossier-empresa-design.md` — leia antes de começar; este plano executa a spec.

## Global Constraints

- Nada de servidor: sem Server Actions, sem Route Handlers, sem `app/api/**`, sem `middleware.ts`, sem `/api/` em componentes. `output: "export"` permanece em `web/next.config.ts`.
- Nenhuma chave hardcoded no bundle. Chaves em `secure-ls` (`pmcv:settings`), com o aviso de "não é cofre" mantido no README.
- Todo texto visível na UI vem de `messages/{pt-BR,en-US,es-ES}.json` — **paridade de chaves é obrigatória** (o teste de i18n falha se faltar em qualquer locale). Zero string PT hardcoded em componentes.
- Erros de lib passam por `tErr(locale, key)` (`lib/i18n/locale.ts`), com `locale` explícito — nunca o hook do provider.
- Literais de enum gravados no código são em **inglês** (`high`/`medium`/`low`, `rh`/`gestor`/`dpo`/`recrutador`/`executivo`/`other`, `vai`/`cautela`/`desistir`, `web`/`user`, `pro`/`contra`/`neutro`, `done`/`failed`); o rótulo na tela vem de `Dossier.enums.*`.
- Toda chamada de rede sai do browser com o header `Origin` do app — **só pode usar provedor com CORS liberado**: Tavily (`POST https://api.tavily.com/search`), Jina Reader (`GET https://r.jina.ai/<url>`), BrasilAPI, YouTube Data API, GitHub API, Wikipedia.
- **Brave está desligado por padrão** (`BRAVE_ENABLED = false`) porque a API não devolve headers CORS. Não habilitar sem re-testar CORS.
- **Google Search grounding está fora da v1**: a API Gemini rejeita tools com `responseMimeType: "application/json"`, e as citações do grounding violariam o invariante de evidência.
- Tetos por dossiê: **22 créditos de busca** (+6 de fallback `raw_content`), **15 leituras de página**, **40 k tokens de corpus por chamada**, `pmcv:readcache` com **teto de 150 KB** e TTL 7 dias, `sources ≤ 40`.
- Identidade da empresa é **editável antes da pesquisa**; `companyKey = slug(nome normalizado)`, `id = "dsr_" + companyKey` (determinístico).
- `saveSettings` faz **merge** (preserva `research`); `importBackup` **preserva** os dossiês locais quando o backup não tem a chave `dossiers`.
- Todo chunk de código e todo teste roda de `web/`. Comandos: `npm test -- --run`, `npx tsc --noEmit`, `npm run build`.
- Nenhuma dependência nova (sem lib de PDF, sem lib de scraping). O `@react-pdf/renderer` já existe mas **não é usado** nesta feature (PDF fora da v1).

## Review Focus

Cinco classes de entrada/falha que a spec implica e que nenhum teste de tarefa cobre explicitamente — a mais provável de morder primeiro:

1. **`app.empresa` é o placeholder** `MISSING_JOB.empresa` ("Empresa" / "Company" / "Empresa") quando a vaga não traz empresa → a pesquisa não pode rodar com "Empresa" como nome; o campo vem vazio e obrigatório.
2. **A mesma empresa com grafias diferentes** ("Nu" / "Nubank" / "Nu Pagamentos S.A.") → 1 dossiê só; `companyKey` normaliza sufixos societários.
3. **`localStorage` cheio** (~5 MB) com vários dossiês → erro guiado com "exportar backup e limpar", sem crash e sem perder o que já existe.
4. **Duas abas montando o dossiê da mesma empresa ao mesmo tempo** → `id` determinístico evita dois dossiês para uma empresa.
5. **Fonte bloqueada devolvendo HTTP 200** (Jina responde `Warning: …` com status 200) → não pode entrar no corpus como se fosse conteúdo.

---

### Task 1: Schema do dossiê e store (dossiês, match, chaves de pesquisa, cache de leitura)

**Files:**
- Create: `web/lib/dossier-schema.ts`
- Modify: `web/lib/store.ts` (`StoredAppSchema`, `SettingsSchema`, `saveSettings`, `exportBackup`, `importBackup`, `wipeAll`)
- Test: `web/tests/dossier-schema.test.ts`, `web/tests/store-dossiers.test.ts`, `web/tests/store.test.ts` (ajuste)

**Interfaces:**
- Consumes: `ResumeSchema`, `TailorEnvelopeSchema`, `StoredAppSchema`, `SettingsSchema` (existentes em `web/lib/store.ts`).
- Produces:
  - `web/lib/dossier-schema.ts` exporta `DossierSchema`, `DossierMatchSchema`, `SourceRefSchema`, `EvidenceSchema`, `RedFlagSchema`, `ReviewSchema`, `ContactSchema`, `SocialPostSchema`, `SocialSchema`, `ProductSchema`, os tipos `Dossier`, `DossierMatch`, `Evidence`, `SourceRef`, e `DOSSIER_SECTIONS: readonly ["historia","lideranca","produtos","reputacao","contatos","redes","cnpj"]` + `type DossierSection`.
  - `web/lib/store.ts` exporta `loadDossiers(): StoredDossier[]`, `saveDossiers(d: StoredDossier[]): void`, `upsertDossier(d: StoredDossier): void`, `findDossierByCompany(companyKey: string): StoredDossier | null`, `deleteDossier(id: string): void`, `loadReadCache(): ReadCacheEntry[]`, `saveReadCache(c: ReadCacheEntry[]): void`, `type ReadCacheEntry = { url: string; content: string; publishedAt: string | null; fetchedAt: string }`.
  - `StoredAppSchema` ganha `dossierId: z.string().nullable().default(null)` e `dossierMatch: DossierMatchSchema.nullable().default(null)`.
  - `SettingsSchema` ganha `research: z.object({ tavilyKey: z.string().default(""), braveKey: z.string().default(""), jinaKey: z.string().default(""), youtubeKey: z.string().default(""), githubToken: z.string().default("") })`.

- [ ] **Step 1: Escrever os testes que falham**

Em `web/tests/dossier-schema.test.ts` (novo), com `// @vitest-environment jsdom` no topo:

```ts
import { describe, expect, it } from "vitest";
import { DossierSchema, DossierMatchSchema } from "@/lib/dossier-schema";

const MIN = {
  id: "dsr_acme",
  companyKey: "acme",
  company: "Acme",
  lang: "pt-BR",
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
```

Em `web/tests/store-dossiers.test.ts` (novo), com `// @vitest-environment jsdom`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadDossiers, saveDossiers, upsertDossier, findDossierByCompany, deleteDossier, loadReadCache, saveReadCache, loadSettings, saveSettings, loadApps, saveApps, exportBackup, importBackup, wipeAll } from "@/lib/store";

const dossier = { id: "dsr_acme", companyKey: "acme", company: "Acme", lang: "pt-BR", createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-01T00:00:00.000Z" };

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
    saveApps([{ id: "a1", jobText: "j", fileName: "f.pdf", resume: RESUME, cargo: "Vaga", empresa: "Acme", matchPercent: 50, strengths: ["a"], weaknesses: ["b"], emailBody: "e", chatMessage: "c", status: "done", errorLog: "", lang: "pt-BR", createdAt: "2026-10-01T00:00:00.000Z", dossierId: "dsr_acme", dossierMatch: { dossierId: "dsr_acme", appId: "a1", lang: "pt-BR", alignment: { score: 70, verdict: "vai" }, createdAt: "2026-10-01T00:00:00.000Z" } }]);
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
```

(No teste acima, `RESUME` é o `resume` do fixture inline `base` de `tests/store.test.ts` — declare no topo do arquivo de teste, exatamente assim, **sem criar um arquivo de fixture novo** (o projeto não tem um compartilhado):

```ts
const RESUME = { cabecalho: { nome: "Ana", titulo_profissional: "Dev", contatos: [{ tipo: "email" as const, valor: "a@a.com", link: null }] }, secoes: { resumo: "X", experiencia: [], formacao: [], habilidades: [], certificacoes: [], idiomas: [], projetos: [] } };
```

Em `web/tests/store.test.ts`, **substitua** o teste das linhas 48-51:

```ts
  it("round-trips settings through secure storage", () => {
    saveSettings({ geminiKey: "K", models: ["m1", "m2"] });
    expect(loadSettings()).toMatchObject({ geminiKey: "K", models: ["m1", "m2"] });
    expect(loadSettings().research).toEqual({ tavilyKey: "", braveKey: "", jinaKey: "", youtubeKey: "", githubToken: "" });
  });
```

- [ ] **Step 2: Rodar os testes para ver falhar**

Run: `cd web && npm test -- --run tests/dossier-schema.test.ts tests/store-dossiers.test.ts tests/store.test.ts`
Expected: FAIL — `Cannot find module '@/lib/dossier-schema'` e `loadDossiers is not a function`.

- [ ] **Step 3: Criar `web/lib/dossier-schema.ts`**

Copie **literalmente** os blocos `SourceRefSchema`, `EvidenceSchema`, `RedFlagSchema`, `ReviewSchema`, `ContactSchema`, `SocialPostSchema`, `SocialSchema`, `ProductSchema`, `DossierSchema` e `DossierMatchSchema` da seção §4.1 da spec, incluindo os `.max(...)` de array e os `.default(...)` de todos os campos opcionais. Exporte também:

```ts
export const DOSSIER_SECTIONS = ["historia", "lideranca", "produtos", "reputacao", "contatos", "redes", "cnpj"] as const;
export type DossierSection = (typeof DOSSIER_SECTIONS)[number];
export type Dossier = z.infer<typeof DossierSchema>;
export type DossierMatch = z.infer<typeof DossierMatchSchema>;
export type Evidence = z.infer<typeof EvidenceSchema>;
export type SourceRef = z.infer<typeof SourceRefSchema>;
```

`DossierSchema` **não** inclui `coverage` nem `sources` gerados pelo modelo — mas os campos existem no schema (default `[]`) porque o **código** os preenche (spec §4.1, D13).

- [ ] **Step 4: Modificar `web/lib/store.ts`**

1. Importe `DossierSchema, DossierMatchSchema` de `./dossier-schema`.
2. `StoredAppSchema`: acrescente `dossierId: z.string().nullable().default(null)` e `dossierMatch: DossierMatchSchema.nullable().default(null)`.
3. `SettingsSchema`: acrescente o bloco `research` da spec (§4.2) com `.default(() => ({ tavilyKey: "", braveKey: "", jinaKey: "", youtubeKey: "", githubToken: "" }))`.
4. `saveSettings(s: Settings)` passa a **mesclar**: `saveSettings(s: Partial<Settings>)` que faz `const cur = loadSettings(); setSecure("pmcv:settings", JSON.stringify(SettingsSchema.parse({ ...cur, ...s, research: { ...cur.research, ...(s.research ?? {}) } })))`. Preserve `clearSettings()` e `loadSettings()` como estão.
5. Adicione `export type StoredDossier = Dossier;` e as funções `loadDossiers`/`saveDossiers` (com o mesmo padrão de `readArr`: item inválido é descartado, e `QuotaExceededError` vira a mensagem de quota já existente via `throwQuota`), `upsertDossier(d)` (remove o existente com o mesmo `companyKey` e grava o novo no início da lista), `findDossierByCompany(key)`, `deleteDossier(id)` (remove o dossiê e, em `saveApps`, zera o `dossierId` das apps que apontam para ele, **preservando** `dossierMatch`), `loadReadCache`/`saveReadCache` com `ReadCacheEntry` = `{ url, content, publishedAt, fetchedAt }` (descarta entradas inválidas).
6. `exportBackup()`: inclui `dossiers: loadDossiers()`. `importBackup(json)`: faz `z.object({ base: StoredBaseSchema.nullable(), apps: z.array(StoredAppSchema), dossiers: z.array(StoredDossierSchema).optional() }).parse(...)` e **só** chama `saveDossiers(parsed.dossiers)` quando `parsed.dossiers` estiver presente.
7. `wipeAll()`: acrescenta `"pmcv:dossiers"` e `"pmcv:readcache"` à lista de chaves removidas.

- [ ] **Step 5: Rodar os testes para ver passar**

Run: `cd web && npm test -- --run tests/dossier-schema.test.ts tests/store-dossiers.test.ts tests/store.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add web/lib/dossier-schema.ts web/lib/store.ts web/tests/dossier-schema.test.ts web/tests/store-dossiers.test.ts web/tests/store.test.ts
git commit -m "feat(web): schema do dossie + store de dossies, match, research e readcache"
```

---

### Task 2: Normalização e o invariante de evidência

**Files:**
- Create: `web/lib/research/providers.ts` (tipos + `canonicalUrl` + `dedupeUrls` + `fetchWithTimeout`)
- Create: `web/lib/dossier.ts`
- Test: `web/tests/dossier-normalize.test.ts`

**Interfaces:**
- Consumes: `DossierSchema`, `DossierMatchSchema`, `Evidence`, `SourceRef`, `DOSSIER_SECTIONS`, `DossierSection` (Task 1).
- Produces:
  - `web/lib/research/providers.ts`: `type ProviderName = "tavily" | "brave" | "jina" | "direct" | "user"`, `type SearchHit = { url: string; title: string; snippet: string; publishedAt: string | null }`, `type ReadDoc = { url: string; title: string; publishedAt: string | null; content: string; provider: ProviderName }`, `canonicalUrl(u: string): string`, `dedupeUrls(urls: string[]): string[]`, `fetchWithTimeout(url: string, init?: RequestInit, timeoutMs?: number): Promise<Response>`.
  - `web/lib/dossier.ts`: `companyKey(name: string): string`, `isPlaceholderCompany(name: string, lang: BaseLang): boolean`, `normalizeDossier(raw: unknown): Dossier`, `applyEvidenceInvariant(d: Dossier, corpusUrls: string[]): Dossier`, `computeCoverage(d: Dossier): Dossier["coverage"]`, `normalizeSeverity(v: unknown): "high" | "medium" | "low"`, `normalizeKind(v: unknown): "rh" | "gestor" | "dpo" | "recrutador" | "executivo" | "other"`, `normalizeVerdict(v: unknown): "vai" | "cautela" | "desistir"`.

- [ ] **Step 1: Escrever os testes que falham**

Em `web/tests/dossier-normalize.test.ts` (novo):

```ts
import { describe, expect, it } from "vitest";
import { applyEvidenceInvariant, computeCoverage, companyKey, isPlaceholderCompany, normalizeSeverity, normalizeVerdict } from "@/lib/dossier";

const base = {
  id: "dsr_acme", companyKey: "acme", company: "Acme", lang: "pt-BR" as const,
  createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-01T00:00:00.000Z",
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
  it("remove URL fora do corpus e marca a evidência como unsourced", () => {
    const d = { ...base, reputation: { reviews: [], redFlags: [{ severity: "high" as const, category: "cultura" as const, title: "t", detail: "", date: null, evidence: [{ claim: "c", sourceUrl: "https://inventado.com/x", sourceTitle: "", date: null, quote: "", origin: "web" as const, unsourced: false }], mitigation: null }] } };
    const out = applyEvidenceInvariant(d as never, ["https://lido.com/y"]);
    const ev = out.reputation.redFlags[0].evidence[0];
    expect(ev.sourceUrl).toBeNull();
    expect(ev.unsourced).toBe(true);
  });

  it("mantém URL que está no corpus", () => {
    const d = { ...base, reputation: { reviews: [], redFlags: [{ severity: "high" as const, category: "cultura" as const, title: "t", detail: "", date: null, evidence: [{ claim: "c", sourceUrl: "https://lido.com/y", sourceTitle: "", date: null, quote: "", origin: "web" as const, unsourced: false }], mitigation: null }] } };
    const out = applyEvidenceInvariant(d as never, ["https://lido.com/y"]);
    expect(out.reputation.redFlags[0].evidence[0].sourceUrl).toBe("https://lido.com/y");
    expect(out.reputation.redFlags[0].evidence[0].unsourced).toBe(false);
  });

  it("descarta red flag sem nenhuma evidência válida", () => {
    const d = { ...base, reputation: { reviews: [], redFlags: [{ severity: "high" as const, category: "cultura" as const, title: "t", detail: "", date: null, evidence: [{ claim: "c", sourceUrl: "https://inventado.com/x", sourceTitle: "", date: null, quote: "", origin: "web" as const, unsourced: false }], mitigation: null }] } };
    expect(applyEvidenceInvariant(d as never, ["https://lido.com/y"]).reputation.redFlags).toHaveLength(0);
  });

  it("descarta review sem URL no corpus", () => {
    const d = { ...base, reputation: { reviews: [{ source: "glassdoor" as const, sentiment: "pro" as const, topic: "", date: null, quote: "q", sourceUrl: "https://inventado.com/r" }], redFlags: [] } };
    expect(applyEvidenceInvariant(d as never, []).reputation.reviews).toHaveLength(0);
  });

  it("mantém review de material do usuário (sem URL) e marca origin=user", () => {
    const d = { ...base, reputation: { reviews: [{ source: "other" as const, sentiment: "contra" as const, topic: "demissão", date: null, quote: "q", sourceUrl: null }], redFlags: [] } };
    const out = applyEvidenceInvariant(d as never, []);
    expect(out.reputation.reviews).toHaveLength(1);
    expect(out.reputation.reviews[0].sourceUrl).toBeNull();
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
});

describe("normalização de enums", () => {
  it("aceita variantes em português e devolve o literal em inglês", () => {
    expect(normalizeSeverity("alta")).toBe("high");
    expect(normalizeSeverity("HIGH")).toBe("high");
    expect(normalizeSeverity("média")).toBe("medium");
    expect(normalizeSeverity("qualquer")).toBe("medium");
    expect(normalizeVerdict("vai")).toBe("vai");
    expect(normalizeVerdict("Cautela")).toBe("cautela");
  });
});
```

- [ ] **Step 2: Rodar os testes para ver falhar**

Run: `cd web && npm test -- --run tests/dossier-normalize.test.ts`
Expected: FAIL — `Cannot find module '@/lib/dossier'`.

- [ ] **Step 3: Criar `web/lib/research/providers.ts`**

```ts
export type ProviderName = "tavily" | "brave" | "jina" | "direct" | "user";
export type SearchHit = { url: string; title: string; snippet: string; publishedAt: string | null };
export type ReadDoc = { url: string; title: string; publishedAt: string | null; content: string; provider: ProviderName };

export function canonicalUrl(u: string): string {
  try {
    const url = new URL(u);
    url.hash = "";
    url.hostname = url.hostname.toLowerCase().replace(/^www\.|^m\./, "");
    for (const key of [...url.searchParams.keys()]) {
      if (/^utm_/i.test(key) || key === "fbclid" || key === "gclid") url.searchParams.delete(key);
    }
    url.protocol = "https:";
    return url.toString().replace(/\/$/, "");
  } catch {
    return u.trim();
  }
}

export function dedupeUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of urls) {
    const c = canonicalUrl(raw);
    if (!c || seen.has(c)) continue;
    seen.add(c);
    out.push(c);
  }
  return out;
}

export async function fetchWithTimeout(url: string, init?: RequestInit, timeoutMs = 30_000): Promise<Response> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: init?.signal ?? ctl.signal });
  } finally {
    clearTimeout(t);
  }
}
```

- [ ] **Step 4: Criar `web/lib/dossier.ts`**

Implemente:

- `companyKey(name)`: minúsculas, remove acentos (`normalize("NFD").replace(/\p{Diacritic}/gu, "")`), remove pontuação, remove tokens de sufixo societário (`ltda`, `limitada`, `sa`, `s.a`, `me`, `mei`, `eireli`, `inc`, `corp`, `corporation`, `ltd`, `group` **só se não for o único token**), join com `-`, colapsa `-` repetidos, corta nas bordas.
- `isPlaceholderCompany(name, lang)`: `true` quando `name.trim()` (comparação case-insensitive) é igual a `MISSING_JOB[lang].empresa` importado de `@/lib/pdf/i18n` ("Empresa" / "Company" / "Empresa"). Usado para exigir que o usuário digite o nome real antes da pesquisa.
- `normalizeSeverity(v)`: aceita `"high"|"media"|"média"|"alta"|"alto"` → `high`; `"low"|"baixa"|"baixo"` → `low`; resto → `medium`.
- `normalizeKind(v)`: `"rh"|"recrutador"|"recruiter"|"talent"` → `rh`; `"gestor"|"manager"|"gerente"` → `gestor`; `"dpo"` → `dpo`; `"executivo"|"ceo"|"fundador"` → `executivo`; resto → `other`.
- `normalizeVerdict(v)`: `"vai"|"go"` → `vai`; `"cautela"|"caution"` → `cautela`; `"desistir"|"no-go"` → `desistir`; resto → `cautela`.
- `normalizeDossier(raw)`: `DossierSchema.parse` do objeto recebido, mas **antes** do parse, aplica `normalizeSeverity`/`normalizeKind`/`normalizeVerdict` recursivamente nos campos `reputation.redFlags[].severity`, `contacts[].kind` e `alignment.verdict`. Devolve o objeto parseado (com os defaults do Zod aplicados).
- `applyEvidenceInvariant(d, corpusUrls)`:
  1. `const corpus = new Set(corpusUrls.map(canonicalUrl))`.
  2. Para cada `evidence` em `reputation.redFlags[].evidence`, `leadership.ceo.highlights`, `products[].evidence`: se `sourceUrl` for não-nulo e `canonicalUrl(sourceUrl)` **não** estiver em `corpus` → `sourceUrl = null; unsourced = true`. Se `sourceUrl` for não-nulo e estiver em `corpus` → `unsourced = false`.
  3. Se `evidence.sourceUrl === null` **e** `evidence.origin === "web"` → `unsourced = true` (afirmação sem link verificável).
  4. Remove `redFlags` cujo array `evidence` ficou **vazio** depois do passo 2-3.
  5. Remove `reviews` com `sourceUrl` não-nulo que não está no corpus (esses viram `sourceUrl = null` e a review é removida, porque review sem URL não tem como ser verificada).
  6. `contacts`: mantém **apenas** os contatos cujo nome (normalizado: minúsculas, sem acento, sem pontuação, tokens) aparece no conjunto de nomes presentes no corpus do texto lido — este passo recebe o corpus textual por um segundo parâmetro opcional `corpusText?: string`; quando `corpusText` não é informado (ex.: nos testes acima), **não** filtra por nome, apenas normaliza e zera `url` fora do corpus.
  7. Devolve um novo objeto (não muta o original).
- `computeCoverage(d)`: devolve `{ section, status }[]` para os 7 `DOSSIER_SECTIONS`, nesta ordem: `historia`, `lideranca`, `produtos`, `reputacao`, `contatos`, `redes`, `cnpj`. Regras:
  - `historia`: `ausente` se `founded`, `timeline`, `mission`, `vision`, `values` e `summary` estiverem todos vazios/nulos; `parcial` se algum estiver vazio/nulo mas não todos; `ok` caso contrário.
  - `lideranca`: `ausente` se `ceo === null`; `ok` caso contrário.
  - `produtos`: `ausente` se `products.length === 0`; `parcial` se algum produto estiver sem `evidence.length`; `ok` caso contrário.
  - `reputacao`: `ausente` se `reviews.length === 0 && redFlags.length === 0`; `parcial` se não houver **nenhuma** evidência válida no conjunto reviews+redFlags; `ok` caso contrário.
  - `contatos`: `ausente` se `contacts.length === 0`; `parcial` se `contacts.length < 5`; `ok` caso contrário.
  - `redes`: `ausente` se `socials.length === 0`; `parcial` se alguma rede estiver sem `posts`; `ok` caso contrário.
  - `cnpj`: `ausente` se `legal.razaoSocial` for nulo **e** `legal.openedAt` for nulo; `ok` caso contrário.

- [ ] **Step 5: Rodar os testes para ver passar**

Run: `cd web && npm test -- --run tests/dossier-normalize.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add web/lib/research/providers.ts web/lib/dossier.ts web/tests/dossier-normalize.test.ts
git commit -m "feat(web): invariante de evidencia + cobertura deterministica do dossie"
```

---

### Task 3: Provedores de pesquisa (Tavily, Jina, fetch direto, Brave desligado)

**Files:**
- Create: `web/lib/research/tavily.ts`, `web/lib/research/jina.ts`, `web/lib/research/direct.ts`, `web/lib/research/brave.ts`
- Test: `web/tests/research-providers.test.ts`

**Interfaces:**
- Consumes: `SearchHit`, `ReadDoc`, `fetchWithTimeout`, `canonicalUrl` (Task 2).
- Produces:
  - `web/lib/research/tavily.ts`: `tavilySearch(query: string, key: string, opts?: { maxResults?: number; rawContent?: boolean }): Promise<SearchHit[]>`.
  - `web/lib/research/jina.ts`: `jinaRead(url: string, key?: string): Promise<ReadDoc>`, `parseReaderMeta(text: string): { title: string; publishedAt: string | null }`.
  - `web/lib/research/direct.ts`: `fetchCnpj(cnpj: string): Promise<CnpjData | null>`, `fetchGithubEvents(org: string, token?: string): Promise<ReadDoc | null>`, `fetchYoutubePosts(channelId: string, key: string): Promise<ReadDoc | null>`, `type CnpjData = { razaoSocial: string | null; nomeFantasia: string | null; openedAt: string | null; cnae: string | null; porte: string | null; capitalSocial: string | null; partners: { name: string; role: string; since: string | null }[] }`.
  - `web/lib/research/brave.ts`: `BRAVE_ENABLED = false`, `braveSearch(query: string, key: string): Promise<SearchHit[]>` (lança `Error("brave-cors-not-supported")` enquanto `BRAVE_ENABLED` for `false`).

- [ ] **Step 1: Escrever os testes que falham**

Em `web/tests/research-providers.test.ts` (novo):

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { tavilySearch } from "@/lib/research/tavily";
import { jinaRead, parseReaderMeta } from "@/lib/research/jina";
import { fetchCnpj } from "@/lib/research/direct";
import { BRAVE_ENABLED, braveSearch } from "@/lib/research/brave";

afterEach(() => vi.restoreAllMocks());

describe("tavily", () => {
  it("chama POST /search com o header de autorização e mapeia os hits", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      results: [{ url: "https://a.com/x", title: "A", content: "trecho", published_date: "2026-09-01" }],
    }), { status: 200, headers: { "content-type": "application/json" } }));
    const hits = await tavilySearch("acme", "tvly-1");
    const [url, init] = spy.mock.calls[0];
    expect(String(url)).toBe("https://api.tavily.com/search");
    expect(init?.method).toBe("POST");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer tvly-1");
    expect(JSON.parse(String(init?.body)).query).toBe("acme");
    expect(hits[0]).toMatchObject({ url: "https://a.com/x", title: "A", snippet: "trecho" });
  });

  it("propaga 401 como erro", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("nope", { status: 401 }));
    await expect(tavilySearch("acme", "bad")).rejects.toThrow(/401/);
  });
});

describe("jina", () => {
  it("extrai Title e Published Time do cabeçalho", () => {
    const text = "Title: Acme\n\nURL Source: https://a.com\n\nPublished Time: Tue, 01 Sep 2026 10:00:00 GMT\n\nMarkdown aqui";
    expect(parseReaderMeta(text)).toEqual({ title: "Acme", publishedAt: "2026-09-01" });
  });

  it("lê a página e devolve ReadDoc", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("Title: Acme\n\nURL Source: https://a.com\n\nPublished Time: Tue, 01 Sep 2026 10:00:00 GMT\n\nconteúdo", { status: 200 }));
    const doc = await jinaRead("https://a.com");
    expect(doc.provider).toBe("jina");
    expect(doc.publishedAt).toBe("2026-09-01");
    expect(doc.content).toContain("conteúdo");
  });

  it("trata 200 com corpo de erro como leitura FALHA (página bloqueada)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("Warning: target URL returned error 403", { status: 200 }));
    await expect(jinaRead("https://glassdoor.com/x")).rejects.toThrow(/blocked|error|warning/i);
  });

  it("trata corpo muito curto como leitura FALHA", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok", { status: 200 }));
    await expect(jinaRead("https://a.com")).rejects.toThrow();
  });
});

describe("direct: CNPJ", () => {
  it("monta a URL do BrasilAPI e mapeia os campos", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      razao_social: "ACME LTDA", nome_fantasia: "Acme", data_inicio_atividade: "2010-05-04",
      cnae_fiscal: 6201, cnae_fiscal_descricao: "Desenvolvimento de programas", porte: "DEMAIS",
      capital_social: 1000, qsa: [{ nome_socio: "JOÃO", qualificacao_socio: "Presidente", data_entrada_sociedade: "2010-05-04" }],
    }), { status: 200, headers: { "content-type": "application/json" } }));
    const data = await fetchCnpj("11.222.333/0001-81");
    expect(String(spy.mock.calls[0][0])).toBe("https://brasilapi.com.br/api/cnpj/v1/11222333000181");
    expect(data?.razaoSocial).toBe("ACME LTDA");
    expect(data?.partners[0]).toEqual({ name: "JOÃO", role: "Presidente", since: "2010-05-04" });
  });

  it("devolve null em 404", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 404 }));
    expect(await fetchCnpj("00000000000191")).toBeNull();
  });
});

describe("brave", () => {
  it("está desligado por padrão (sem CORS liberado)", async () => {
    expect(BRAVE_ENABLED).toBe(false);
    await expect(braveSearch("acme", "key")).rejects.toThrow(/brave-cors-not-supported/);
  });
});
```

- [ ] **Step 2: Rodar os testes para ver falhar**

Run: `cd web && npm test -- --run tests/research-providers.test.ts`
Expected: FAIL — `Cannot find module '@/lib/research/tavily'`.

- [ ] **Step 3: Criar `web/lib/research/tavily.ts`**

```ts
import { canonicalUrl, fetchWithTimeout, type SearchHit } from "./providers";

export async function tavilySearch(query: string, key: string, opts: { maxResults?: number; rawContent?: boolean } = {}): Promise<SearchHit[]> {
  const res = await fetchWithTimeout("https://api.tavily.com/search", {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      query,
      max_results: opts.maxResults ?? 8,
      search_depth: "basic",
      include_raw_content: opts.rawContent ?? false,
      include_published_date: true,
      topic: "general",
    }),
  });
  if (!res.ok) throw new Error(`tavily ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { results?: { url?: string; title?: string; content?: string; published_date?: string | null }[] };
  return (json.results ?? [])
    .filter((r) => typeof r.url === "string" && r.url)
    .map((r) => ({
      url: canonicalUrl(r.url as string),
      title: r.title ?? "",
      snippet: r.content ?? "",
      publishedAt: r.published_date ?? null,
    }));
}
```

- [ ] **Step 4: Criar `web/lib/research/jina.ts`**

```ts
import { fetchWithTimeout, type ReadDoc } from "./providers";

const BLOCKED_MARKERS = /^(warning|error)\b/i;

export function parseReaderMeta(text: string): { title: string; publishedAt: string | null } {
  const title = /^Title:\s*(.+)$/m.exec(text)?.[1]?.trim() ?? "";
  const raw = /^Published Time:\s*(.+)$/m.exec(text)?.[1]?.trim() ?? "";
  let publishedAt: string | null = null;
  if (raw) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) publishedAt = d.toISOString().slice(0, 10);
  }
  return { title, publishedAt };
}

export async function jinaRead(url: string, key?: string): Promise<ReadDoc> {
  const headers: Record<string, string> = { accept: "text/plain" };
  if (key) headers.Authorization = `Bearer ${key}`;
  const res = await fetchWithTimeout(`https://r.jina.ai/${url}`, { headers }, 30_000);
  if (!res.ok) throw new Error(`jina ${res.status}`);
  const text = await res.text();
  const meta = parseReaderMeta(text);
  const body = text.replace(/^(Title|URL Source|Published Time):.*$/gm, "").trim();
  if (BLOCKED_MARKERS.test(text.trim()) || body.length < 200) throw new Error(`jina blocked-or-empty: ${url}`);
  return { url, title: meta.title, publishedAt: meta.publishedAt, content: text, provider: "jina" };
}
```

- [ ] **Step 5: Criar `web/lib/research/direct.ts`**

```ts
import { fetchWithTimeout, type ReadDoc } from "./providers";

export type CnpjData = {
  razaoSocial: string | null; nomeFantasia: string | null; openedAt: string | null;
  cnae: string | null; porte: string | null; capitalSocial: string | null;
  partners: { name: string; role: string; since: string | null }[];
};

export async function fetchCnpj(cnpj: string): Promise<CnpjData | null> {
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14) return null;
  const res = await fetchWithTimeout(`https://brasilapi.com.br/api/cnpj/v1/${digits}`, {}, 20_000);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`brasilapi ${res.status}`);
  const j = (await res.json()) as Record<string, unknown>;
  const qsa = (j.qsa as { nome_socio?: string; qualificacao_socio?: string; data_entrada_sociedade?: string }[] | undefined) ?? [];
  return {
    razaoSocial: (j.razao_social as string) ?? null,
    nomeFantasia: (j.nome_fantasia as string) ?? null,
    openedAt: (j.data_inicio_atividade as string) ?? null,
    cnae: [j.cnae_fiscal, j.cnae_fiscal_descricao].filter(Boolean).join(" — ") || null,
    porte: (j.porte as string) ?? null,
    capitalSocial: j.capital_social != null ? String(j.capital_social) : null,
    partners: qsa.map((s) => ({ name: s.nome_socio ?? "", role: s.qualificacao_socio ?? "", since: s.data_entrada_sociedade ?? null })).filter((p) => p.name),
  };
}

export async function fetchGithubEvents(org: string, token?: string): Promise<ReadDoc | null> {
  const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetchWithTimeout(`https://api.github.com/orgs/${encodeURIComponent(org)}/events/public?per_page=30`, { headers }, 20_000);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`github ${res.status}`);
  const events = (await res.json()) as { type?: string; created_at?: string; repo?: { name?: string }; payload?: Record<string, unknown> }[];
  const lines: string[] = [];
  for (const e of events) {
    if (e.type === "PushEvent") {
      const commits = (e.payload?.commits as { sha?: string; message?: string }[] | undefined) ?? [];
      const c = commits[0];
      if (c) lines.push(`${e.created_at ?? ""} | ${c.message ?? ""} | https://github.com/${e.repo?.name ?? ""}/commit/${c.sha ?? ""}`);
    } else if (e.type === "ReleaseEvent") {
      const rel = e.payload?.release as { name?: string; html_url?: string } | undefined;
      if (rel?.html_url) lines.push(`${e.created_at ?? ""} | ${rel.name ?? "release"} | ${rel.html_url}`);
    }
  }
  if (!lines.length) return null;
  return { url: `https://github.com/${org}`, title: `GitHub ${org}`, publishedAt: null, content: lines.join("\n"), provider: "direct" };
}

export async function fetchYoutubePosts(channelId: string, key: string): Promise<ReadDoc | null> {
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${encodeURIComponent(channelId)}&order=date&maxResults=5&key=${encodeURIComponent(key)}`;
  const res = await fetchWithTimeout(url, {}, 20_000);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`youtube ${res.status}`);
  const j = (await res.json()) as { items?: { snippet?: { publishedAt?: string; title?: string; description?: string }; id?: { videoId?: string } } }[] };
  const lines = (j.items ?? []).map((it) => `${it.snippet?.publishedAt ?? ""} | ${it.snippet?.title ?? ""} | https://www.youtube.com/watch?v=${it.id?.videoId ?? ""}`);
  if (!lines.length) return null;
  return { url: `https://www.youtube.com/channel/${channelId}`, title: `YouTube ${channelId}`, publishedAt: null, content: lines.join("\n"), provider: "direct" };
}
```

- [ ] **Step 6: Criar `web/lib/research/brave.ts`**

```ts
import { canonicalUrl, fetchWithTimeout, type SearchHit } from "./providers";

export const BRAVE_ENABLED = false;

export async function braveSearch(query: string, key: string): Promise<SearchHit[]> {
  if (!BRAVE_ENABLED) throw new Error("brave-cors-not-supported");
  const res = await fetchWithTimeout(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=8&country=BR&search_lang=pt`, { headers: { "X-Subscription-Token": key, Accept: "application/json" } });
  if (!res.ok) throw new Error(`brave ${res.status}`);
  const json = (await res.json()) as { web?: { results?: { url?: string; title?: string; description?: string; page_age?: string }[] } };
  return (json.web?.results ?? []).filter((r) => r.url).map((r) => ({ url: canonicalUrl(r.url as string), title: r.title ?? "", snippet: r.description ?? "", publishedAt: r.page_age ?? null }));
}
```

- [ ] **Step 7: Rodar os testes para ver passar**

Run: `cd web && npm test -- --run tests/research-providers.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add web/lib/research/tavily.ts web/lib/research/jina.ts web/lib/research/direct.ts web/lib/research/brave.ts web/tests/research-providers.test.ts
git commit -m "feat(web): provedores de pesquisa (tavily, jina, fetch direto; brave off por CORS)"
```

---

### Task 4: Plano de queries e coleta do corpus

**Files:**
- Create: `web/lib/research/queries.ts`, `web/lib/research/collect.ts`
- Test: `web/tests/research-collect.test.ts`

**Interfaces:**
- Consumes: `tavilySearch`, `jinaRead`, `fetchCnpj` (Task 3); `SearchHit`, `ReadDoc`, `canonicalUrl`, `dedupeUrls` (Task 2); `DOSSIER_SECTIONS`, `DossierSection` (Task 1).
- Produces:
  - `web/lib/research/queries.ts`: `buildQueryPlan(company: string, lang: BaseLang): { section: DossierSection; query: string }[]` (inclui a query de CNPJ com `section: "cnpj"`).
  - `web/lib/research/collect.ts`: `collectCompany(opts: CollectOptions): Promise<CollectResult>` com
    ```ts
    export type CollectOptions = {
      company: string;
      lang: BaseLang;
      cnpj?: string | null;
      maxSearches?: number;      // default 22
      maxReads?: number;         // default 15
      search: (query: string) => Promise<SearchHit[]>;
      read: (url: string) => Promise<ReadDoc>;
      cache?: Map<string, ReadDoc>;
      onStage?: (stage: "search" | "read" | "official") => void;
    };
    export type CollectResult = {
      docs: ReadDoc[];
      hits: SearchHit[];
      legal: CnpjData | null;
      searchesUsed: number;
      readsUsed: number;
      failures: { url: string; reason: string }[];
    };
    ```

- [ ] **Step 1: Escrever os testes que falham**

Em `web/tests/research-collect.test.ts` (novo):

```ts
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

  it("emite os estágios na ordem search -> read -> official", async () => {
    const stages: string[] = [];
    const search = vi.fn().mockResolvedValue([]);
    const read = vi.fn();
    await collectCompany({ company: "Acme", lang: "pt-BR", search, read, onStage: (s) => stages.push(s) });
    expect(stages[0]).toBe("search");
    expect(stages).toContain("official");
  });
});
```

- [ ] **Step 2: Rodar os testes para ver falhar**

Run: `cd web && npm test -- --run tests/research-collect.test.ts`
Expected: FAIL — `Cannot find module '@/lib/research/queries'`.

- [ ] **Step 3: Criar `web/lib/research/queries.ts`**

Implemente `buildQueryPlan(company, lang)` com a tabela da spec §5 (F1). Regras:
- Base: `"<empresa>" site oficial contato`, `"<empresa>" sobre nós história fundada`.
- `historia`: `"<empresa>" missão visão valores`, `"<empresa>" "fundada em" história`.
- `lideranca`: `"<empresa>" CEO fundador presidente proprietário`, `"<empresa>" "diretor" OR "CEO" entrevista`.
- `produtos`: `"<empresa>" produtos serviços clientes`, `"<empresa>" reclamação OR avaliação cliente`.
- `reputacao`: `"<empresa>" glassdoor avaliações`, `"<empresa>" jusbrasil processo`, `"<empresa>" reclamação funcionário`, `"<empresa>" "corte de pessoal" OR demissão`.
- `contatos`: `site:linkedin.com/in "<empresa>"`, `"<empresa>" recruiter OR "talent acquisition"`, `"<empresa>" "head of" OR "gerente" OR "coordenador"`, `"<empresa>" rh OR "recursos humanos" contato`.
- `redes`: `"<empresa>" instagram`, `"<empresa>" youtube`, `"<empresa>" github`, `"<empresa>" twitter OR x.com`.
- `cnpj`: `"<empresa>" cnpj`.
- Quando `lang === "en"` ou `"es"`, **acrescente** (não substitua) até 6 queries no idioma correspondente, usando os mesmos prefixos com termos traduzidos (`company about history founded`, `CEO founder owner`, `employee reviews glassdoor`, `recruiter talent acquisition`, `instagram`, `youtube`). A ordem final deve manter as queries PT primeiro e as do idioma depois.
- O nome da empresa **sempre** entre aspas duplas.

- [ ] **Step 4: Criar `web/lib/research/collect.ts`**

Implemente `collectCompany(opts)`:

1. `opts.onStage?.("search")`.
2. Se `opts.cnpj` vier preenchido, **não**gaste a query de CNPJ: vá direto ao passo 4.
3. Percorra `buildQueryPlan(company, lang)` na ordem, parando quando `searchesUsed` atingir `maxSearches` (default 22). Para cada query, chame `opts.search(query)`;累 **acumule** os hits em `hits` indexados pela seção da query. Uma query que lance erro é pulada (registrada em `failures` com `reason: "search"`).
4. `opts.onStage?.("official")`: descubra o CNPJ — se `opts.cnpj` foi informado, use; senão extraia dígitos de 14 dos hits da seção `cnpj` e chame `fetchCnpj(digits)`. Se `fetchCnpj` falhar, `legal = null`.
5. **Validação de homônimo (spec D11):** se `legal` existir e o usuário **não** informou o CNPJ, extraia os tokens significativos de `legal.razaoSocial` (minúsculas, sem acento, sem sufixo societário) e de `company`; se **nenhum** token significativo em comum → `legal = null` (o dado é de outra empresa) e registre `failures.push({ url: "cnpj", reason: "homonym" })`.
6. `opts.onStage?.("read")`: monte a lista de URLs candidatas na ordem de prioridade: (a) hits do site oficial (host igual ao domínio do hit da query "site oficial"), (b) `legal` não tem URL — mas a API do BrasilAPI entra em `sources` via `https://brasilapi.com.br/api/cnpj/v1/<digits>`; (c) hits de `reputacao`, `contatos`, `redes`, `produtos`, `lideranca`, `historia` — nesta ordem, respeitando a cota por seção (`reputacao`, `contatos`, `redes`, `produtos`: no máximo 4 cada; o resto: no máximo 4). Aplique `dedupeUrls`.
7. Para cada URL (até `maxReads`, default 15): se estiver no `opts.cache`, use o doc do cache e **não** chame `opts.read`; senão chame `opts.read(url)` e, em sucesso, grave no `opts.cache` e em `docs`. Em erro, registre `failures.push({ url, reason: String(err.message).slice(0, 120) })` e siga.
8. Devolva `{ docs, hits, legal, searchesUsed, readsUsed, failures }`.

- [ ] **Step 5: Rodar os testes para ver passar**

Run: `cd web && npm test -- --run tests/research-collect.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add web/lib/research/queries.ts web/lib/research/collect.ts web/tests/research-collect.test.ts
git commit -m "feat(web): plano de queries e coleta do corpus (descoberta -> leitura)"
```

---

### Task 5: Prompts, chamada longa do Gemini e o orquestrador do dossiê

**Files:**
- Modify: `web/lib/llm/prompts.ts`, `web/lib/llm/gemini.ts`, `web/lib/llm/chain.ts`
- Create: `web/lib/dossier-client.ts`
- Test: `web/tests/dossier-prompts.test.ts`, `web/tests/dossier-client.test.ts`

**Interfaces:**
- Consumes: `collectCompany` (Task 4); `normalizeDossier`, `applyEvidenceInvariant`, `computeCoverage` (Task 2); `DossierSchema`, `DossierMatchSchema`, `Dossier`, `DossierMatch`, `SourceRef` (Task 1); `loadBase`, `loadApps`, `saveApps`, `loadSettings`, `loadDossiers`, `upsertDossier`, `findDossierByCompany`, `saveReadCache`, `loadReadCache` (Task 1); `buildRepairUser` (existente).
- Produces:
  - `web/lib/llm/prompts.ts`: `buildDossierSystem(lang: BaseLang): string`, `buildDossierUser(corpus: string): string`, `buildMatchSystem(lang: BaseLang): string`, `buildMatchUser(payload: string): string`.
  - `web/lib/llm/gemini.ts`: `chatJsonGeminiLong(system, user, key, model?, locale?, timeoutMs?): Promise<unknown>` (default `timeoutMs = 120_000`).
  - `web/lib/llm/chain.ts`: `generateJsonLong(system, user, key, models?, locale?, maxModels?): Promise<{ data: unknown; provider: string }>` (default `maxModels = 2`; ao falhar, lança `Error` com **uma** mensagem agregada, sem stack).
  - `web/lib/dossier-client.ts`: `type DossierStage = "search" | "read" | "official" | "synthesize" | "match"`, `runDossierJob(opts): Promise<DossierJobResult>`, `runDossierFromDocs(opts): Promise<DossierJobResult>`, `runDossierMatch(app: StoredApp, locale?): Promise<{ ok: true; match: DossierMatch } | { ok: false; error: string }>`, `buildCorpus(docs: ReadDoc[]): string`, `buildSources(docs: ReadDoc[]): SourceRef[]`.
  - Assinaturas exatas:
    ```ts
    export type DossierJobResult =
      | { ok: true; dossier: Dossier; match: DossierMatch | null }
      | { ok: false; error: string; dossier: Dossier | null };

    export async function runDossierJob(opts: {
      company: string;
      cnpj?: string | null;
      lang: BaseLang;
      force?: boolean;            // true = refaz a pesquisa mesmo com dossiê existente
      locale?: UiLocale;
      onStage?: (stage: DossierStage) => void;
    }): Promise<DossierJobResult>;

    export async function runDossierFromDocs(opts: {
      company: string;
      lang: BaseLang;
      docs: ReadDoc[];            // corpus já coletado (modo manual ou re-síntese)
      locale?: UiLocale;
      onStage?: (stage: DossierStage) => void;
    }): Promise<DossierJobResult>;
    ```

- [ ] **Step 1: Escrever os testes que falham**

Em `web/tests/dossier-prompts.test.ts` (novo):

```ts
import { describe, expect, it } from "vitest";
import { buildDossierSystem, buildDossierUser, buildMatchSystem, buildMatchUser } from "@/lib/llm/prompts";

describe("prompts do dossiê", () => {
  it("exige URL do corpus e proíbe data inventada", () => {
    const s = buildDossierSystem("pt-BR");
    expect(s).toMatch(/corpus/i);
    expect(s).toMatch(/nunca invente|nao invente|invent/i);
    expect(s).toMatch(/sourceUrl/);
  });

  it("lista os literais exatos dos enums", () => {
    const s = buildDossierSystem("pt-BR");
    for (const lit of ["high", "medium", "low", "rh", "gestor", "dpo", "recrutador", "executivo", "pro", "contra", "neutro"]) expect(s).toContain(lit);
  });

  it("pede o texto no idioma do dossiê", () => {
    expect(buildDossierSystem("en")).toMatch(/English/i);
    expect(buildDossierSystem("es")).toMatch(/Español|Espanol/i);
  });

  it("o prompt do match exige âncora no resume e mensagem pronta", () => {
    const s = buildMatchSystem("pt-BR");
    expect(s).toMatch(/resume/i);
    expect(s).toMatch(/message/i);
    expect(s).toMatch(/outreach/i);
  });

  it("o user do dossiê recebe o corpus verbatim", () => {
    expect(buildDossierUser("CORPUS_AQUI")).toContain("CORPUS_AQUI");
    expect(buildMatchUser("PAYLOAD")).toContain("PAYLOAD");
  });
});
```

Em `web/tests/dossier-client.test.ts` (novo), com `// @vitest-environment jsdom`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runDossierJob, runDossierMatch, buildCorpus } from "@/lib/dossier-client";
import { loadDossiers, saveApps, loadApps, saveBase } from "@/lib/store";
import { RESUME } from "./fixtures/resume";   // se não existir, use o fixture inline de tests/store.test.ts

describe("runDossierJob", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    saveBase({ resume: RESUME, lang: "pt-BR", updatedAt: new Date().toISOString() });
  });

  it("persiste o dossiê em pmcv:dossiers", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      const u = String(url);
      if (u.includes("api.tavily.com")) return new Response(JSON.stringify({ results: [{ url: "https://acme.com", title: "Acme", content: "sobre a acme" }] }), { status: 200, headers: { "content-type": "application/json" } });
      if (u.includes("r.jina.ai")) return new Response("Title: Acme\n\nURL Source: https://acme.com\n\nPublished Time: Tue, 01 Sep 2026 10:00:00 GMT\n\n" + "conteúdo da página ".repeat(40), { status: 200 });
      if (u.includes("generativelanguage")) return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ history: { summary: "empresa" } }) }] } }] }), { status: 200 });
      return new Response("{}", { status: 404 });
    });
    const r = await runDossierJob({ company: "Acme", lang: "pt-BR" });
    expect(r.ok).toBe(true);
    expect(loadDossiers()).toHaveLength(1);
    expect(loadDossiers()[0].companyKey).toBe("acme");
  });

  it("reaproveita o dossiê existente sem refazer a pesquisa", async () => {
    const search = vi.spyOn(globalThis, "fetch");
    const r1 = await runDossierJob({ company: "Acme", lang: "pt-BR" });
    expect(r1.ok).toBe(true);
    const before = search.mock.calls.length;
    const r2 = await runDossierJob({ company: "Acme", lang: "pt-BR" });
    expect(r2.ok).toBe(true);
    expect(search.mock.calls.length).toBe(before);
  });

  it("não persiste lixo quando a síntese falha", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      const u = String(url);
      if (u.includes("generativelanguage")) return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "{nao é json" }] } }] }), { status: 200 });
      return new Response(JSON.stringify({ results: [] }), { status: 200, headers: { "content-type": "application/json" } });
    });
    const r = await runDossierJob({ company: "Acme", lang: "pt-BR" });
    expect(r.ok).toBe(false);
    expect(loadDossiers()[0].status).toBe("failed");
    expect(loadDossiers()[0].errorLog.length).toBeGreaterThan(0);
  });

  it("chama onStage na ordem synthesize antes de match", async () => {
    const stages: string[] = [];
    await runDossierJob({ company: "Acme", lang: "pt-BR", onStage: (s) => stages.push(s) });
    expect(stages).toContain("synthesize");
  });
});

describe("runDossierMatch", () => {
  it("grava o match na candidatura usando o resume tailored", async () => {
    const app = { id: "a1", jobText: "vaga de devs", fileName: "f.pdf", resume: RESUME, cargo: "Dev", empresa: "Acme", matchPercent: 80, strengths: ["s"], weaknesses: ["w"], emailBody: "e", chatMessage: "c", status: "done" as const, errorLog: "", lang: "pt-BR" as const, createdAt: new Date().toISOString() };
    saveApps([app]);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ alignment: { score: 70, verdict: "vai", dimensions: [] }, attentionPoints: ["a"], correlations: [], gaps: [], questions: [], outreach: [], redFlagSummary: [], sources: [] }) }] } }] }), { status: 200 }));
    const r = await runDossierMatch(loadApps()[0]);
    expect(r.ok).toBe(true);
    expect(loadApps()[0].dossierMatch?.alignment.score).toBe(70);
    expect(loadApps()[0].dossierId).toBeTruthy();
  });
});

describe("buildCorpus", () => {
  it("inclui título, url e data de cada documento", () => {
    const c = buildCorpus([{ url: "https://a.com", title: "A", publishedAt: "2026-09-01", content: "texto", provider: "jina" }]);
    expect(c).toContain("https://a.com");
    expect(c).toContain("A");
    expect(c).toContain("2026-09-01");
  });
});
```

> Declare `RESUME` no topo de `tests/dossier-client.test.ts` com **exatamente** o mesmo objeto do fixture inline `base` de `tests/store.test.ts` (copie a linha 6 daquele arquivo). **Não** crie `tests/fixtures/resume.ts` — o projeto não tem fixture compartilhado e criar um seria uma mudança de convenção fora do escopo.

- [ ] **Step 2: Rodar os testes para ver falhar**

Run: `cd web && npm test -- --run tests/dossier-prompts.test.ts tests/dossier-client.test.ts`
Expected: FAIL — `Cannot find module '@/lib/dossier-client'` e `buildDossierSystem is not a function`.

- [ ] **Step 3: Adicionar os prompts em `web/lib/llm/prompts.ts`**

Adicione:

```ts
export function buildDossierSystem(lang: BaseLang): string {
  const outLang = lang === "en" ? "English" : lang === "es" ? "Español" : "Português do Brasil";
  return `Você é um analista de empresas. Receba um CORPUS de documentos (cada um com título, URL e data de publicação). Produza JSON com {history{founded,timeline[{year,event}],mission,vision,values[],summary},leadership{ceo{name,role,bio,highlights[{claim,sourceUrl,sourceTitle,date,quote}]}},products[{name,description,customerSignal,evidence[{claim,sourceUrl,sourceTitle,date,quote}]}]}. REGRAS: (1) use SOMENTE o corpus; toda afirmação factual precisa de sourceUrl presente no corpus; (2) a data da evidência é a data do documento; se não houver data, use null — NUNCA invente data; (3) não preencha com conhecimento geral do modelo: sem evidência, o campo fica vazio ou null; (4) separe fato da empresa (history, leadership) de reclamação de cliente (products.customerSignal); (5) máximo 3 products, máximo 10 timeline, máximo 10 values, máximo 10 highlights. Literais permitidos: severity=high|medium|low; kind=rh|gestor|dpo|recrutador|executivo|other; sentiment=pro|contra|neutro; network=linkedin|instagram|youtube|x|facebook|github|tiktok|other; channel=linkedin|email|telefone|site|other. Escreva todos os textos livres em ${outLang}. Retorne SOMENTE JSON.`;
}

export const buildDossierUser = (corpus: string) => `corpus:\n${corpus}`;

export function buildMatchSystem(lang: BaseLang): string {
  const outLang = lang === "en" ? "English" : lang === "es" ? "Español" : "Português do Brasil";
  return `Receba um DOSSIÊ (JSON da empresa) + a VAGA (texto) + o RESUME (currículo tailored do candidato para aquela vaga). Produza JSON com {alignment{score 0-100, verdict=vai|cautela|desistir, dimensions[{key=cultura|produto|processo|gestao|setor|cargo,score 0-100,note}]},attentionPoints[],correlations[{theme,theirs,mine}],gaps[],questions[{question,why,sourceUrl}],outreach[{target,role,goal=rh|gestor|indicacao|cargo,channel=linkedin|email|telefone|site|other,angle,message,sourceUrl}],redFlagSummary[],sources[]}. REGRAS: (1) alignment.score é honesto, ancorado nas dimensões — não é porcentagem de palavras em comum; (2) correlations só cita skills/experiências que estão no RESUME; (3) questions: 5 a 8 perguntas, cada uma com why e sourceUrl quando derivar de uma evidência do dossiê; (4) outreach: 3 a 5 ações de contorno de ATS, cada uma com message PRONTA PARA COPIAR no tom do canal (LinkedIn ≠ e-mail), usando apenas fatos do dossiê e do RESUME; (5) redFlagSummary lista as red flags para as quais preparar objeção. Escreva todos os textos em ${outLang}. Retorne SOMENTE JSON.`;
}

export const buildMatchUser = (payload: string) => `payload:\n${payload}`;
```

- [ ] **Step 4: Adicionar `chatJsonGeminiLong` em `web/lib/llm/gemini.ts`**

Duplique `chatJsonGemini` com `timeoutMs = 120_000` (constante `const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeoutMs);`) e o mesmo tratamento de erro (`401/403` → `tErr(locale, "invalidKey")`, resposta vazia → `tErr(locale, "emptyResponse")`, parse com `extractJson` de `@/lib/json-text`). **Não** mexa no `chatJsonGemini` existente (60 s) — o fluxo de currículo depende dele.

- [ ] **Step 5: Adicionar `generateJsonLong` em `web/lib/llm/chain.ts`**

```ts
export async function generateJsonLong(system: string, user: string, key: string, models?: string[], locale: UiLocale = getLocale(), maxModels = 2): Promise<{ data: unknown; provider: Provider }> {
  const errs: string[] = [];
  const list = geminiModels(models).slice(0, Math.max(1, maxModels));
  for (const model of list) {
    try { return { data: await chatJsonGeminiLong(system, user, key, model, locale), provider: `gemini:${model}` }; }
    catch (e) { errs.push(`${model}: ${(e as Error).message}`); }
  }
  throw new Error(errs.join(" | "));
}
```

- [ ] **Step 6: Criar `web/lib/dossier-client.ts`**

Implemente:

- `buildSources(docs: ReadDoc[]): SourceRef[]` — `{ url, title, publishedAt, retrievedAt: new Date().toISOString(), provider }` de cada doc, deduplicado por `canonicalUrl`.
- `buildCorpus(docs: ReadDoc[]): string` — blocos separados por `---`, cada um com a 1ª linha `title | url | publishedAt` e o conteúdo (recortado em 1200 caracteres) abaixo. Se `docs` for vazio, devolve `"(sem documentos)"`.
- `runDossierJob(opts: { company: string; cnpj?: string | null; lang: BaseLang; force?: boolean; locale?: UiLocale; onStage?: (s: DossierStage) => void })`:
  1. `const key = companyKey(opts.company)` (importe `companyKey` de `@/lib/dossier`; **não** use o mesmo nome para a variável local). Se já existir dossiê com esse `companyKey`, `status === "done"` **e** `opts.force` **não** for `true` → devolva `{ ok: true, dossier: existente, match: null }` **sem** nenhuma chamada de rede.
  2. `settings = loadSettings()`; se `settings.research.tavilyKey` estiver vazio, **não** dispare a pesquisa: retorne `{ ok: false, error: tErr(locale, "noResearchKey"), dossier: null }` (a UI trata esse caso com as opções "colar URLs" — Task 8).
  3. `onStage?.("search")` → `collectCompany({ company, lang, cnpj, search: (q) => tavilySearch(q, tavilyKey), read: (u) => jinaRead(u, settings.research.jinaKey || undefined), cache, onStage: (s) => onStage?.(s === "official" ? "official" : s) })`.
  4. Monte `sources = buildSources(docs)` e **persista no dossiê mesmo se a síntese falhar** (para o retry reler sem refazer as buscas).
  5. `onStage?.("synthesize")` → **duas** chamadas: a primeira com `buildDossierSystem(lang)` + `buildDossierUser(corpusA)` pedindo `{history, leadership, products}`; a segunda pedindo `{reputation, contacts, socials}`. Una os dois JSON num único objeto e passe por `normalizeDossier`. Se o parse falhar, use **uma** chamada de `buildRepairUser` (já existente em `lib/llm/prompts.ts`) e tente de novo.
  6. Preencha `legal` a partir de `collect.legal` (dados verbatim do BrasilAPI), `sources` (código), `coverage` (via `computeCoverage`), `company`, `companyKey: key`, `cnpj`, `lang`, `id = "dsr_" + key`, `status: "done"`, `createdAt`/`updatedAt`.
  7. Aplique `applyEvidenceInvariant(dossier, sources.map(s => s.url))` **antes** de computar `coverage`.
  8. `upsertDossier(dossier)`; salve o `pmcv:readcache` (os docs lidos, com `fetchedAt`, respeitando o teto de 150 KB — corte os docs mais antigos até caber).
  9. Retorne `{ ok: true, dossier, match: null }`.
  10. Em qualquer erro: persista `{ ...dossierBase, status: "failed", errorLog: String(err.message).slice(0, 1000), sources }` via `upsertDossier` e retorne `{ ok: false, error: tErr(locale, "dossierFailed"), dossier: failed }`.
- `runDossierFromDocs(opts: { company, lang, docs, locale?, onStage? })`: **mesmos passos 5 a 9** do `runDossierJob`, mas usando `opts.docs` como corpus (sem `collect`, sem `legal`) — é o caminho do modo manual (URLs coladas / material colado) e da **re-síntese noutro idioma** (spec D5): o `DossierDialog` chama `runDossierFromDocs` com os `docs` já guardados no `pmcv:readcache` (rebuscados pelas URLs de `dossier.sources`) e o novo `lang`. A re-síntese **não** refaz buscas e **não** consome créditos do Tavily.
- `runDossierMatch(app: StoredApp, locale?: UiLocale)`:
  1. Carregue o dossiê por `app.dossierId` (ou por `companyKey(app.empresa)`); se não existir, retorne `{ ok: false, error: tErr(locale, "notFound") }`.
  2. `onStage("match")` implícito: `generateJsonLong(buildMatchSystem(app.lang), buildMatchUser(payload), settings.geminiKey, settings.models, locale, 2)` com `payload = JSON.stringify({ dossier, jobText: app.jobText, resume: app.resume, cargo: app.cargo })`.
  3. Valide com `DossierMatchSchema` (aplicando `normalizeVerdict`).
  4. Grave em `saveApps(loadApps().map(a => a.id === app.id ? { ...a, dossierId: dossier.id, dossierMatch: match } : a))`.
  5. Retorne `{ ok: true, match }`.

- [ ] **Step 7: Rodar os testes para ver passar**

Run: `cd web && npm test -- --run tests/dossier-prompts.test.ts tests/dossier-client.test.ts`
Expected: PASS.

- [ ] **Step 8: Rodar a suíte inteira + typecheck**

Run: `cd web && npm test -- --run && npx tsc --noEmit`
Expected: todos PASS, `tsc` sem erros.

- [ ] **Step 9: Commit**

```bash
git add web/lib/llm/prompts.ts web/lib/llm/gemini.ts web/lib/llm/chain.ts web/lib/dossier-client.ts web/tests/dossier-prompts.test.ts web/tests/dossier-client.test.ts
git commit -m "feat(web): sintese do dossie (prompts + chamada longa) e analise por candidatura"
```

---

### Task 6: i18n dos novos namespaces

**Files:**
- Modify: `web/messages/pt-BR.json`, `web/messages/en-US.json`, `web/messages/es-ES.json`
- Test: `web/tests/i18n.test.ts` (já existe — verificar que cobre a paridade; acrescentar asserções se não cobrir)

**Interfaces:**
- Consumes: as chaves `Errors.*` usadas por `tErr` em `lib/dossier-client.ts`: `noResearchKey`, `researchInvalidKey`, `researchRateLimit`, `dossierFailed`, `noUrls`, `placeholderCompany`.
- Produces: namespace `Dossier` (com `Dossier.enums.*`), namespace `Research`, e as chaves de `Errors` acima — **nos 3 locales**, com o **mesmo conjunto de chaves**.

- [ ] **Step 1: Escrever o teste que falha**

Em `web/tests/i18n.test.ts`, acrescente:

```ts
  it("tem os namespaces Dossier e Research nos 3 locales", () => {
    for (const loc of ["pt-BR", "en-US", "es-ES"]) {
      const m = JSON.parse(readFileSync(`messages/${loc}.json`, "utf8"));
      expect(m.Dossier, loc).toBeTruthy();
      expect(m.Research, loc).toBeTruthy();
      expect(m.Dossier.enums, loc).toBeTruthy();
      for (const k of ["noResearchKey", "researchInvalidKey", "researchRateLimit", "dossierFailed", "noUrls", "placeholderCompany"]) {
        expect(m.Errors[k], `${loc}.${k}`).toBeTruthy();
      }
    }
  });
```

- [ ] **Step 2: Rodar o teste para ver falhar**

Run: `cd web && npm test -- --run tests/i18n.test.ts`
Expected: FAIL — `m.Dossier` undefined.

- [ ] **Step 3: Escrever as mensagens nos 3 locales**

Em **cada** um dos 3 arquivos, acrescente (mantendo o estilo de JSON já usado — chaves agrupadas, uma linha por grupo quando curto):

```json
"Errors": {
  "noResearchKey": "<pt: Configure uma chave de pesquisa (Tavily) em Configurações, ou cole as URLs da empresa — sem chave, use o modo manual.>",
  "researchInvalidKey": "<pt: Chave da API de pesquisa inválida (401). Confira em Configurações.>",
  "researchRateLimit": "<pt: Limite de requisições da API de pesquisa atingido. Aguarde um pouco e tente de novo.>",
  "dossierFailed": "<pt: Falha ao montar o dossiê. Os dados coletados foram salvos — use “Tentar de novo” para retomar sem refazer a pesquisa.>",
  "noUrls": "<pt> Cole ao menos uma URL da empresa para pesquisar.>",
  "placeholderCompany": "<pt> A vaga não informa a empresa. Informe o nome da empresa para montar o dossiê.>"
}
```

E os namespaces:

```json
"Dossier": {
  "open": "<pt: Montar dossiê>",
  "view": "<pt: Ver dossiê>",
  "title": "<pt: Dossiê da empresa>",
  "company": "<pt: Empresa>",
  "companyPlaceholder": "<pt: Nome da empresa>",
  "companyRequired": "<pt: Informe o nome da empresa para montar o dossiê.",
  "cnpj": "<pt: CNPJ (opcional)>",
  "source": "<pt: Fonte>",
  "auto": "<pt: Pesquisa automática>",
  "autoDesc": "<pt: Buscar, ler e resumir automaticamente (requer chave Tavily).>",
  "manualUrls": "<pt: Colar URLs>",
  "manualUrlsDesc": "<pt> Sem chave: cole as URLs da empresa (uma por linha).>",
  "manualText": "<pt: Colar material>",
  "manualTextDesc": "<pt> Sem chave: cole textos, prints transcritos ou links.>",
  "cancel": "<pt: Cancelar>",
  "close": "<pt: Fechar>",
  "start": "<pt> Montar dossiê>",
  "retry": "<pt: Tentar de novo>",
  "refresh": "<pt: Atualizar pesquisa>",
  "exportMd": "<pt: Exportar Markdown>",
  "analyze": "<pt: Analisar esta vaga>",
  "recalc": "<pt: Recalcular análise>",
  "stale": "<pt> Análise desatualizada — o dossiê foi atualizado depois.",
  "noDossier": "<pt> Nenhum dossiê ainda.",
  "consentNotice": "<pt> URLs públicas desta empresa serão enviadas ao Tavily/Jina e trechos ao Gemini para montar o dossiê.",
  "langBadge": "<pt> Gerado em {lang}",
  "regenerateLang": "<pt> Regerar em {lang}",
  "stage": {
    "search": "<pt> Descobrindo fontes…",
    "read": "<pt> Lendo páginas…",
    "official": "<pt> Consultando dados oficiais…",
    "synthesize": "<pt> Estruturando o dossiê…",
    "match": "<pt> Cruzando com seu currículo…"
  },
  "durationNote": "<pt> (pode levar 2–5 min)",
  "coverageOk": "<pt> Cobertura completa.",
  "coveragePartial": "<pt> {n} seções sem evidência suficiente — confira as fontes.",
  "noSource": "<pt> sem fonte verificável",
  "tabs": { "panorama": "<pt: Panorama>", "empresa": "<pt: Empresa>", "lideranca": "<pt: Liderança>", "produtos": "<pt: Produtos>", "reputacao": "<pt: Reputação>", "contatos": "<pt: Contatos>", "redes": "<pt: Redes sociais>", "abordagem": "<pt: Plano de abordagem>", "perguntas": "<pt: Perguntas>", "fontes": "<pt: Fontes>" },
  "sections": { "historia": "<pt: História>", "lideranca": "<pt: Liderança>", "produtos": "<pt: Produtos>", "reputacao": "<pt: Reputação>", "contatos": "<pt: Contatos>", "redes": "<pt: Redes sociais>", "cnpj": "<pt: Dados legais>" },
  "enums": {
    "severity": { "high": "<pt: Alta>", "medium": "<pt: Média>", "low": "<pt: Baixa>" },
    "kind": { "rh": "<pt: RH>", "gestor": "<pt: Gestor>", "dpo": "<pt: DPO>", "recrutador": "<pt: Recrutador>", "executivo": "<pt: Executivo>", "other": "<pt: Outro>" },
    "verdict": { "vai": "<pt: Vale a pena>", "cautela": "<pt: Com cautela>", "desistir": "<pt: Desistir>" },
    "sentiment": { "pro": "<pt: A favor>", "contra": "<pt: Contra>", "neutro": "<pt: Neutro>" },
    "confidence": { "high": "<pt: Alta>", "medium": "<pt: Média>", "low": "<pt: Baixa>" },
    "goal": { "rh": "<pt: Falar com o RH>", "gestor": "<pt: Falar com o gestor>", "indicacao": "<pt> Pedir indicação", "cargo": "<pt: Falar sobre a vaga>" },
    "channel": { "linkedin": "<pt: LinkedIn>", "email": "<pt: E-mail>", "telefone": "<pt: Telefone>", "site": "<pt: Site>", "other": "<pt: Outro>" },
    "network": { "linkedin": "<pt: LinkedIn>", "instagram": "<pt: Instagram>", "youtube": "<pt: YouTube>", "x": "<pt: X>", "facebook": "<pt: Facebook>", "github": "<pt: GitHub>", "tiktok": "<pt: TikTok>", "other": "<pt: Outra>" },
    "source": { "glassdoor": "<pt: Glassdoor>", "linkedin": "<pt: LinkedIn>", "jusbrasil": "<pt: Jusbrasil>", "reclameaqui": "<pt: Reclame Aqui>", "indeed": "<pt: Indeed>", "reddit": "<pt: Reddit>", "other": "<pt: Outra>" }
  }
},
"Research": {
  "title": "<pt: Pesquisa>",
  "desc": "<pt> Chaves opcionais para coletar dados públicos da empresa. Ficam só no seu navegador.",
  "tavilyKey": "<pt: Chave Tavily>",
  "tavilyDesc": "<pt> Recomendado. Habilita a busca automática (1.000 créditos/mês grátis, sem cartão).",
  "braveKey": "<pt> Chave Brave",
  "braveDesc": "<pt> Desativado por padrão: a API não libera CORS para o navegador.",
  "jinaKey": "<pt: Chave Jina",
  "jinaDesc": "<pt> Opcional. Só aumenta o limite de leitura (20/min).",
  "youtubeKey": "<pt> Chave YouTube",
  "youtubeDesc": "<pt> Opcional. Habilita os posts recentes do YouTube.",
  "githubToken": "<pt> Token GitHub",
  "githubDesc": "<pt> Opcional. Aumenta o limite de leitura (60/h → 5.000/h).",
  "ready": "<pt> pronto",
  "noKey": "<pt> sem chave",
  "blocked": "<pt> bloqueado (CORS)",
  "invalid": "<pt> erro 401",
  "validate": "<pt: Validar>",
  "links": { "tavily": "<https://app.tavily.com>", "brave": "<https://brave.com/search/api/>", "jina": "<https://jina.ai>", "youtube": "<https://console.cloud.google.com>", "github": "<https://github.com/settings/tokens>" }
}
```

> Os textos acima estão em português como referência. **Traduza cada valor** para inglês (en-US) e espanhol (es-ES) — o conjunto de chaves deve ser **idêntico** nos 3 arquivos, com o mesmo nesting e os mesmos literais de enum.

- [ ] **Step 4: Rodar o teste para ver passar**

Run: `cd web && npm test -- --run tests/i18n.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/messages/pt-BR.json web/messages/en-US.json web/messages/es-ES.json web/tests/i18n.test.ts
git commit -m "feat(web): i18n dos namespaces Dossier e Research (pt-BR, en-US, es-ES)"
```

---

### Task 7: Configurações — seção "Pesquisa"

**Files:**
- Modify: `web/app/components/SettingsDialog.tsx`
- Test: `web/tests/ui-contract.test.ts`

**Interfaces:**
- Consumes: `loadSettings`, `saveSettings` (merge, Task 1); `Settings["research"]` (Task 1); `useTranslations("Research")` (Task 6); `tavilySearch(query, key)` (Task 3) — só para o botão "Validar".
- Produces: uma seção "Pesquisa" no `SettingsDialog` com 5 campos de chave, um botão "Validar" por chave Tavily e um indicador de status por provedor.

- [ ] **Step 1: Escrever o teste que falha**

Em `web/tests/ui-contract.test.ts`, acrescente dentro de `describe("settings dialog (post-onboarding)")`:

```ts
  it("tem a seção de pesquisa com as chaves de search", () => {
    const s = readFileSync("app/components/SettingsDialog.tsx", "utf8");
    expect(s).toContain('useTranslations("Research")');
    for (const field of ["tavilyKey", "braveKey", "jinaKey", "youtubeKey", "githubToken"]) {
      expect(s, field).toContain(field);
    }
    expect(s).toContain("loadSettings");
    expect(s).toContain("saveSettings");
  });
  it("nenhum componente novo usa /api/ ou server actions", () => {
    for (const f of ["app/components/SettingsDialog.tsx"]) {
      const s = readFileSync(f, "utf8");
      expect(s, f).not.toContain("../actions");
      expect(s, f).not.toContain("app/api/");
    }
  });
```

- [ ] **Step 2: Rodar o teste para ver falhar**

Run: `cd web && npm test -- --run tests/ui-contract.test.ts`
Expected: FAIL — `useTranslations("Research")` ausente.

- [ ] **Step 3: Implementar a seção em `web/app/components/SettingsDialog.tsx`**

1. Adicione `import { useTranslations } from "next-intl";` (já existe) e uma segunda instância: `const tr = useTranslations("Research");`.
2. No `handleOpen`, carregue `s.research` para os estados locais `tavilyKey`, `braveKey`, `jinaKey`, `youtubeKey`, `githubToken`.
3. No `handleSave`, chame `saveSettings({ geminiKey: trimmed, models: all, research: { tavilyKey, braveKey, jinaKey, youtubeKey, githubToken } })` — o merge do `saveSettings` (Task 1) garante que nada é apagado.
4. Renderize, **após** o bloco da chave Gemini e **antes** do bloco de Backup, uma seção com borda superior (`className="space-y-2 border-t pt-3"`):
   - título `tr("title")` e descrição `tr("desc")`;
   - 5 campos: cada um com `<label>`, um `<input type="password">` com `placeholder` da chave, a descrição (`tr("<campo>Desc")`), um link externo para o cadastro (`tr("links.<provedor>")`, `target="_blank" rel="noopener"`) e um badge de status (use `Badge` de `./ui/badge`): `tr("ready")` se o campo estiver preenchido, `tr("noKey")` se estiver vazio, `tr("invalid")` se a última validação deu 401, `tr("blocked")` para o Brave (sempre, enquanto `BRAVE_ENABLED` for `false`).
   - um botão "Validar" (`variant="outline" size="sm"`) ao lado do campo Tavily, que chama `tavilySearch("personalize-my-cv test", tavilyKey)` e, em sucesso, mostra `tr("ready")`; em `401`, mostra `tr("invalid")`; em `429`, `tr("researchRateLimit")`.
5. **Não** adicione o botão de "apagar tudo" novo — a zona de perigo existente continua igual.

- [ ] **Step 4: Rodar o teste para ver passar**

Run: `cd web && npm test -- --run tests/ui-contract.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/app/components/SettingsDialog.tsx web/tests/ui-contract.test.ts
git commit -m "feat(web): secao de pesquisa nas configuracoes (chaves Tavily, Jina, YouTube, GitHub)"
```

---

### Task 8: UI — botão, diálogo e painel do dossiê

**Files:**
- Modify: `web/app/components/ui/dialog.tsx` (prop `size`), `web/app/components/DetailDrawer.tsx`, `web/app/components/VacancyTable.tsx`, `web/app/components/DashboardTabs.tsx`
- Create: `web/app/components/DossierDialog.tsx`, `web/app/components/DossierPanel.tsx`, `web/app/components/CopyButton.tsx`
- Test: `web/tests/ui-contract.test.ts`

**Interfaces:**
- Consumes: `runDossierJob`, `runDossierFromDocs`, `runDossierMatch`, `DossierStage` (Task 5); `Dossier`, `DossierMatch` (Task 1); `loadDossiers`, `findDossierByCompany`, `loadApps`, `saveApps`, `loadSettings` (Task 1); `companyKey`, `isPlaceholderCompany` (Task 2); `jinaRead` (Task 3); `buildDossierMarkdown`, `dossierMarkdownFileName` (Task 9); `useTranslations("Dossier")` (Task 6).
- Produces:
  - `web/app/components/ui/dialog.tsx`: `Dialog({ open, onClose, children, size }: { open: boolean; onClose: () => void; children: React.ReactNode; size?: "md" | "wide" })` — `size` default `"md"` (comportamento atual preservado).
  - `web/app/components/DossierDialog.tsx`: `DossierDialog({ app, onClose, onChanged }: { app: StoredApp; onClose: () => void; onChanged?: (apps: StoredApp[]) => void })`.
  - `web/app/components/DossierPanel.tsx`: `DossierPanel({ dossier, match, onAnalyze, onRefresh, onExportMd, busy }: { dossier: Dossier; match: DossierMatch | null; onAnalyze: () => void; onRefresh: () => void; onExportMd: () => void; busy: boolean })`.

- [ ] **Step 1: Escrever os testes que falham**

Em `web/tests/ui-contract.test.ts`, acrescente um novo `describe("dossiê")`:

```ts
describe("dossiê", () => {
  it("os componentes do dossiê existem", () => {
    for (const f of ["app/components/DossierDialog.tsx", "app/components/DossierPanel.tsx"]) expect(existsSync(f), f).toBe(true);
  });
  it("a DetailDrawer tem o botão de montar dossiê", () => {
    const s = readFileSync("app/components/DetailDrawer.tsx", "utf8");
    expect(s).toContain('useTranslations("Dossier")');
    expect(s).toContain("onOpenDossier");
  });
  it("o DossierDialog NÃO é montado dentro do DetailDrawer (scroll-lock)", () => {
    const drawer = readFileSync("app/components/DetailDrawer.tsx", "utf8");
    expect(drawer).not.toContain("DossierDialog");
    const tabs = readFileSync("app/components/DashboardTabs.tsx", "utf8");
    expect(tabs).toContain("DossierDialog");
  });
  it("nenhum componente do dossiê usa /api/ nem server actions", () => {
    for (const f of ["app/components/DossierDialog.tsx", "app/components/DossierPanel.tsx", "app/components/DetailDrawer.tsx"]) {
      const s = readFileSync(f, "utf8");
      expect(s, f).not.toContain("../actions");
      expect(s, f).not.toContain("app/api/");
    }
  });
  it("o diálogo aceita o tamanho largo", () => {
    expect(readFileSync("app/components/ui/dialog.tsx", "utf8")).toContain("size");
  });
});
```

- [ ] **Step 2: Rodar o teste para ver falhar**

Run: `cd web && npm test -- --run tests/ui-contract.test.ts`
Expected: FAIL — `app/components/DossierDialog.tsx` não existe.

- [ ] **Step 3: Adicionar a prop `size` em `web/app/components/ui/dialog.tsx`**

```tsx
export function Dialog({ open, onClose, children, size = "md" }: { open: boolean; onClose: () => void; children: React.ReactNode; size?: "md" | "wide" }) {
  ...
  className={cn("max-h-[90vh] w-full overflow-y-auto rounded-lg border border-border bg-background p-6 shadow-lg animate-in fade-in zoom-in-95 duration-150", size === "wide" ? "max-w-5xl" : "max-w-2xl")}
}
```

- [ ] **Step 4: Extrair `CopyButton` para `web/app/components/CopyButton.tsx`**

Mova o componente `CopyButton` de `DetailDrawer.tsx` para um arquivo próprio, exportando `CopyButton({ text, label }: { text: string; label: string })`, mantendo o comportamento atual (usa `navigator.clipboard.writeText` com fallback de `document.execCommand("copy")`, mostra `LuCheck` por 1,5 s e emite `toast.success(t("copied", { label }))`). Atualize o import em `DetailDrawer.tsx` para `import { CopyButton } from "./CopyButton";`.

- [ ] **Step 5: Criar `web/app/components/DossierPanel.tsx` — esqueleto, abas e Panorama**

Componente **puramente apresentacional** (recebe `dossier`, `match` e callbacks; não busca nada):

```tsx
export function DossierPanel({ dossier, match, onAnalyze, onRefresh, onExportMd, busy }: {
  dossier: Dossier; match: DossierMatch | null;
  onAnalyze: () => void; onRefresh: () => void; onExportMd: () => void; busy: boolean;
}) { /* ... */ }
```

1. `const t = useTranslations("Dossier");` e `const te = useTranslations("Dossier.enums");`
2. `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent` de `./ui/tabs`, na ordem: Panorama, Empresa, Liderança, Produtos, Reputação, Contatos, Redes sociais, Plano de abordagem, Perguntas, Fontes (rótulos via `t("tabs.*")`).
3. Conteúdo de **Panorama**: badge do veredito (`te("verdict." + match.alignment.verdict)`, variante `success` / `default` / `destructive` conforme o veredito), `Progress` com `match.alignment.score`, as dimensões com barra e nota, e o banner de cobertura lendo `dossier.coverage` → conta `ausente` + `parcial` e mostra `t("coveragePartial", { n })` (ou `t("coverageOk")`).
4. Quando `match` for `null`: nas abas Panorama/Abordagem/Perguntas mostre `t("noDossier")` e deixe o botão "Analisar esta vaga" visível.

- [ ] **Step 6: Criar `web/app/components/DossierPanel.tsx` — Empresa, Liderança e Produtos**

1. **Empresa**: `history.summary`, `founded`, a timeline (`year — event`), missão, visão, valores; e o bloco `legal` (razão social, fantasy, abertura, CNAE, porte, capital e a lista de sócios `name — role (since)`).
2. **Liderança**: `leadership.ceo` (name, role, bio) e os `highlights` — cada um com `claim`, a data e um link para `sourceUrl` (`target="_blank" rel="noopener"`); quando `sourceUrl` for nulo, mostrar `t("noSource")` em texto secundário.
3. **Produtos**: cards com `name`, `description`, `customerSignal` e as `evidence` (com link).
4. Em todas as listas de evidência use o mesmo padrão: **evidência com `sourceUrl`** → link; **evidência sem `sourceUrl`** → `t("noSource")` em `text-muted-foreground`, **sem** link.

- [ ] **Step 7: Criar `web/app/components/DossierPanel.tsx` — Reputação, Contatos, Redes, Abordagem, Perguntas, Fontes e rodapé**

1. **Reputação**: red flags agrupadas por `severity` (badge `te("severity." + severity)`), cada uma com `title`, `detail`, `date`, `mitigation` e as evidências; depois a lista de reviews com `source` (badge `te("source." + source)`), `sentiment` (badge `te("sentiment." + sentiment)`), `topic`, `date` e `quote`.
2. **Contatos**: cards com `name`, `role`, badge `te("kind." + kind)`, badge `te("channel." + channel)`, `hint`, badge `te("confidence." + confidence)` e link quando houver `url`.
3. **Redes sociais**: por rede, badge `te("network." + network)`, o `tone` e os posts (`date — text`, com link quando houver `url`).
4. **Plano de abordagem**: por item de `match.outreach` — alvo, papel, badge `te("goal." + goal)`, badge `te("channel." + channel)`, `angle` e a `message` num `<pre>` com um `<CopyButton text={message} label={target} />`.
5. **Perguntas**: `question`, `why` e link da evidência.
6. **Fontes**: `dossier.sources` — URL, título, data e provedor, cada um como link.
7. **Rodapé**: botões "Analisar esta vaga" (`onAnalyze`, desabilitado se `busy`), "Atualizar pesquisa" (`onRefresh`) e "Exportar Markdown" (`onExportMd`).

- [ ] **Step 8: Criar `web/app/components/DossierDialog.tsx` — formulário de identidade e de fonte**

1. `const t = useTranslations("Dossier");`
2. Estados: `phase: "form" | "busy" | "ready"`, `company`, `cnpj`, `mode: "auto" | "urls" | "text"`, `urlsText`, `materialText`, `dossier`, `match`, `stage`, `error`.
3. Ao abrir: `company` inicial = `app.empresa`, **vazio** se `isPlaceholderCompany(app.empresa, app.lang)` (Task 2). Carregue o dossiê por `findDossierByCompany(companyKey(app.empresa))`; se existir e `status === "done"`, `phase = "ready"`, `dossier = existente`, `match = app.dossierMatch ?? null`.
4. Mostre a linha de aviso `t("consentNotice")` na parte de cima do formulário.
5. Campos: **nome da empresa** (obrigatório; erro `t("companyRequired")` quando vazio) e **CNPJ** (opcional).
6. Três cartões de escolha de `mode`: `auto` (t("auto")/t("autoDesc")), `urls` (t("manualUrls")/t("manualUrlsDesc")), `text` (t("manualText")/t("manualTextDesc")).
7. `mode === "urls"`: um `<Textarea>` (uma URL por linha); o botão só habilita com ≥1 URL não vazia. `mode === "text"`: um `<Textarea>` para o material. `mode === "auto"`: se `loadSettings().research.tavilyKey` estiver vazio, desabilite o botão e mostre `tErr(getLocale(), "noResearchKey")` com um link para as Configurações.
8. Quando o dossiê existe e `dossier.lang !== app.lang`, mostre um badge `t("langBadge", { lang: dossier.lang })` e um botão "Regerar em {app.lang}" que chama `runDossierFromDocs` com os docs relidos das URLs de `dossier.sources` (spec D5 — **sem** nova busca, **sem** gastar crédito).

- [ ] **Step 9: Criar `web/app/components/DossierDialog.tsx` — execução, resultado e ações**

1. Botão "Montar dossiê":
   - `mode === "auto"` → `runDossierJob({ company, cnpj, lang: app.lang, force: true, onStage: (s) => setStage(s) })`.
   - `mode === "urls"` → leia cada URL com `jinaRead(url, loadSettings().research.jinaKey || undefined)` (pule as que falharem, registrando em `error`) e chame `runDossierFromDocs({ company, lang: app.lang, docs })`.
   - `mode === "text"` → monte `docs = [{ url: "pmcv:material:1", title: "Material colado", publishedAt: null, content: materialText, provider: "user" }]` e chame `runDossierFromDocs`.
2. `phase === "busy"`: mostre a etapa atual mapeada de `stage` (`t("stage.search")`, `t("stage.read")`, `t("stage.official")`, `t("stage.synthesize")`, `t("stage.match")`) + `t("durationNote")`; botão "Cancelar" que chama `onClose()`.
3. `phase === "ready"`: renderize `<DossierPanel dossier={dossier} match={match} onAnalyze={...} onRefresh={...} onExportMd={...} busy={busy} />`.
4. "Analisar esta vaga" → `runDossierMatch(app)` → atualiza `match` e chama `onChanged?.(loadApps())`; em erro, `toast.error(err)`.
5. "Atualizar pesquisa" → `runDossierJob({ company, lang: app.lang, force: true })` → substitui o dossiê e marca os `dossierMatch` das apps daquela empresa como `stale: true` (`saveApps(loadApps().map(a => a.dossierId === dossier.id ? { ...a, dossierMatch: a.dossierMatch ? { ...a.dossierMatch, stale: true } : null } : a))`).
6. "Exportar Markdown" → `buildDossierMarkdown(dossier, match)` e download do blob (mesmo padrão de `SettingsDialog.tsx`). **Implemente `lib/dossier-markdown.ts` como stub** (`export function buildDossierMarkdown(dossier: Dossier, match: DossierMatch | null): string` retornando `# ${dossier.company}` e `export function dossierMarkdownFileName(dossier: Dossier): string` retornando `dossie-${dossier.companyKey}.md`) — a Task 9 substitui o corpo.

- [ ] **Step 10: Ligar o botão na `DetailDrawer`**

Em `web/app/components/DetailDrawer.tsx`:
1. Adicione a prop `onOpenDossier?: (app: StoredApp) => void`.
2. Adicione o botão **"Montar dossiê"** (`t("open")`, ícone `LuBuilding2` de `react-icons/lu`) ao lado dos botões de download/imprimir, visível só quando `app.status === "done"`, chamando `onOpenDossier?.(app)`.
3. Se `app.dossierMatch` existir, mostre acima do email: badge do veredito + `match.alignment.score` + número de red flags (`app.dossierMatch.redFlagSummary.length`) + um badge "análise desatualizada" quando `app.dossierMatch.stale` for `true` (`t("stale")`).
4. **Não** importe `DossierDialog` aqui (scroll-lock — ver o teste).

Em `web/app/components/VacancyTable.tsx`: prop `onOpenDossier?: (app: StoredApp) => void`, repassada ao `<DetailDrawer app={selected} onClose={...} onOpenDossier={onOpenDossier} />`.

Em `web/app/components/DashboardTabs.tsx`: estado `dossierApp: StoredApp | null`; passe `onOpenDossier={(a) => setDossierApp(a)}` ao `<VacancyTable>`; renderize `{dossierApp ? <DossierDialog app={dossierApp} onClose={() => setDossierApp(null)} onChanged={setApps} /> : null}` **como irmão** do `<VacancyTable>` (não dentro dele).

- [ ] **Step 11: Rodar os testes para ver passar**

Run: `cd web && npm test -- --run tests/ui-contract.test.ts`
Expected: PASS.

- [ ] **Step 12: Typecheck + suite completa**

Run: `cd web && npx tsc --noEmit && npm test -- --run`
Expected: sem erros de tipo, todos PASS.

- [ ] **Step 13: Commit**

```bash
git add web/app/components/ui/dialog.tsx web/app/components/DossierDialog.tsx web/app/components/DossierPanel.tsx web/app/components/CopyButton.tsx web/app/components/DetailDrawer.tsx web/app/components/VacancyTable.tsx web/app/components/DashboardTabs.tsx web/tests/ui-contract.test.ts
git commit -m "feat(web): botao e dialogo do dossie com painel por secao"
```

---

### Task 9: Exportar o dossiê em Markdown

**Files:**
- Create: `web/lib/dossier-markdown.ts`
- Modify: `web/app/components/DossierDialog.tsx` (botão "Exportar Markdown")
- Test: `web/tests/dossier-markdown.test.ts`

**Interfaces:**
- Consumes: `Dossier`, `DossierMatch` (Task 1).
- Produces: `buildDossierMarkdown(dossier: Dossier, match: DossierMatch | null): string` e `dossierMarkdownFileName(dossier: Dossier): string`.

- [ ] **Step 1: Escrever o teste que falha**

Em `web/tests/dossier-markdown.test.ts` (novo):

```ts
import { describe, expect, it } from "vitest";
import { buildDossierMarkdown, dossierMarkdownFileName } from "@/lib/dossier-markdown";

const dossier = {
  id: "dsr_acme", companyKey: "acme", company: "Acme", lang: "pt-BR",
  history: { founded: "2010", timeline: [{ year: "2012", event: "produto X" }], mission: "m", vision: "v", values: ["v1"], summary: "resumo" },
  leadership: { ceo: { name: "JOÃO", role: "CEO", bio: "b", highlights: [{ claim: "h", sourceUrl: "https://a.com", sourceTitle: "A", date: "2026-09-01", quote: "q", origin: "web", unsourced: false }] } },
  products: [{ name: "Prod", description: "d", customerSignal: "cs", evidence: [] }],
  reputation: { reviews: [{ source: "glassdoor", sentiment: "contra", topic: "demissão", date: "2026-08-01", quote: "qq", sourceUrl: "https://g.com" }], redFlags: [{ severity: "high", category: "cultura", title: "RF", detail: "dd", date: "2026-08-01", evidence: [], mitigation: "m" }] },
  contacts: [{ name: "MARIA", role: "RH", kind: "rh", channel: "linkedin", url: "https://li.com/m", hint: "h", confidence: "high" }],
  socials: [{ network: "linkedin", handle: "acme", url: "https://li.com/acme", tone: "tom", posts: [{ date: "2026-09-02", text: "post", url: "https://li.com/p" }] }],
  coverage: [{ section: "historia", status: "ok" }],
  sources: [{ url: "https://a.com", title: "A", publishedAt: "2026-09-01", retrievedAt: "2026-10-01T00:00:00.000Z", provider: "jina" }],
  status: "done", errorLog: "", cnpj: null,
  createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-01T00:00:00.000Z",
};

describe("markdown do dossiê", () => {
  it("inclui as seções principais e as fontes", () => {
    const md = buildDossierMarkdown(dossier as never, null);
    expect(md).toContain("# Acme");
    expect(md).toContain("## Empresa");
    expect(md).toContain("## Reputação");
    expect(md).toContain("## Contatos");
    expect(md).toContain("## Fontes");
    expect(md).toContain("https://a.com");
    expect(md).toContain("JOÃO");
  });

  it("inclui o plano de abordagem quando há match", () => {
    const md = buildDossierMarkdown(dossier as never, { alignment: { score: 70, verdict: "vai", dimensions: [] }, outreach: [{ target: "MARIA", role: "RH", goal: "rh", channel: "linkedin", angle: "a", message: "msg", sourceUrl: null }] } as never);
    expect(md).toContain("## Plano de abordagem");
    expect(md).toContain("msg");
  });

  it("gera um nome de arquivo seguro", () => {
    expect(dossierMarkdownFileName(dossier as never)).toBe("dossie-acme.md");
  });
});
```

- [ ] **Step 2: Rodar o teste para ver falhar**

Run: `cd web && npm test -- --run tests/dossier-markdown.test.ts`
Expected: FAIL — `Cannot find module '@/lib/dossier-markdown'`.

- [ ] **Step 3: Implementar `web/lib/dossier-markdown.ts`**

```ts
import type { Dossier, DossierMatch } from "./dossier-schema";

export function dossierMarkdownFileName(dossier: Dossier): string {
  return `dossie-${dossier.companyKey}.md`;
}

export function buildDossierMarkdown(dossier: Dossier, match: DossierMatch | null): string {
  const L: string[] = [];
  const link = (u: string | null | undefined, label: string) => (u ? `[${label}](${u})` : label);
  L.push(`# Dossiê — ${dossier.company}`, "", `Gerado em ${dossier.createdAt.slice(0, 10)} · idioma: ${dossier.lang}`, "");
  if (match) {
    L.push("## Panorama", "", `Veredito: **${match.alignment.verdict}** · alinhamento: ${match.alignment.score}%`, "");
    for (const p of match.attentionPoints) L.push(`- ${p}`);
    L.push("");
  }
  L.push("## Empresa", "", dossier.history.summary, "");
  if (dossier.history.founded) L.push(`Fundada em ${dossier.history.founded}`);
  if (dossier.history.mission) L.push(`Missão: ${dossier.history.mission}`);
  if (dossier.history.vision) L.push(`Visão: ${dossier.history.vision}`);
  if (dossier.history.values.length) L.push(`Valores: ${dossier.history.values.join(", ")}`);
  L.push("");
  for (const t of dossier.history.timeline) L.push(`- ${t.year} — ${t.event}`);
  if (dossier.legal.razaoSocial) L.push("", `Dados legais: ${dossier.legal.razaoSocial}${dossier.legal.openedAt ? ` · aberta em ${dossier.legal.openedAt}` : ""}`);
  L.push("", "## Liderança", "");
  if (dossier.leadership.ceo) {
    L.push(`**${dossier.leadership.ceo.name}** — ${dossier.leadership.ceo.role}`, "", dossier.leadership.ceo.bio, "");
    for (const h of dossier.leadership.ceo.highlights) L.push(`- ${h.claim} ${link(h.sourceUrl, h.sourceUrl ?? "(sem fonte)")}${h.date ? ` (${h.date})` : ""}`);
  }
  L.push("", "## Produtos", "");
  for (const p of dossier.products) L.push(`- **${p.name}** — ${p.description} ${p.customerSignal}`);
  L.push("", "## Reputação", "");
  for (const f of dossier.reputation.redFlags) L.push(`- **[${f.severity}] ${f.title}** — ${f.detail}${f.date ? ` (${f.date})` : ""}`);
  for (const r of dossier.reputation.reviews) L.push(`- (${r.source}, ${r.sentiment}, ${r.date ?? "sem data"}) ${r.topic}: ${r.quote} ${link(r.sourceUrl, r.sourceUrl ?? "(sem fonte)")}`);
  L.push("", "## Contatos", "");
  for (const c of dossier.contacts) L.push(`- **${c.name}** (${c.role}, ${c.kind}) — ${c.hint} ${link(c.url, c.url ?? "")}`);
  L.push("", "## Redes sociais", "");
  for (const s of dossier.socials) L.push(`- **${s.network}** — ${s.tone}`, ...s.posts.map((p) => `  - ${p.date ?? "sem data"}: ${p.text} ${link(p.url, p.url ?? "")}`));
  if (match) {
    L.push("", "## Plano de abordagem", "");
    for (const o of match.outreach) L.push(`- **${o.target}** (${o.role}, ${o.goal}, ${o.channel}) — ${o.angle}`, "", `> ${o.message}`, "");
    L.push("## Perguntas para a entrevista", "");
    for (const q of match.questions) L.push(`- ${q.question} — ${q.why}`);
  }
  L.push("", "## Fontes", "");
  for (const s of dossier.sources) L.push(`- ${link(s.url, s.title || s.url)} (${s.publishedAt ?? "sem data"}, ${s.provider})`);
  return L.join("\n");
}
```

- [ ] **Step 4: Ligar o botão em `DossierDialog.tsx`**

No handler `onExportMd`: `const md = buildDossierMarkdown(dossier, match); const blob = new Blob([md], { type: "text/markdown" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = dossierMarkdownFileName(dossier); a.click(); setTimeout(() => URL.revokeObjectURL(url), 10_000);` — mesmo padrão de download já usado em `SettingsDialog.tsx`.

- [ ] **Step 5: Rodar os testes + typecheck**

Run: `cd web && npm test -- --run tests/dossier-markdown.test.ts && npx tsc --noEmit`
Expected: PASS, sem erros de tipo.

- [ ] **Step 6: Commit**

```bash
git add web/lib/dossier-markdown.ts web/app/components/DossierDialog.tsx web/tests/dossier-markdown.test.ts
git commit -m "feat(web): exportacao do dossie em markdown"
```

---

### Task 10: Documentação, políticas e ajuda

**Files:**
- Modify: `web/README.md`, `web/AGENTS.md`, `app/privacidade/page.tsx`, `app/termos/page.tsx`, `messages/{pt-BR,en-US,es-ES}.json` (seções `Cookie.message`, `Privacy.s3b`, `Privacy.s4b`, `Terms.s5b`, `Help.s5t`/`s5d`), `web/app/components/HelpDialog.tsx`
- Test: `web/tests/legal.test.ts` (já existe — verificar o que ele exige)

**Interfaces:**
- Consumes: nada de código novo — apenas texto.
- Produces: documentação coerente com a feature.

- [ ] **Step 1: Rodar o teste de legal existente para ver a linha de base**

Run: `cd web && npm test -- --run tests/legal.test.ts`
Expected: PASS (baseline antes de editar).

- [ ] **Step 2: Atualizar as políticas e o cookie banner**

Em `messages/*.json` (traduzindo para cada locale):
- `Cookie.message`: citar que a pesquisa usa Tavily, Jina, BrasilAPI, YouTube e GitHub, todos chamados do navegador.
- `Privacy.s3b`: listar os novos terceiros e dizer que **URLs públicas** da empresa pesquisada passam por eles.
- `Privacy.s4b`: acrescentar que o dossiê contém **dados de terceiros** (nomes e cargos de pessoas) e fica só no `localStorage`.
- `Terms.s5b`: acrescentar que o app **não** faz login, não contorna CAPTCHA e não faz scraping massivo; que o usuário é responsável por respeitar os termos dos sites consultados.
- `Help`: acrescentar um passo "5. Monte o dossiê da empresa" (`Help.s5t`/`s5d`) descrevendo o botão, as 3 fontes (automática / URLs / material) e o plano de abordagem.

Em `app/privacidade/page.tsx` e `app/termos/page.tsx`: os textos são hardcoded **nesses dois arquivos** (não passam por `messages/`) — Atualize-os com o mesmo conteúdo, em português.

- [ ] **Step 3: Atualizar `web/README.md` e `web/AGENTS.md`**

`web/README.md`:
- Nova seção **"Dossiê de empresa"**: o que é, o botão "Montar dossiê", as 3 fontes de pesquisa, as chaves opcionais (Tavily/Jina/YouTube/GitHub) e o custo zero; avisar que o PDF do dossiê não existe (export Markdown) e que a reputação pode vir parcial.
- Na seção de aviso de segurança, acrescenter que as chaves de pesquisa têm o mesmo tratamento (obfuscação, não cofre).

`web/AGENTS.md`:
- Em **Architecture**: acrescentar `lib/dossier-schema.ts`, `lib/dossier.ts`, `lib/dossier-client.ts`, `lib/research/*`, `lib/dossier-markdown.ts`, `pmcv:dossiers`, `pmcv:readcache`, `app/components/DossierDialog.tsx`, `app/components/DossierPanel.tsx`.
- Em **i18n**: os enums do dossiê são literais em inglês no código e traduzidos via `Dossier.enums.*`.
- Em **Rules**: acrescentar — "o corpus do dossiê é o conjunto de documentos lidos; nenhuma URL fora dele pode ser citada"; "o Brave fica desligado: a API não libera CORS"; "grounding não é usado (incompatível com `responseMimeType: application/json`)".

- [ ] **Step 4: Rodar a suíte + typecheck + build**

Run: `cd web && npm test -- --run && npx tsc --noEmit && npm run build`
Expected: tudo PASS, `tsc` limpo, `next build` gera `out/` sem erros.

- [ ] **Step 5: Commit**

```bash
git add web/README.md web/AGENTS.md web/app/privacidade/page.tsx web/app/termos/page.tsx web/messages web/app/components/HelpDialog.tsx
git commit -m "docs(web): politica de privacidade, termos, ajuda e README do dossie"
```

---

## Checklist de revisão manual (após a Task 10)

- [ ] `npm test -- --run` verde e `npx tsc --noEmit` limpo.
- [ ] `npm run build` gera `web/out/` (site estático, sem servidor).
- [ ] Fluxo completo sem nenhuma chave nova: candidacy → "Montar dossiê" → "Colar URLs" → dossiê gerado → "Analisar esta vaga" → plano de abordagem com mensagens copiáveis.
- [ ] Fluxo com chave Tavily: pesquisa automática → banner de cobertura aparece quando alguma seção ficou sem evidência.
- [ ] Botão "Cancelar" no meio da pesquisa não deixa dossiê salvo pela metade (exceto `status: "failed"` com `sources`, que é intencional).
- [ ] Duas abas com a mesma empresa: só um dossiê (`id` determinístico).
- [ ] Backup: exportar → limpar tudo → importar → os dossiês voltaram.
- [ ] Um backup **antigo** (sem `dossiers`) importado **não** apaga os dossiês locais.
