# Personalize My CV — Dossiê de empresa (pesquisa + plano de abordagem)

Data: 2026-10-21
Status: **aprovado** — brainstorming OK · builder-check OK (17 questionamentos incorporados) · 3 decisões fechadas com o parceiro (PDF fora da v1, consentimento por aviso no diálogo, reputação com cobertura parcial) · pronto para o plano
Path: feature → camada de pesquisa de empresa sobre a candidatura, 100% cliente (deploy estático preservado)

> **Revisão 2 (pós builder-check).** O revisor levantou 17 pontos. Resolvidos aqui: corpus = documentos **lidos** (não os descobertos); `sourceUrl` anulável + `origin` para material colado; `coverage` e `sources` passam a ser **do código**, não do modelo; `legal` é escrito pelo código a partir do BrasilAPI (nunca pelo Gemini); **grounding sai da v1** (incompatível com `responseMimeType: application/json` e violaria o invariante de evidência); identidade da empresa é **editável** antes da pesquisa (o placeholder `MISSING_JOB` = "Empresa"/"Company" geraria lixo); dossiê tem `status`/`errorLog` e o retry **re-lê as URLs já lidas** em vez de refazer as buscas; `saveSettings` passa a ser **merge** (hoje sobrescreve e apagaria a chave Tavily); o diálogo do dossiê **não** é montado dentro do `DetailDrawer` (scroll-lock); cobertura dos blocos + limites de array; quotas por seção; datas vêm do Jina (o `published_date` do Tavily é "published or last updated", não data de publicação).

## 1. Entendimento

**Problema.** Hoje o app gera, por vaga, um currículo sob medida + análise + email + mensagem instantânea. Não há nada que responda "essa empresa é boa pra mim?", "existe red flag?" e "como eu falo com alguém de verdade, sem passar só pelo filtro do ATS?".

**Objetivo.** Depois de gerado o currículo e a apresentação de uma vaga, o usuário deve poder montar um **dossiê da empresa** que responde a três perguntas:

1. **Alinhamento** — o quanto a empresa combina com ele e com a vaga (não só com o currículo).
2. **Red flags** — o que pesa contra a empresa, com evidência, data e fonte.
3. **Abordagem** — quem contatar (RH, gestor, DPO, recrutador), por qual canal, com que gancho, e a mensagem pronta para copiar — o caminho para sair do filtro do ATS.

**Conteúdo do dossiê (7 blocos pedidos):** história/missão/visão/valores · CEO/dono + highlights · até 3 produtos + como os clientes os qualificam · relatos de funcionários (pró/contra, com data e sobre o que o processo tratava) · ≥5 pontos de contato (RH, DPO, gestores de projeto, pessoas-chave da contratação) · todas as redes sociais + últimos 5 posts de cada + tom de cada rede · resumo com relação à vaga e ao currículo gerado.

**Unidade de armazenamento.** **1 dossiê por empresa** (reaproveitado entre vagas), **1 análise por candidatura** (o resumo frente àquela vaga e àquele currículo tailored). O usuário pediu explicitamente esse desenho.

**Sucesso.** A partir de uma candidatura pronta, o usuário gera um dossiê com evidência rastreável (cada afirmação com URL e data), recebe um veredito de alinhamento com pontos de atenção, e sai com um plano de contato acionável — sem servidor, sem backend, sem custo se o usuário usar as cotas gratuitas.

**Restrições do parceiro (aprovadas):**
- O app é 100% estático (`output: "export"`); **server functions / route handlers estão fora** (o static export desabilita Server Actions, Route Handlers, Middleware e APIs dinâmicas).
- Retrieval e síntese são camadas **separadas**: quem acha o material é uma search API (dados determinísticos, com URL e data); quem estrutura é o Gemini.
- BYOK: chaves de terceiros ficam no browser, ofuscadas com `secure-ls`, junto com a chave Gemini — mesmo padrão já existente.
- Custo alvo: **US$ 0** com as cotas gratuitas.
- Primeiro o `web/`; depois replicar o contrato em `mobile/` e `cli/` (reimplementação, nunca import — ver `PROJECT.md`).

**Nota de segurança (consistente com o spec BYOK):** a chave da search API fica no browser do usuário com a mesma ofuscação da chave Gemini. É conveniência, não cofre. Nenhuma chave nova é hardcoded no bundle.

## 2. Decisões que tomei (minhas — vete se discordar)

**D1 — Tavily substitui o Brave como provedor de busca primário.** Testei os dois no browser (com `Origin: https://personalize-my-cv.vercel.app`):

| Provider | CORS | Chave | Veredito |
|---|---|---|---|
| Tavily `POST https://api.tavily.com/search` | ✅ `ACAO: *`, preflight `authorization,content-type` OK | 1.000 créditos/mês, **sem cartão** | usável |
| Brave `api.search.brave.com/res/v1/web/search` | ❌ **nenhum header `access-control-*`** | ~$20/mês | **não usável do browser** |
| Jina `r.jina.ai` | ✅ ecoa a origem | não precisa (20 req/min) | usável |
| Jina `s.jina.ai` | ✅ | **exige chave** (401) | só com chave |
| BrasilAPI (CNPJ) | ✅ `ACAO: *` | não precisa | usável |
| YouTube / GitHub / Wikipedia | ✅ | opcional / não | usáveis |

O Brave foi a escolha original do brainstorm, mas sem CORS o browser bloqueia a resposta — não há contorno sem servidor, e servidor está fora. **O Brave fica no código como provedor secundário, desligado por padrão**, ativável por flag quando (e se) a Brave liberar CORS. Tavily cobre o mesmo papel (descoberta) e ainda traz `raw_content` como fallback de leitura. Custo final permanece zero.

**D2 — Cadeia de recuperação em camadas, não um provedor único.**
- *Descoberta* (achar URLs) → **Tavily** `POST /search` (1 crédito por busca básica).
- *Leitura* (texto da página + data de publicação) → **Jina Reader** `GET https://r.jina.ai/<url>` (sem chave; `x-ratelimit-limit: 20,20;w=60`).
- *Estruturado* (dado oficial) → **fetch direto** em APIs com CORS: BrasilAPI `/api/cnpj/v1/{cnpj}` (razão social, fantasy, data de abertura, CNAE, porte, capital, **QSA com sócios + qualificação + data de entrada**), GitHub `/orgs/{org}/events/public`, YouTube Data API `/search`, Wikipedia/Wikidata.
- *Síntese* → **Gemini** (`lib/llm/chain.ts` já existente, com fallback de models + repair de JSON).

**D3 — Gemini só sintetiza. O Google Search grounding sai da v1.** Na tabela de preços da API Gemini (`gemini-3.8-flash`): *Grounding with Google Search* = **"Not available" no Free Tier**; no Paid Tier são 5.000 buscas/mês grátis e depois $14/1.000, com a nota "uma request pode resultar em uma ou mais queries — você é cobrado por cada query individual". Além disso, o grounding é **incompatível com o caminho de código atual**: `chatJsonGemini` sempre envia `generationConfig.responseMimeType: "application/json"`, e a API Gemini rejeita tools com esse mime type ("Tool use with a response mime type: 'application/json' is unsupported", 400). E as citações do grounding são URLs do Google Search, que por definição **não estariam no corpus** → violariam o invariante de evidência (§4.1). Portanto: **grounding removido da v1 e do schema de Settings**; fica como backlog (§11), condicional a um caminho de chamada separado (sem JSON mode) **e** a uma regra de citação que aceite URLs externas ao corpus.

**D4 — localStorage permanece; sem IndexedDB.** 1 dossiê por empresa, JSON enxuto ⇒ ~25–40 KB por empresa. Migrar para IndexedDB exigiria async em `loadBase/loadApps/loadSettings`, `BroadcastChannel` no lugar do evento `storage`, `fake-indexeddb` nos testes e mudança da regra "persistence is localStorage" do `web/AGENTS.md`. Ganho de cota não compensa agora. Se o limite incomodar, o corte é "dossiês antigos" (exclusão manual), não a tecnologia.

**D5 — Idioma: o dossiê guarda o idioma da sua **primeira** geração; a análise é sempre no idioma da vaga.** Um dossiê por empresa que tivesse duas vagas em idiomas diferentes não pode estar nos dois. Decisão: o corpo do dossiê fica no idioma em que foi gerado e mostra um badge "gerado em pt-BR"; se uma vaga em outro idioma o reutiliza, o app oferece **"regerar em en"**, que **re-sintetiza a partir das fontes já lidas** (nenhuma busca nova — custo zero). A **análise (F5) é sempre gerada no idioma da candidatura**, porque é ela que contém as mensagens de abordagem que você vai colar para um recrutador.

**D6 — Sem PDF do dossiê na v1 (decidido com o parceiro).** Saídas: tela + "Copiar" por bloco + **exportar Markdown** (`.md`) para levar/colar. PDF fica como backlog (o `@react-pdf/renderer` já está no projeto, então é barato de adicionar depois).

**D7 — Sem aba "Dossiês" no dashboard na v1.** O dossiê é alcançável a partir de qualquer candidatura da mesma empresa.

**D8 — O modo "colar URLs" é caminho de primeira classe, não degradação.** Como o Jina não exige chave, **o dossiê funciona com zero chaves novas**: o usuário cola as URLs (ou o material) e a IA estrutura. É a rede de segurança e o caminho gratuito por definição.

**D9 — Gravação com consentimento e limites.** O app nunca faz login, nunca contorna CAPTCHA, nunca faz scraping massivo: teto de **22 buscas** e **15 leituras** por dossiê, e nenhuma chamada autenticada a Glassdoor/Jusbrasil/LinkedIn. Termos e política de privacidade precisam refletir os novos terceiros.

**D10 — A identidade da empresa é digitada/confirmada pelo usuário antes da pesquisa.** `app.empresa` é saída da LLM e pode ser literalmente o placeholder `MISSING_JOB.empresa` ("Empresa" / "Company" / "Empresa"). Pesquisar "Empresa" produz lixo. O diálogo abre com o **nome da empresa editável** (pré-preenchido com `app.empresa`) e um **campo opcional de CNPJ**; se o valor for o placeholder, o campo vem vazio e é obrigatório. `companyKey = slug(nome normalizado)` (minúsculas, sem acento, sem sufixos societários: `ltda`, `sa`, `me`, `eireli`, `inc`, `corp`, `s.a.`), e `id = "dsr_" + companyKey` — **determinístico**, para que duas abas não criem dois dossiês da mesma empresa. O CNPJ é um **atributo** do dossiê, não parte da chave (a chave não muda no meio da vida do registro).

**D11 — `legal` é escrito pelo código, nunca pelo Gemini.** O Gemini reformata e corrompe dado de registro. F3 busca o CNPJ; o código preenche `legal` verbatim e a URL do BrasilAPI entra em `sources[]`. A chamada A do modelo devolve **apenas** `history`, `leadership`, `products`. **Validação de homônimo:** o `razao_social` retornado precisa compartilhar ≥1 token significativo com o nome pesquisado (ou o CNPJ foi digitado pelo usuário) — caso contrário o dado de CNPJ é descartado e `coverage.cnpj = "ausente"`, para não anexar o CNPJ de outra empresa de nome parecido.

**D12 — A data de uma evidência vem do Jina, nunca do Tavily.** O `published_date` do Tavily só vem com `include_published_date: true` e é documentado como "published **or last updated**" — não é data de publicação. A data de leitura é o `Published Time` do Jina; se não houver, `date = null`. Nunca inventar data.

**D13 — `sources[]` e `coverage[]` são do código, não do modelo.** O modelo devolve só conteúdo. O código sabe exatamente o que leu (→ `sources[]`) e pode computar determinsticamente a cobertura (§4.1).

**D14 — `saveSettings` passa a ser merge.** Hoje `SettingsDialog.handleSave` faz `saveSettings({ geminiKey, models })`, sobrescrevendo tudo — com `research` no schema, salvar a chave Gemini **apagaria a chave Tavily**. `saveSettings` passa a mesclar campos; `loadSettings()` continua devolvendo o objeto completo (o que **quebra** `tests/store.test.ts:50`, que faz `toEqual({geminiKey, models})` — o teste precisa ser atualizado, ver §10).

**D15 — `importBackup` não apaga dossiês quando o backup é antigo.** `dossiers` vira opcional no schema do backup: se a chave não existir, os dossiês locais **são preservados**; se existir, são substituídos (comportamento coerente com base/apps).

## 3. Arquitetura

```
app/page.tsx (splash → onboarding → dashboard)                 [sem mudança de fluxo]
 └─ DashboardTabs
     ├─ VacancyTable → DetailDrawer
     │    └─ botão "Montar dossiê" → onOpenDossier(app)   [callback que sobe]
     └─ DossierDialog  (IRMÃO do DetailDrawer — nunca dentro dele)
          └─ DossierPanel (seções)
               └─ lib/dossier-client.ts  (orquestração)

lib/dossier-schema.ts    Zod: DossierSchema, DossierMatchSchema
lib/dossier.ts           normalização (evidência, dedupe, url, data, coverage)  [espelha lib/tailor.ts]
lib/dossier-client.ts    runDossierJob(), runDossierMatch()                      [espelha lib/tailor-client.ts]
lib/research/providers.ts  tipos, registry, probe de capacidade
lib/research/tavily.ts     busca (CORS ok)
lib/research/brave.ts      busca (CORS NÃO ok → off por padrão)
lib/research/jina.ts       leitura de página (CORS ok, sem chave)
lib/research/direct.ts     BrasilAPI CNPJ, GitHub, YouTube, Wikipedia
lib/research/queries.ts    plano de queries por seção
lib/research/collect.ts    descoberta → leitura → corpus
lib/llm/prompts.ts      + buildDossierSystem/User, buildMatchSystem/User
lib/llm/gemini.ts      + chatJsonGeminiLong() (timeout maior, sem JSON mode)
lib/store.ts            + pmcv:dossiers, pmcv:readcache, campos em StoredApp e Settings
app/components/DossierDialog.tsx   UI principal
app/components/DossierPanel.tsx    sub-componentes por seção
app/components/ui/dialog.tsx      + prop `size` ("md" | "wide")
```

**Continuam valendo as regras do `web/AGENTS.md`:** sem Server Actions, sem Route Handlers, sem `/api/**`, sem servidor, sem segredo em código cliente, `output: "export"` intacto, toda string visível nos 3 arquivos de `messages/`, erros de lib via `tErr`.

**Nenhum arquivo novo compartilha código com `mobile/` ou `cli/`.**

## 4. Modelo de dados

### 4.1 `lib/dossier-schema.ts`

```ts
export const SourceRefSchema = z.object({
  url: z.string().min(1),
  title: z.string().default(""),
  publishedAt: z.string().nullable().default(null),   // "YYYY-MM" | "YYYY-MM-DD" | null
  retrievedAt: z.string(),
  provider: z.enum(["tavily", "brave", "jina", "direct", "user"]),
});

export const EvidenceSchema = z.object({
  claim: z.string().min(1),
  sourceUrl: z.string().nullable().default(null),     // null = sem fonte verificável
  sourceTitle: z.string().default(""),
  date: z.string().nullable().default(null),
  quote: z.string().default(""),
  origin: z.enum(["web", "user"]).default("web"),     // "user" = material colado pelo usuário
  unsourced: z.boolean().default(false),              // true = o modelo inventou a URL; foi removida
});

export const RedFlagSchema = z.object({
  severity: z.enum(["high", "medium", "low"]),        // literais em inglês no código; rótulo via i18n
  category: z.enum(["processo_trabalhista", "cultura", "financeiro", "produto", "reputacao", "outro"]),
  title: z.string().min(1),
  detail: z.string().default(""),
  date: z.string().nullable().default(null),
  evidence: z.array(EvidenceSchema).default([]),
  mitigation: z.string().nullable().default(null),
});

export const ReviewSchema = z.object({
  source: z.enum(["glassdoor", "linkedin", "jusbrasil", "reclameaqui", "indeed", "reddit", "other"]),
  sentiment: z.enum(["pro", "contra", "neutro"]),
  topic: z.string().default(""),        // sobre o que o processo/reclamação tratava
  date: z.string().nullable().default(null),
  quote: z.string().default(""),
  sourceUrl: z.string().nullable().default(null),
});

export const ContactSchema = z.object({
  name: z.string().min(1),
  role: z.string().default(""),
  kind: z.enum(["rh", "gestor", "dpo", "recrutador", "executivo", "other"]),
  channel: z.enum(["linkedin", "email", "telefone", "site", "other"]),
  url: z.string().nullable().default(null),
  hint: z.string().default(""),           // por que abordar essa pessoa
  confidence: z.enum(["high", "medium", "low"]).default("medium"),
});

export const SocialPostSchema = z.object({
  date: z.string().nullable().default(null),
  text: z.string().default(""),
  url: z.string().nullable().default(null),
});

export const SocialSchema = z.object({
  network: z.enum(["linkedin", "instagram", "youtube", "x", "facebook", "github", "tiktok", "other"]),
  handle: z.string().nullable().default(null),
  url: z.string().nullable().default(null),
  tone: z.string().default(""),           // tom de comunicação da rede
  posts: z.array(SocialPostSchema).max(5).default([]),
});

export const ProductSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  customerSignal: z.string().default(""),  // como os clientes qualificam o produto
  evidence: z.array(EvidenceSchema).default([]),
});

export const DossierSchema = z.object({
  id: z.string().min(1),                  // "dsr_" + companyKey (determinístico)
  companyKey: z.string().min(1),          // slug normalizado
  company: z.string().min(1),
  cnpj: z.string().nullable().default(null),
  lang: z.enum(["pt-BR", "en", "es"]),
  status: z.enum(["done", "failed"]).default("done"),
  errorLog: z.string().default(""),
  legal: z.object({
    razaoSocial: z.string().nullable().default(null),
    nomeFantasia: z.string().nullable().default(null),
    openedAt: z.string().nullable().default(null),
    cnae: z.string().nullable().default(null),
    porte: z.string().nullable().default(null),
    capitalSocial: z.string().nullable().default(null),
    partners: z.array(z.object({
      name: z.string(),
      role: z.string().default(""),
      since: z.string().nullable().default(null),
    })).max(20).default([]),
  }).default({}),
  history: z.object({
    founded: z.string().nullable().default(null),
    timeline: z.array(z.object({ year: z.string(), event: z.string() })).max(10).default([]),
    mission: z.string().nullable().default(null),
    vision: z.string().nullable().default(null),
    values: z.array(z.string()).max(10).default([]),
    summary: z.string().default(""),
  }).default({}),
  leadership: z.object({
    ceo: z.object({
      name: z.string(),
      role: z.string().default(""),
      bio: z.string().default(""),
      highlights: z.array(EvidenceSchema).max(10).default([]),
    }).nullable().default(null),
  }).default({}),
  products: z.array(ProductSchema).max(3).default([]),
  reputation: z.object({
    reviews: z.array(ReviewSchema).max(20).default([]),
    redFlags: z.array(RedFlagSchema).max(12).default([]),
  }).default({}),
  contacts: z.array(ContactSchema).max(8).default([]),
  socials: z.array(SocialSchema).max(8).default([]),
  coverage: z.array(z.object({
    section: z.enum(["historia", "lideranca", "produtos", "reputacao", "contatos", "redes", "cnpj"]),
    status: z.enum(["ok", "parcial", "ausente"]),
  })).default([]),
  sources: z.array(SourceRefSchema).max(40).default([]),   // escrito pelo código (D13)
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const DossierMatchSchema = z.object({
  dossierId: z.string().min(1),
  appId: z.string().min(1),
  lang: z.enum(["pt-BR", "en", "es"]),
  alignment: z.object({
    score: z.number().int().min(0).max(100),
    verdict: z.enum(["vai", "cautela", "desistir"]),
    dimensions: z.array(z.object({
      key: z.enum(["cultura", "produto", "processo", "gestao", "setor", "cargo"]),
      score: z.number().int().min(0).max(100),
      note: z.string().default(""),
    })).max(6).default([]),
  }),
  attentionPoints: z.array(z.string()).max(10).default([]),
  correlations: z.array(z.object({
    theme: z.string(),
    theirs: z.string(),
    mine: z.string(),
  })).max(10).default([]),
  gaps: z.array(z.string()).max(10).default([]),
  questions: z.array(z.object({
    question: z.string(),
    why: z.string().default(""),
    sourceUrl: z.string().nullable().default(null),
  })).max(8).default([]),
  outreach: z.array(z.object({
    target: z.string(),
    role: z.string().default(""),
    goal: z.enum(["rh", "gestor", "indicacao", "cargo"]),
    channel: z.enum(["linkedin", "email", "telefone", "site", "other"]),
    angle: z.string().default(""),
    message: z.string().default(""),
    sourceUrl: z.string().nullable().default(null),
  })).max(5).default([]),
  redFlagSummary: z.array(z.string()).max(10).default([]),
  sources: z.array(z.string()).max(40).default([]),
  stale: z.boolean().default(false),       // true quando o dossiê foi atualizado depois
  createdAt: z.string(),
  updatedAt: z.string(),
});
```

**Invariante de evidência (verificada em código, §4.1 → `lib/dossier.ts`):**

1. O **corpus** é o conjunto de **documentos efetivamente lidos** (Jina/direct/material colado). URLs apenas *descobertas* na busca e não lidas **não podem ser citadas** — caso contrário a IA poderia inventar uma afirmação e pendurar um link plausível, e o invariante passaria.
2. Toda `sourceUrl` que não esteja no corpus é **removida** e a evidência passa a `sourceUrl: null, unsourced: true`.
3. **Red flags, reviews e contatos que ficaram sem nenhuma evidência válida são descartados** — não sobrevivem como afirmação sem fonte. A UI nunca mostra um contato inventado.
4. Contato só sobrevive se o **nome aparecer normalizado no texto lido** (o nome é a própria evidência); `url` continua opcional (`confidence: "low"` quando não há link).
5. Material colado pelo usuário (`origin: "user"`) entra no corpus como uma fonte sintética `{ url: "pmcv:material:<n>", provider: "user", title: "Material colado" }` e pode ser citado — mas **sem link clicável** na UI.

**`coverage` — computado pelo código (D13), nunca pelo modelo.** Regra determinística por seção:
- `ausente` — a seção não tem nenhum item (0 reviews / 0 red flags / 0 contatos / 0 produtos / nenhum campo de `history` preenchido / `legal` vazio).
- `parcial` — a seção tem itens mas falta algum campo esperado (ex.: `history.mission == null`; `contacts` < 5; `redFlags` sem `evidence` sobrevivente; `socials` sem posts).
- `ok` — todos os campos esperados preenchidos.
O banner "N seções sem evidência" conta `ausente` + `parcial`.

**Limites de array** (tambémajnda o orçamento de ~40 KB por dossiê): `reviews ≤ 20`, `redFlags ≤ 12`, `timeline ≤ 10`, `values ≤ 10`, `highlights ≤ 10`, `contacts ≤ 8`, `socials ≤ 8`, `posts ≤ 5`, `products ≤ 3`, `dimensions ≤ 6`, `questions ≤ 8`, `outreach ≤ 5`, `sources ≤ 40`.

### 4.2 Store

```ts
// lib/store.ts — novos
export function loadDossiers(): StoredDossier[]              // "pmcv:dossiers"
export function saveDossiers(d: StoredDossier[]): void
export function upsertDossier(d: StoredDossier): void          // chaveia por companyKey
export function findDossierByCompany(key: string): StoredDossier | null
export function deleteDossier(id: string): void                // zera dossierId das apps; match é preservado
export function loadReadCache(): ReadCacheEntry[]              // "pmcv:readcache"
export function saveReadCache(c: ReadCacheEntry[]): void
```

```ts
// StoredAppSchema — extensão retrocompatível (tudo com .default())
dossierId: z.string().nullable().default(null),
dossierMatch: DossierMatchSchema.nullable().default(null),
```

```ts
// SettingsSchema — extensão (D14: saveSettings MESCLA, não substitui)
research: z.object({
  tavilyKey: z.string().default(""),
  braveKey: z.string().default(""),
  jinaKey: z.string().default(""),
  youtubeKey: z.string().default(""),
  githubToken: z.string().default(""),
}).default(() => ({ tavilyKey: "", braveKey: "", jinaKey: "", youtubeKey: "", githubToken: "" })),
// (sem useGrounding — grounding fora da v1, D3)
```

**Chaves de storage:**
- `pmcv:dossiers` — dossiês (1 por empresa).
- `pmcv:readcache` — cache de leituras (`url → { content, publishedAt, fetchedAt }`), TTL 7 dias, **teto de 150 KB no total** (evita estourar o `localStorage`); **não entra no backup** (conteúdo de terceiros).

**Backup:** `exportBackup()` inclui `dossiers`; `importBackup()` valida e restaura — **`dossiers` ausente no backup = dossiês locais preservados** (D15). As chaves de pesquisa não entram no backup (o backup atual já não exporta settings). `wipeAll()` remove `pmcv:dossiers` e `pmcv:readcache`.

**Multi-aba:** o evento `storage` já sincroniza `pmcv:*` entre abas; `pmcv:dossiers` entra no mesmo mecanismo (`page.tsx` e `DashboardTabs` escutam a chave).

## 5. Pipeline de pesquisa

### F0 — Identidade da empresa
Entrada: o campo editável do diálogo (D10) — nome da empresa + CNPJ opcional.
`companyKey = slug(nome normalizado)`. Se o CNPJ foi digitado, usa direto; senão, 1 busca Tavily `"<empresa>" cnpj` → extrai dígitos → `GET https://brasilapi.com.br/api/cnpj/v1/{cnpj}`.
**Validação de homônimo (D11):** o `razao_social` precisa compartilhar ≥1 token significativo com o nome pesquisado; senão o dado é descartado e `coverage.cnpj = "ausente"`.
Quando válido: `legal` é preenchido pelo código **verbatim** e a URL do BrasilAPI entra em `sources[]`.

### F1 — Descoberta (Tavily)
Endpoint: `POST https://api.tavily.com/search`, header `Authorization: Bearer <tavilyKey>`, body `{ query, max_results: 8, search_depth: "basic", include_raw_content: false, include_published_date: true, topic: "general" }`.
Custo: **1 crédito por busca**. Teto: **22 créditos de busca** por dossiê.

Plano de queries (`lib/research/queries.ts`), com o nome entre aspas para reduzir ruído:

| Bloco | Queries |
|---|---|
| base | `"<empresa>" site oficial contato` · `"<empresa>" sobre nós história fundada` |
| história | `"<empresa>" missão visão valores` · `"<empresa>" "fundada em" história` |
| liderança | `"<empresa>" CEO fundador presidente proprietário` · `"<empresa>" "diretor" OR "CEO" entrevista` |
| produtos | `"<empresa>" produtos serviços clientes` · `"<empresa>" reclamação OR avaliação cliente` |
| reputação | `"<empresa>" glassdoor avaliações` · `"<empresa>" jusbrasil processo` · `"<empresa>" reclamação funcionário` · `"<empresa>" "corte de pessoal" OR demissão` |
| contatos | `site:linkedin.com/in "<empresa>"` · `"<empresa>" recruiter OR "talent acquisition"` · `"<empresa>" "head of" OR "gerente" OR "coordenador"` · `"<empresa>" rh OR "recursos humanos" contato` |
| redes | `"<empresa>" instagram` · `"<empresa>" youtube` · `"<empresa>" github` · `"<empresa>" twitter OR x.com` |

Deduplicação por URL canônica (sem `utm_*`, sem fragmento, host em minúsculas, `m.`/`www.` normalizados). Prioridade: site oficial e perfis oficiais > agregadores de review > mídia > blogs.
**Orçamento de leituras por seção (D):** máximo 4 URLs por bloco (`reputacao`, `contatos`, `redes`, `produtos`) e no máximo 4 para o resto (site oficial, história, liderança) ⇒ **≤ 15 leituras**.
**Fallback de leitura:** Tavily `search` com `include_raw_content: true` (2 créditos) nas URLs mais relevantes quando o Jina falhar — teto de **6 créditos extras** (total máximo ≈ 28 créditos ≈ 1 dossiê por 35 dos 1.000 créditos mensais).
**Idiomas:** dossiê `en`/`es` roda as queries em PT **mais** até 6 queries no idioma do dossiê (cap total de 22 mantido).

### F2 — Leitura (Jina Reader)
`GET https://r.jina.ai/<url>` (sem chave; com `Authorization: Bearer <jinaKey>` opcional para aumentar o limite). Resposta em texto com metadados no topo:
```
Title: …
URL Source: …
Published Time: …
```
Extrair `Title`, `URL Source` e `Published Time` (**a data da evidência — D12**).

**Detecção de página bloqueada (D):** o Jina pode responder **HTTP 200 com corpo de erro** (`Warning: …`, `Error: …`) em vez de 403. Regra: corpo que começa com `Warning:`/`Error:` **ou** tenha menos de 200 caracteres úteis ⇒ **leitura falha**, a URL é descartada e a seção fica parcial. Nunca tentar contornar (sem login, sem CAPTCHA, sem proxy).

**Rate limit:** `x-ratelimit-limit: 20,20;w=60` ⇒ serializar com 1 leitura a cada ~3,5 s (15 leituras ≈ 55 s) e respeitar `Retry-After` em 429. Latência média do reader ≈ 8 s/leitura sem chave ⇒ o dossiê leva 2–5 min de verdade (o aviso na UI deve dizer isso).

### F3 — Dados estruturados (fetch direto, sem CORS)
- **BrasilAPI CNPJ** — confirmado `ACAO: *`; escreve `legal` verbatim.
- **GitHub** `GET https://api.github.com/orgs/{org}/events/public` → últimos eventos. **Mapeamento para post (D):** só `PushEvent` (mensagem do commit + URL do commit) e `ReleaseEvent` (nome da release + URL) viram post; os demais tipos de evento são ignorados. `Accept: application/vnd.github+json`. Sem token: 60 req/h; com `githubToken`: 5.000/h.
- **YouTube** `GET https://www.googleapis.com/youtube/v3/search?part=snippet&channelId={id}&order=date&maxResults=5&key={youtubeKey}` → posts mais recentes. Exige `channelId` (1 busca extra) e chave (opcional). CORS confirmado.
- **Wikipedia/Wikidata** — resumo do setor/da empresa, quando existir.

### F4 — Síntese (Gemini)
**2 chamadas**, não 7 — menos tokens, menos latência, menos chance de alucinação:
- **Chamada A** → `history`, `leadership`, `products`.
- **Chamada B** → `reputation`, `contacts`, `socials`.

> `legal`, `coverage` e `sources` **não** saem do modelo (D11, D13).

**Timeout e fallback (D):** as chamadas do dossiê usam um caminho **próprio** (`chatJsonGeminiLong`), com **120 s** de timeout (o corpus é maior) e **no máximo 2 models** tentados — a chain atual (`lib/llm/chain.ts`) tenta 5 models × 60 s = 5 minutos de espera e devolve uma string de erros concatenada, que contradiz o "nunca stack crua" do §8. O erro final é mapeado para **uma** chave `tErr` (`dossierFailed`), com o detalhe técnico em `errorLog` (visível em "detalhes"), não no toast.

**Corpus de entrada por chamada:** no máximo ~40 k tokens (trechos de ~1200 caracteres por documento, até 15 documentos, cada um com `title | url | publishedAt` no cabeçalho). Se estourar, corta **os trechos** mais longos primeiro (nunca os URLs, nunca a ordem).

Regras do prompt (`buildDossierSystem`):
1. Use **somente** o corpus. Toda afirmação factual precisa de `sourceUrl` **existente no corpus**.
2. A data do documento é a `date` da evidência; se não houver, `null` — **nunca invente data**.
3. Não preencha com conhecimento geral do modelo: se não há evidência, o campo fica vazio/null e o código marca a cobertura.
4. Separe fato da empresa de reclamação de cliente: `products[].customerSignal` e `reputation.*` carregam a reclamação; `history`/`leadership` carregam o fato.
5. `redFlags` só com evidência; `severity` reflete impacto na decisão (processo trabalhista recorrente/cultural = `high`; caso isolado = `low`).
6. `contacts`: no máximo 8, `kind` correto (`rh`/`gestor`/`dpo`/`recrutador`/`executivo`/`other`), `url` quando houver, `hint` explicando por que abordar aquela pessoa, `confidence` refletindo quão forte é a evidência.
7. `socials`: uma entrada por rede encontrada; `posts` com no máximo 5 e **a data real de cada post**; `tone` descrevendo a voz da empresa naquela rede (1–2 frases).
8. Escreva todo o texto livre no `lang` do dossiê.
9. **Literais exatos**: o prompt lista os valores permitidos de cada enum (`severity`, `kind`, `sentiment`, `network`, `channel`, `verdict`, `goal`, `source`) — sem isso, toda chamada cai no caminho de repair do Zod.

**Reparo:** mesmo padrão de `lib/tailor-client.ts` — se o Zod falhar, 1 chamada de `buildRepairUser` com os erros do Zod.

### F5 — Análise com a vaga (Gemini, 3ª chamada)
Entrada: o dossiê (em JSON) + `app.jobText` + `app.resume` (o currículo **tailored** daquela vaga) + `app.cargo`. Saída: `DossierMatchSchema` — **sempre no idioma da candidatura** (D5).
Regras do prompt (`buildMatchSystem`):
1. `alignment.score` é honesto e ancorado nas dimensões avaliadas — não é porcentagem de palavras em comum.
2. `dimensions`: avaliar `cultura`, `produto`, `processo`, `gestao`, `setor`, `cargo` (0–100) com uma frase de justificativa por dimensão.
3. `attentionPoints`: o que pode te machucar na entrevista (red flag + o que perguntar sobre isso).
4. `correlations`: pontos onde o que a empresa valoriza aparece no **seu currículo tailored** (`theirs` × `mine`), citando skills/experiências reais do resume — **nada que não esteja no resume**.
5. `gaps`: o que a vaga pede e seu currículo não mostra.
6. `questions`: 5–8 perguntas, cada uma com `why` (por que perguntar) e `sourceUrl` quando derivar de uma evidência concreta do dossiê.
7. `outreach`: 3–5 ações de contorno do ATS. Cada uma com alvo, `goal` (`rh`/`gestor`/`indicacao`/`cargo`), canal, `angle` (o gancho, ancorado no dossiê) e `message` **pronta para copiar**, no tom do canal escolhido (LinkedIn ≠ e-mail). A `message` não inventa fatos sobre o currículo além do que está no `resume`.
8. `redFlagSummary`: as red flags para as quais você deve preparar objeção.

**Reuso:** se o dossiê da empresa já existe, a F5 roda sem F0–F4 — só a análise muda.
**Refresh:** "Atualizar pesquisa" substitui o dossiê e marca `stale: true` em **todos** os `dossierMatch` das candidaturas daquela empresa (badge "análise desatualizada" na `DetailDrawer` + ação "Recalcular análise").

## 6. Fluxo de UI

### 6.1 Entrada
`DetailDrawer` (que já mostra currículo, afinidade, pontos fortes/fracos, email e mensagem) ganha um botão **"Montar dossiê"** (ícone `LuBuilding2`), visível só quando `app.status === "done"`. Ao lado dos botões de download/imprimir. A `DetailDrawer` passa a mostrar um resumo do match quando ele existe (veredito + score + nº de red flags + link "Abrir dossiê").

### 6.2 Montagem do diálogo (D — scroll-lock)
`ui/dialog.tsx` faz `document.body.style.overflow = "hidden"` no `useEffect` e restaura para `""` no cleanup; dois diálogos aninhados (ambos `z-50`) ⇒ fechar o interno **destrava** o externo. Portanto o `DossierDialog` **não** é montado dentro do `DetailDrawer`: o botão dispara `onOpenDossier(app)`, que sobe até `DashboardTabs`, que monta o `DossierDialog` como **irmão** do `DetailDrawer`.
Além disso, `ui/dialog.tsx` ganha a prop `size` (`"md"` = `max-w-2xl` atual, `"wide"` = `max-w-5xl`) — 9 abas de dossiê não cabem em `max-w-2xl`. A prop é retrocompatitiva (default = `md`).

### 6.3 `DossierDialog` — máquina de estados

**S0 — identidade e fonte.** Formulário com: **nome da empresa** (editável, pré-preenchido com `app.empresa`; vazio e obrigatório se for o placeholder `MISSING_JOB.empresa` — "Empresa"/"Company"), **CNPJ opcional**, e escolha da fonte:
- **Pesquisa automática** (recomendada; exige chave Tavily) — 1 clique. Mostra o custo estimado ("~22 créditos do seu plano gratuito").
- **Colar URLs** (grátis, sem chave nenhuma) — textarea, uma URL por linha; o app lê com Jina e estrutura.
- **Colar material** — textarea com texto/prints transcritos; a IA estrutura sem leitura de URL (`origin: "user"`).

**S1 — pesquisa em andamento.** Estágios **reais**, não timer: `runDossierJob()` recebe `{ onStage }` e o diálogo avança por chamada de verdade ("Descobrindo fontes…", "Lendo páginas…", "Consultando dados oficiais…", "Estruturando o dossiê…", "Cruzando com seu currículo…"). O `use-staged-steps.ts` atual (timer puro) fica **intacto** para o fluxo de currículo; o dossiê usa um componente de progresso novo, alimentado pelo callback. Aviso "(pode levar 2–5 min)".
Há **botão de cancelar** (o `AbortController` propaga para as chamadas em voo; o dossiê parcial não é salvo).

**S2 — dossiê pronto.** `DossierPanel` com as abas (§6.4). Ações no rodapé: **"Analisar esta vaga"** (F5 — ação explícita e separada, é o que produz o plano de abordagem), "Atualizar pesquisa", "Exportar Markdown".
**S3 — análise pronta.** Abre na aba "Plano de abordagem". A `DetailDrawer` passa a exibir o resumo do match.

### 6.4 `DossierPanel` — o dossiê
Navegação por abas (reaproveitando `ui/tabs.tsx`):

| Seção | Conteúdo |
|---|---|
| **Panorama** | veredito (`vai`/`cautela`/`desistir`), score de alinhamento, barras por dimensão, banner de cobertura ("N seções sem evidência"), resumo em 3 linhas |
| **Empresa** | história, linha do tempo, missão, visão, valores, dados legais/CNPJ (razão social, fantasy, abertura, CNAE, porte, capital, sócios) |
| **Liderança** | CEO/dono, cargo, bio, highlights — cada highlight com link e data |
| **Produtos** | até 3, com "como os clientes qualificam" e evidências |
| **Reputação** | red flags por severidade (evidência, data, link e "como lidar") + timeline de relatos pró/contra filtráveis por fonte e sentimento |
| **Contatos** | até 8 cartões: nome, cargo, tipo (RH/gestor/DPO/recrutador), canal, link, "por que abordar", nível de confiança. Se houver menos de 5 com evidência, banner "cobertura parcial" — **nunca completar com nomes inventados** |
| **Redes sociais** | por rede: tom + até 5 posts com data e link |
| **Plano de abordagem** | as ações de contorno do ATS: alvo, canal, ângulo, **mensagem pronta com botão Copiar** |
| **Perguntas** | as perguntas de entrevista com "por que perguntar" e link da evidência |
| **Fontes** | tudo que foi lido, com URL, data e provedor |

Toda afirmação com fonte é um link clicável (`target="_blank" rel="noopener"`). Evidência sem fonte é marcada **"sem fonte verificável"** (nunca clicável). Todo bloco textual tem botão "Copiar".

## 7. Configurações

`SettingsDialog` ganha uma seção **"Pesquisa"**:

| Campo | Obrigatório | Observação |
|---|---|---|
| Chave Tavily | recomendado | link para o cadastro; botão "Validar" (1 crédito) |
| Chave Brave | não | desligado por padrão; aviso de que o CORS não está liberado (D1) |
| Chave Jina | não | só aumenta o rate limit (20/min → mais) |
| Chave YouTube | não | habilita posts de YouTube |
| Token GitHub | não | aumenta o rate limit (60/h → 5.000/h) |

Indicador de status por provedor: "pronto" / "sem chave" / "bloqueado (CORS)" / "erro 401".
**`saveSettings` mescla** (D14): salvar a chave Gemini **não** apaga as chaves de pesquisa.

**Onboarding:** a chave Gemini continua sendo o único passo obrigatório. O onboarding **não** passa a exigir chave Tavily. A seção "Pesquisa" aparece quando o usuário abre Configurações ou clica em "Montar dossiê" sem chave (lá o app explica e leva às Configurações).

## 8. Erros, limites e privacidade

| Situação | Comportamento |
|---|---|
| Sem chave Tavily e sem URLs coladas | O modal explica: ative a chave Tavily (recomendado) ou cole as URLs (grátis). Nada é salvo. |
| Tavily 401/422 | "Chave Tavily inválida" + link para Configurações |
| Tavily 429 | 1 retry com backoff; se persistir, continua com o corpus parcial e marca `coverage` |
| Jina 429 | respeita `x-ratelimit-*` / `Retry-After`, serializa, 1 retry |
| Jina 200 com corpo de erro / < 200 chars | **leitura falha** (D) — URL descartada, seção parcial. Sem contorno de CAPTCHA/login/proxy. |
| Gemini 429 / erro | até 2 models (D); erro final mapeado para **uma** chave `tErr`, detalhe técnico só em `errorLog` |
| Zod inválido na síntese | 1 chamada de repair; se falhar → dossiê persistido com `status: "failed"`, `errorLog` e `sources[]` preenchidos; **retry re-lê as URLs já lidas** (sem refazer buscas) |
| `QuotaExceededError` no localStorage | Toast com o texto de quota já existente + "Exportar backup e limpar" |
| Offline | Avisa e não inicia (mesmo padrão do `GenerateModal`) |
| Fonte bloqueada/inexistente | Ignorada; o dossiê sai parcial com banner de cobertura |
| Usuário cancela | Nada é salvo; o `AbortController` cancela as chamadas em voo |

**Limites (impostos em código):** ≤ 22 créditos de busca + ≤ 6 de fallback, ≤ 15 leituras, ≤ 15 URLs no corpus por chamada, ≤ 40 k tokens de corpus por chamada, ≤ 150 KB de `pmcv:readcache`, sem login, sem proxy, sem scraping massivo.

**Privacidade (mudanças reais, não cosméticas):**
- Novos terceiros chamados **do browser do usuário**: Tavily (busca), Jina (leitura de página), BrasilAPI, YouTube Data API, GitHub. Atualizar `app/privacidade/page.tsx` (seção "Serviços de terceiros"), `Terms` (uso aceitável) e o texto do `CookieBanner` — hoje citam só Google Fonts + Gemini.
- O dossiê contém **dados de terceiros** (nomes e cargos de pessoas). O app não os publica, não os compartilha, não os indexa; ficam no `localStorage` do usuário e vão ao Gemini apenas para síntese. Declarar isso na política.
- As URLs visitadas passam pelo Jina. Só endereços públicos são lidos; nada de conteúdo privado ou autenticado.
- **Consentimento (decidido com o parceiro):** não há passo de consentimento separado; o banner/cookie existente + a política de privacidade atualizados cobrem os novos terceiros, e o `DossierDialog` mostra uma linha de aviso na primeira vez ("URLs públicas da empresa serão enviadas ao Tavily/Jina e trechos ao Gemini").

## 9. i18n

Novo namespace `Dossier` em `messages/{pt-BR,en-US,es-ES}.json` (a paridade de chaves é testada — o teste falha se faltar em qualquer locale). Novo namespace `Research` para Configurações. Novas chaves em `Errors` para os erros de lib (`noResearchKey`, `researchInvalidKey`, `researchRateLimit`, `dossierFailed`, `noUrls`, `placeholderCompany`).

**Enums:** os valores gravados no código são literais em **inglês** (`high`/`medium`/`low`, `rh`/`gestor`/`dpo`/`recrutador`/`executivo`, `vai`/`cautela`/`desistir`, `web`/`user`, `pro`/`contra`/`neutro`) — coerente com o resto do projeto (`status: "done" | "failed"`). A UI **não** mostra o literal: cada valor tem uma entrada em `Dossier.enums.*` (~28 chaves × 3 locales) traduzida, e `lib/dossier.ts` normaliza o que o modelo devolveu (`"high"`/`"alta"`/`"alto"` → `high`) para não cair no repair por causa de literal.

Erros de lib passam por `tErr(locale, key)` com `locale` explícito — nunca o hook do provider (regra do `web/AGENTS.md`).

## 10. Testes

Vitest, com `fetch` mockado. Novos arquivos:

- `tests/dossier-schema.test.ts` — Zod: dossiê mínimo válido; `score` fora de 0–100 rejeitado; `products ≤ 3`; `posts ≤ 5`; `contacts ≤ 8`; `sources ≤ 40`; `DossierSchema` sem `status` continua válida (default).
- `tests/dossier-normalize.test.ts` — **invariante de evidência**: URL fora do corpus é removida → `unsourced: true`; red flag / review / contato sem evidência sobrevivente é descartado; contato sobrevive só se o nome aparece no texto lido; dedupe de URL canônica; normalização de data (`2026-10` / `2026-10-05` / inválida → `null`); `coverage` computado (seção vazia → `ausente`; campo faltando → `parcial`).
- `tests/research-providers.test.ts` — Tavily: URL, método, header `Authorization`, body (`max_results`, `search_depth`, `include_published_date`); Jina: extrai `Title`/`Published Time`, trata 429 e **200 com corpo de erro** como falha; Brave: desligado por padrão; direct: BrasilAPI monta a URL do CNPJ.
- `tests/research-collect.test.ts` — teto de 22 créditos de busca e 15 leituras; cota por seção; dedupe; degradação (leitor falha → snippet do Tavily; busca falha → segue com o que tem); bloqueio do `onStage` na ordem certa.
- `tests/dossier-client.test.ts` — `runDossierJob` cria e persiste em `pmcv:dossiers`; **reaproveita** o dossiê existente da empresa sem refazer pesquisa; `runDossierMatch` usa `app.jobText` + `app.resume` (o tailored) e grava em `app.dossierMatch`; falha ⇒ `status: "failed"` com `sources[]` preservadas; `onStage` é chamado.
- `tests/dossier-prompts.test.ts` — o prompt exige `sourceUrl` do corpus, proíbe data inventada, lista os literais exatos dos enums e pede o idioma do dossiê.
- `tests/store-dossiers.test.ts` — round-trip; item inválido descartado pelo Zod; `exportBackup`/`importBackup` incluem dossiês; **backup antigo sem `dossiers` preserva os dossiês locais**; `wipeAll` limpa `pmcv:dossiers` e `pmcv:readcache`; `StoredApp` antigo (sem `dossierId`/`dossierMatch`) continua válido; **`saveSettings` mescla e não apaga `research`**.

Ajustes em testes existentes:
- `tests/store.test.ts:48-51` — `expect(loadSettings()).toEqual({ geminiKey: "K", models: [...] })` **quebra** com a chave `research` → passa a `toMatchObject` + asserção explícita das chaves de pesquisa.
- `tests/ui-contract.test.ts` — `DetailDrawer` contém o botão de dossiê; **nenhum** componente novo usa `/api/` ou `../actions`; nada de string PT hardcoded nos componentes novos; `SettingsDialog` contém os campos de pesquisa; `DossierDialog`/`DossierPanel` existem; o `DossierDialog` **não** é montado dentro do `DetailDrawer` (checa por import/uso aninhado).
- `tests/i18n.test.ts` — a paridade de chaves já cobre `Dossier` e `Research` nos 3 locales.
- O check `not.toContain("/api/")` deve varrer **só `app/components/**`** — `lib/research/direct.ts` contém legitimamente `https://brasilapi.com.br/api/cnpj/v1/…`.

Manual: `npm test -- --run`, `npx tsc --noEmit`, `npm run build` (export estático), fluxo completo com e sem chave Tavily, backup/restore, multi-aba, cancelamento do dossiê no meio.

## 11. Fora do escopo (v1) e backlog

**Fora da v1:**
- PDF do dossiê (decidido: fora da v1 — tela + exportar Markdown).
- Aba "Dossiês" no dashboard (lista por empresa).
- Google Search grounding (D3) — exige caminho de chamada sem JSON mode **e** regra de citação que aceite URLs fora do corpus.
- Tavily como leitor primário (`include_raw_content`) — só entra como fallback do Jina.
- Brave como provedor (depende de CORS).
- `s.jina.ai` como SERP alternativo (exige chave).
- Google Maps grounding, login em qualquer site, proxy/scraping pago, Playwright.
- Persistir em IndexedDB (D4).
- Multiusuário / contas / sincronização entre dispositivos.
- Envio automático das mensagens de abordagem (o app só **prepara** e copia; o envio é manual, por decisão de não ser uma ferramenta de spam).

**Backlog com valor:**
- `cli/` tem `fetch` sem CORS ⇒ pode ler Reclame Aqui/Jusbrasil direto (ainda sujeito a 403 anti-bot) — reimplementar o contrato, nunca importar.
- `mobile/` (React Native) também não sofre CORS ⇒ pipeline mais direto; chaves em `expo-secure-store`, dossiê em AsyncStorage.
- Cache de dossiê entreaginator.

## 12. Riscos

| Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|
| Tavily mudar cota/preço | média | médio | BYOK + fallback "colar URLs" (D8) + `coverage` explícito |
| Jina mudar free tier / rate limit | média | médio | serializar respeitando o header; cache `pmcv:readcache` (TTL 7 dias, teto 150 KB); fallback Tavily `raw_content` |
| Glassdoor/Jusbrasil/LinkedIn bloquearem o leitor | **alta** | alto | detecção de página bloqueada (§F2) + `coverage` por seção + aviso visível; sem contorno de CAPTCHA |
| IA inventar fonte/data | média | **alto** | invariante de evidência verificada em código (§4.1) + prompt restritivo + repair por Zod + descarte de item sem evidência |
| Cota do localStorage | média | médio | 1 dossiê por empresa; teto do `pmcv:readcache`; exclusão manual; tratamento de `QuotaExceededError` existente |
| Conteúdo de terceiros (contatos) no browser | baixa | médio | declarado na política de privacidade; nada sai do dispositivo além do envio ao Gemini |
| Vazamento das chaves no bundle | baixa | alto | chaves em `secure-ls` (mesmo aviso de "não é cofre" no README); nunca hardcoded |
| Service worker cacheando resposta da Jina | baixa | baixo | `app/sw.ts` marca apenas a API Gemini como `NetworkOnly`; hosts novos caem no `defaultCache` — verificar o matcher de imagens (extensão) para não cachear `.png/.jpg` vindo do Jina |

## 13. O que o builder ainda precisa decidir

Itens deixados explicitamente em aberto (qualquer um, desde que siga o resto do spec):

1. **Formato exato do corpus enviado ao Gemini** — como serializar `title | url | date | trecho` para caber no orçamento de tokens (recomendado: blocos `---` por documento, ordem por relevância, corte por trecho e não por documento).
2. **Palavras-chave das queries** — a lista em §5 é a base; ajuste fino por resultado da primeira execução real (ex.: acrescentar `site:linkedin.com/company` e `site:glassdoor.com.br`).
3. **Onde fica a normalização de URL canônica** — `lib/research/providers.ts` é o lugar natural, mas `lib/dossier.ts` também serve; escolher um só (recomendado: `providers.ts`, para que toda busca já devolva URL canônica).
4. **Granularidade do `pmcv:readcache`** — TTL 7 dias, teto 150 KB; confirmar que não entra no backup.
5. **Copy do texto exato** dos novos namespaces `Dossier` e `Research` nos 3 idiomas, e do mapa `Dossier.enums.*`.
6. **Estrutura do Markdown exportado** — ordem das seções, formato das fontes, se as tabelas de rating entram.

## 14. Referências verificadas

- Next.js static export desabilita Server Actions/Route Handlers (`output: "export"`) — `docs/01-app/02-guides/static-exports`.
- Gemini API pricing: `Grounding with Google Search` = "Not available" no Free Tier; paid = 5.000 buscas/mês grátis + $14/1.000 (nota: cada query individual é cobrada). `gemini-3.8-flash` input/output "Free of charge".
- Gemini API: tools não podem ser combinados com `responseMimeType: "application/json"` (400 INVALID_ARGUMENT) — motivo do grounding sair da v1.
- Tavily: 1.000 créditos/mês grátis sem cartão; $0,008/crédito no pay-as-you-go; `POST https://api.tavily.com/search` com `Authorization: Bearer`; `published_date` = "published or last updated".
- Jina Reader: `https://r.jina.ai/<url>`, CORS liberado, sem chave, `x-ratelimit-limit: 20,20;w=60`; devolve `Title`/`URL Source`/`Published Time`.
- Brave Search API: até $20/mês em créditos grátis; **sem headers CORS** (verificado) ⇒ inutilizável no browser.
- BrasilAPI `GET /api/cnpj/v1/{cnpj}`: CORS liberado; `qsa` com nome do sócio, `qualificacao_socio` e `data_entrada_sociedade`; `data_inicio_atividade`, `cnae_fiscal`, `capital_social`, `porte`, `situacao_cadastral`.
- Google Custom Search JSON API: 100 queries/dia grátis, mas **indisponível para novos clientes** e descontinuada em 01/01/2027 — fora.
- YouTube Data API: CORS liberado, exige chave; GitHub API: `ACAO: *`, 60 req/h sem token.
- Estado atual do código: `tests/store.test.ts:48-51` faz `toEqual({geminiKey, models})`; `ui/dialog.tsx` trava `body.overflow` e usa `max-w-2xl`; `use-staged-steps.ts` é timer puro; `MISSING_JOB.empresa` = "Empresa"/"Company"/"Empresa".

## 15. Decisões fechadas com o parceiro

| Questão | Decisão |
|---|---|
| PDF do dossiê na v1? | **Não.** Só tela + "Copiar" + exportar Markdown. PDF no backlog. |
| Consentimento explícito antes da pesquisa? | **Não.** Banner/cookie + política atualizados + uma linha de aviso no `DossierDialog`. |
| Bloco de reputação incompleto? | **Aceito.** Os 7 blocos entram na v1; reputação vem parcial quando as fontes bloqueiam, com banner de cobertura explícito. |
