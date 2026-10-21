# Menu de usuário (avatar) + Config. Sistema multi-provedor — Design

Data: 2026-10-21 · Escopo: **apenas `web/`** (o `mobile/` é autocontido e fica para depois).

## 1. Intenção (o quê e por quê)

Depois de cadastrar o currículo base, o app tem hoje um amontoado de botões espalhados
(gear do currículo base, "Configurações" no dashboard, seletor de idioma, ajuda e tema no
topo). O usuário quer **um único ponto de entrada**: um botão com o **avatar** (iniciais do
nome extraído do currículo) que abre um dropdown com as ações do currículo e a
configuração do sistema.

Dentro de "Config. Sistema" entra o **redesign das configurações**, que hoje só conhece
a chave Gemini, para:

- suportar **4 provedores** (Gemini, OpenAI, Anthropic, OpenRouter) com **um ativo por
  vez** e **fallback entre os modelos do provedor ativo**;
- **detectar** quais modelos a chave acessa (endpoint `/models` de cada provedor) e usar
  a ordem de preferência (curada) filtrada pelo que a chave tem;
- **explicar e visualized** o backup (o que é, o que entra, o que não entra);
- manter a **zona de perigo** "Apagar tudo".

Por que agora: o app já é BYOK (chave do usuário no browser). Com 4 provedores, quem
escolhe o provedor passa a ser uma decisão de primeira classe da UI, e ela precisa ser
explícita, validável e sem segredo exposto.

## 2. Objetivos, não-objetivos e anti-objetivos

**Objetivos**

1. Header do dashboard com **um** botão (avatar + saudação + chevron) que abre o
   dropdown com: *Imprimir CV Base*, *Reenviar CV Base*, *Config. Sistema*.
2. "Config. Sistema" = **dialog grande com abas**: Aparência, IA, Backup e dados.
3. **Aparência**: switch de dark mode, seletor de idioma e botão de ajuda.
4. **IA**: 4 provedores, uma chave por provedor, detecção de modelos, ordem de fallback
   visível e editável, um provedor ativo por vez.
5. **Backup e dados**: explicação do que o backup é, preview do conteúdo, exportar,
   importar e a zona de perigo "Apagar tudo".
6. Onboarding coerente: também oferece os 4 provedores.
7. i18n completo (pt-BR / en-US / es-ES) e suíte de testes verde.

**Não-objetivos**

- Paridade no `mobile/` (decisão: web agora, mobile depois).
- Chat com provider na UI, streaming de tokens, tool-calling, visão/multimodal.
- Gateway de proxy, contabilidade de custo, medição de tokens.
- Trocar o tema de "3 estados" (system/light/dark) por algo novo — o switch liga/desliga
  o `next-themes` entre `light` e `dark`.

**Anti-objetivos (o que seria um erro)**

- **Nunca** guardar/enviar a chave para o servidor (não existe servidor) — a chave fica
  no `secure-ls`, ofuscada, como hoje.
- **Nunca** exportar chaves no backup.
- **Nunca** misturar fallback entre provedores: se o provedor ativo é OpenAI, a cadeia
  de fallback é só de modelos OpenAI.
- **Nunca** reintroduzir rotas `/api/` ou Server Actions no app estático.

## 3. Restrições

- `web/` é 100% estático (`output: "export"`): tudo no browser, `localStorage` +
  `secure-ls`.
- Componentes de UI: kit local em `app/components/ui/` (estilo shadcn, **sem Radix** —
  `Dropdown`, `Dialog`, `Card`, `Button`, `Tabs`, `Select` já existem e são usados).
- `next-intl` provider-only; string nova vai nos **3** arquivos de messages (o teste de
  paridade de keysets falha se faltar um).
- Erros de lib passam por `tErr(locale, key)` com tabela estática.
- CORS: as chamadas saem do browser direto para o provedor. Anthropic exige o header
  `anthropic-dangerous-direct-browser-access: true`; OpenRouter e Gemini aceitam CORS
  direto; OpenAI responde com `Access-Control-Allow-Origin: *` para `/v1/models` e
  `/v1/chat/completions`.
- Existe trabalho **não commitado** no repo (feature "chat da vaga" + `job-url`).
  Este trabalho não pode apagar/reescrever esse trabalho: os arquivos tocados
  (`lib/store.ts`, `lib/llm/chain.ts`, `lib/llm/gemini.ts`, `lib/tailor-client.ts`,
  `messages/*.json`, `tests/*`) são **mergeados** com o estado atual, não substituídos.

## 4. Decisões (do brainstorming com o usuário)

| # | Decisão | Escolha |
|---|---|---|
| D1 | Escopo | Só `web/` |
| D2 | "Config. Sistema" | Dialog grande com **abas** |
| D3 | Ordem de fallback | Lista curada por provedor **+ detecção ao vivo** (`/models`) |
| D4 | Conteúdo do backup | Dados + settings **sem chaves** |
| D5 | Header | Idioma, ajuda e tema saem do topo e vão para dentro de Config. Sistema |
| D6 | Iniciais do avatar | **1ª + 2ª palavra** do nome (`"Filipe Batista V"` → `FB`) |
| D7 | Onboarding | Multi-provedor (mesmo seletor das configurações) |
| D8 | Tema | **Switch** liga/desliga (light ↔ dark) |

### 4.1 Decisões técnicas tomadas pelo builder (checagem do revisor)

Estas pontos não foram perguntados ao usuário porque são decisões de engenharia com um
"caminho certo" — ficam registradas aqui para o plano:

| # | Decisão |
|---|---|
| T1 | **Chamada de LLM**: `chain.ts` ganha *wrappers* que leem do store (`generateJsonFromSettings(system, user, locale)` / `generateTextFromSettings(...)`). São o caminho canônico do app; a função de baixo nível (`generateJson(system, user, key, models, locale, provider)`) continua existindo para os testes. Os 4 call sites (`BaseSetup`, `Onboarding`, `tailor-client`, `vacancy-chat`) passam a usar o wrapper — mudança de 1 linha por call site, sem reescrever a feature não commitada |
| T2 | **Ativação de provedor**: o radio da aba "IA" é estado **local** da aba; o provedor só vira o ativo no **Salvar**, e **só é permitido salvar com chave não vazia** no provedor selecionado. Assim `isOnboarded()` nunca quebra por troca de provedor sem chave |
| T3 | **Detecção persistida**: `settings.detected[provider]` guarda a última lista detectada (por provedor). A runtime resolve: modelos escolhidos pelo usuário → curada ∩ detectada → detectada → curada. `detected` **não** vai para o backup |
| T4 | **Mensagens de erro provider-aware**: `Errors.noKey` / `Errors.invalidKey` passam a ser genéricas e recebem variáveis `{provider}` e `{url}` via `tErr(locale, key, vars)` — o texto continua sendo "chave {provider} inválida (401/403). Confira em {url}", sem matriz de chaves por provedor |
| T5 | **`importBackup` não deixa o usuário stranded**: restaura base, vagas, modelos e idioma; **não** restaura `provider` — se o provedor do backup tiver chave local, ele é ativado; senão o provedor atual é mantido |
| T6 | **`max_tokens`**: `ProviderDef.chat` recebe `opts: { json, maxTokens }` com padrão por provedor (Anthropic **exige** `max_tokens`; OpenAI usa `max_completion_tokens` na família `gpt-5*`/`o*` e `max_tokens` nas demais). Se a OpenAI recusar `response_format: json_object` (400), a chamada é repetida **uma vez** sem ele e o parse usa `extractJson` |
| T7 | **Normalização de ids**: cada `listModels` devolve ids **sem** prefixo (`models/gemini-3.8-flash` → `gemini-3.8-flash`), para a interseção com a lista curada funcionar |
| T8 | **Onboarding mantém 3 passos**: passo 2 = "escolher provedor + colar chave + validar" (a validação já detecta e persiste os modelos); a **seleção** da ordem de fallback fica na aba "IA" das configurações. Sem passo novo → `stepName1..3` e `setStep(3)` continuam válidos |
| T9 | **Diálogos empilhados**: `ui/dialog.tsx` ganha pilha de overlays (contador de z-index + `body.overflow` restaurado só quando o último fecha), para o botão "Ajuda" abrir o `HelpDialog` **dentro** do dialog de configurações sem quebrar o scroll/Escape |
| T10 | **Testes**: os contratos que codificam premissas "Gemini-only" são **atualizados** (não preservados): `i18n.test.ts` (texto de erro + `validateGeminiKey`), `onboarding.test.ts` (URL de chave deixa de estar inline no componente), `store.test.ts`, `tailor-retry.test.ts`, `tailor-job-url.test.ts`, `vacancy-chat.test.ts` (formato novo de `saveSettings`), `ui-contract.test.ts` (toolbar do dashboard). Regra: **a suíte fica verde** — contrato que muda de comportamento muda no mesmo PR |

## 5. Arquitetura

### 5.1 Novos arquivos

```
web/lib/llm/providers.ts        # registro dos 4 provedores (detecção + chat)
web/lib/llm/models.ts           # listas curadas + resolveModels(provider, detected, saved)
web/app/components/UserMenu.tsx  # dropdown do avatar (header)
web/app/components/UserAvatar.tsx# avatar de iniciais
web/app/components/settings/AppearanceTab.tsx
web/app/components/settings/ProvidersTab.tsx
web/app/components/settings/BackupTab.tsx
web/app/components/ui/switch.tsx
web/app/components/ui/label.tsx
web/app/components/ui/input.tsx
web/app/components/ui/separator.tsx
```

> Sem `RadioGroup`: os cards de provedor usam `<input type="radio">` nativo (o repo
> já usa `<input type="checkbox">` cru nos formulários).

### 5.2 Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `web/app/page.tsx` | Header do dashboard passa a renderizar `<UserMenu />`; o cluster `LocaleSelector/HelpDialog/ThemeToggle` fica **apenas** na fase de onboarding (sem nome extraído ainda) |
| `web/app/components/DashboardTabs.tsx` | Remove `<BaseMenu />` e `<SettingsDialog />` da toolbar (migram para o `UserMenu`) |
| `web/app/components/SettingsDialog.tsx` | Redesign: dialog grande com abas; mantém wipe-all |
| `web/app/components/ui/dropdown.tsx` | Acrescenta `DropdownLabel`, `DropdownSeparator` (mantém a API atual) |
| `web/app/components/ui/dialog.tsx` | Suporte a dialogs empilhados (T9) + `className`/`max-w-3xl` configurável |
| `web/app/components/BaseSetup.tsx`, `web/app/components/Onboarding.tsx`, `web/lib/tailor-client.ts`, `web/lib/vacancy-chat.ts` | Passam a chamar os wrappers `generateJsonFromSettings`/`generateTextFromSettings` (T1) — 1 linha por call site |
| `web/lib/store.ts` | Novo `SettingsSchema` (provider + keys por provedor + models por provedor + detected), migração do schema legado, `saveSettings` faz merge, backup v2 sem chaves |
| `web/lib/llm/chain.ts` | Fallback por provedor; `generateJson`/`generateText` ganham `provider`; wrappers que leem do store |
| `web/lib/llm/gemini.ts` | Mantido, mas passa a ser um "provider" do registro (mesma API) |
| `web/app/components/Onboarding.tsx` | Seletor de provedor + chave + detecção de modelos (passo 2) |
| `web/app/components/BaseMenu.tsx` | **Removido** — suas duas ações (imprimir/reenviar base) migram para o `UserMenu` |

| `web/messages/{pt-BR,en-US,es-ES}.json` | Chaves novas (`UserMenu`, `Settings.*`, `Appearance`, `Providers`, `Backup`) |
| `web/tests/*` | Novos/ajustados (ver §9) |

### 5.3 Camada de provider

`lib/llm/providers.ts` expõe:

```ts
export type ProviderId = "gemini" | "openai" | "anthropic" | "openrouter";

export interface ProviderDef {
  id: ProviderId;
  label: string;          // nome exibido (traduzido via messages)
  keyPlaceholder: string;
  keyUrl: string;         // link "criar chave"
  curatedModels: string[];// ordem de preferência (fallback)
  listModels(key: string): Promise<string[]>;
  chat(system: string, user: string, key: string, model: string, opts: { json: boolean }): Promise<string>;
}
```

Implementação por provedor:

| Provedor | Detecção (`/models`) | Chat | Observações |
|---|---|---|---|
| Gemini | `GET generativelanguage.googleapis.com/v1beta/models?key=` → `models[].name` (`models/gemini-3.8-flash` → id **sem** prefixo, T7) | `POST .../v1beta/models/{model}:generateContent` com `system_instruction` + `responseMimeType: application/json` | Filtra `supportedGenerationMethods` contendo `generateContent` |
| OpenAI | `GET api.openai.com/v1/models` (Bearer) → `data[].id` | `POST api.openai.com/v1/chat/completions` com `response_format:{type:"json_object"}` | Filtra fora embeddings/imagem/áudio (`dall-e`, `whisper`, `tts`, `embedding`, `moderation`, …); `max_completion_tokens` na família `gpt-5*`/`o*` (T6) |
| Anthropic | `GET api.anthropic.com/v1/models?limit=1000` → `data[].id` | `POST api.anthropic.com/v1/messages` com `system`, `messages`, `max_tokens` | Headers: `x-api-key`, `anthropic-version: 2023-06-01`, `anthropic-dangerous-direct-browser-access: true`. **Sem JSON mode** → o prompt já pede "SOMENTE JSON" e o parse usa `extractJson` |
| OpenRouter | `GET openrouter.ai/api/v1/models` → `data[].id` | `POST openrouter.ai/api/v1/chat/completions` (formato OpenAI) com `response_format` | Filtra embeddings/imagem/áudio por id; `openrouter/auto` fica no topo da preferência |

Todos os `chat` mantêm o **timeout de 60s**, o tratamento de erro atual (401/403 →
mensagem de chave inválida com provider/URL interpolados — T4) e o `maxTokens` por
provedor (T6).

**Entrada/saída da camada** (T1): o app chama sempre os wrappers
`generateJsonFromSettings(system, user, locale)` e `generateTextFromSettings(system,
user, locale)` — eles leem `provider`, `keys[provider]` e `models[provider]` do store e
resolvem a lista de fallback. A função de baixo nível
`generateJson(system, user, key, models, locale, provider)` continua existindo (usada
nos testes) e é a única que sabe iterar modelos.


### 5.4 Ordem dos modelos (fallback)

`lib/llm/models.ts`:

```ts
resolveModels(provider, detected, saved): string[]
```

1. Se o usuário **selecionou** modelos (`saved` não vazio) → usa essa lista, na ordem
   escolhida (depreciados removidos).
2. Senão, se a **detecção** devolveu modelos (`settings.detected[provider]`, T3) →
   interseção com a lista curada do provedor, preservando a ordem curada; se a
   interseção for vazia, usa os detectados ordenados por heurística (preferir `free`,
   `flash`/`lite`/`mini`, depois mais novo).
3. Senão → lista curada padrão do provedor.


Listas curadas (preferência de fallback):

- **gemini**: `gemini-3.8-flash`, `gemini-3.7-flash`, `gemini-3.6-flash`,
  `gemini-3.5-flash`, `gemini-3.5-flash-lite` (as já usadas hoje).
- **openai**: `gpt-5.1`, `gpt-5.1-mini`, `gpt-5`, `gpt-5-mini`, `gpt-4.1`, `gpt-4.1-mini`.
- **anthropic**: `claude-sonnet-4-5`, `claude-haiku-4-5`, `claude-opus-4-1`.
- **openrouter**: `openrouter/auto` + heurística sobre os detectados (sem lista fixa).

Fallback **restrito ao provedor ativo**: `chain.ts` itera só os modelos resolvidos do
provedor ativo; o erro final agrega as tentativas (`modelo: motivo | modelo: motivo`).

### 5.5 Store: schema novo + migração

```ts
export const SettingsSchema = z.object({
  provider: z.enum(["gemini","openai","anthropic","openrouter"]).default("gemini"),
  keys: z.object({
    gemini: z.string().default(""),
    openai: z.string().default(""),
    anthropic: z.string().default(""),
    openrouter: z.string().default(""),
  }),
  models: z.object({
    gemini: z.array(z.string()).default([]),
    openai: z.array(z.string()).default([]),
    anthropic: z.array(z.string()).default([]),
    openrouter: z.array(z.string()).default([]),
  }),
  detected: z.object({                    // última detecção por provedor (T3)
    gemini: z.array(z.string()).default([]),
    openai: z.array(z.string()).default([]),
    anthropic: z.array(z.string()).default([]),
    openrouter: z.array(z.string()).default([]),
  }),
});
```

- **Migração legada**: se o JSON salvo tiver `geminiKey`/`models` no formato antigo,
  `loadSettings()` converte para `provider: "gemini"`, `keys.gemini = geminiKey`,
  `models.gemini = models` (sem escrever de volta — a conversão acontece na leitura e a
  gravação seguinte já persiste o formato novo).
- `saveSettings` faz **merge** (chaves, modelos e detecção por provedor), para salvar
  um provedor não apagar a chave dos outros.
- `isOnboarded()` passa a exigir chave do **provedor ativo** + base válida. Como o
  provedor ativo só muda junto com uma chave válida (T2), isso nunca "derruba" o app.
- `models` vazio = "usa a ordem curada/detectada" (não é erro).


### 5.6 Backup (v2)

```jsonc
{
  "version": 2,
  "exportedAt": "2026-10-21T…",
  "base": { … },        // currículo base catalogado
  "apps": [ … ],       // vagas geradas (com currículo, análise, email, mensagem)
  "settings": {        // SEM CHAVES e SEM a detecção
    "provider": "openai",
    "models": { "openai": ["gpt-5.1"] },
    "locale": "pt-BR"
  }
}
```

- `importBackup` aceita v1 (`base` + `apps`) e v2; settings são restauradas **sem
  tocar nas chaves** e **sem restaurar `provider`**: se o provedor do backup tiver
  chave local, ele passa a ser o ativo; senão o provedor atual é mantido (T5).
- O import mantém o `window.location.reload()` já existente (o locale só é lido no
  mount do provider de i18n).
- `exportBackup`/`importBackup` continuam em `lib/store.ts` (testável sem React).


## 6. UI

### 6.1 Header do dashboard

```
┌──────────────────────────────────────────────────────────────┐
│ Personalize My CV                        ┌────┐  Bem-vindo,  │
│ Base: Filipe Batista — Eng. de Software  │ FB │  Filipe Batista V  ▾ │
└──────────────────────────────────────────────────────────────┘
```

- Avatar = círculo com as iniciais (**1ª + 2ª palavra**, D6) em `bg-primary text-primary-foreground`,
  `size-9`, `font-semibold`; `aria-hidden` (o nome está no texto ao lado).
- Saudação: `Bem-vindo, {nome}` (pt-BR) / `Welcome, {name}` (en-US) /
  `Bienvenido, {name}` (es-ES).
- Botão: `variant="outline"` com chevron (`LuChevronDown`) que gira 180° quando aberto.
- Sem base (fase de onboarding): o cluster atual (idioma/ajuda/tema) permanece.

### 6.2 Dropdown do avatar

Cabeçalho do dropdown: avatar grande + nome + subtítulo com o provedor de IA ativo
(ex.: "Gemini · gemini-3.8-flash"). Itens:

1. `LuPrinter` — **Imprimir CV Base** (`openResumePdf`)
2. `LuRefreshCw` — **Reenviar CV Base** (dialog `BaseSetup`, recataloga pela IA)
3. separador
4. `LuSettings` — **Config. Sistema** (abre o dialog de configurações)

### 6.3 Dialog "Config. Sistema" (abas)

Dialog `max-w-3xl`, abas (`ui/tabs` já existe):

**Aba "Aparência"**
- Switch **Modo escuro** (light ↔ dark, `next-themes`).
- Seletor de **idioma** (mesmo `Select` do `LocaleSelector`, movido para cá).
- Botão **Ajuda** (abre o `HelpDialog` existente, **empilhado** sobre o dialog de
  configurações — T9) com texto curto explicando o app.


**Aba "IA"**
- Cards de provedor (radio): Gemini / OpenAI / Anthropic / OpenRouter, com o link
  "criar chave" de cada um. O radio é estado **local** da aba (T2); o provedor só vira
  o **ativo** ao salvar — e salvar exige chave não vazia no provedor selecionado.
- Campo de chave (password) **do provedor selecionado** + botão **Validar e detectar
  modelos**. Ao validar: chama `/models`, mostra contagem, e a lista de modelos
  detectados (ordenada pela preferência) com checkbox — a ordem dos selecionados é a
  ordem de fallback.
- Resumo da cadeia de fallback: "Tentará, nesta ordem: A → B → C".
- Botão **Salvar** grava chave + modelos do provedor (merge).
- Aviso: "as chaves ficam só no seu navegador".


**Aba "Backup e dados"**
- Card **"O que é o backup"** (explicação em texto curto): arquivo JSON com currículo
  base + vagas geradas + preferências; vive no seu navegador; **não inclui chaves de
  API**.
- Card **preview**: currículo base (sim/não + data da última atualização), nº de vagas
  (e quantas falharam), tamanho estimado do arquivo, provider ativo, idioma, data da
  última exportação.
- Botões **Exportar backup** / **Importar backup**.
- Zona de perigo: **Apagar tudo** (dialog de confirmação; mantém o texto atual que
  contém "irreversível" — o teste de contrato checa isso nos 3 idiomas).

## 7. i18n

Chaves novas nos 3 arquivos (paridade garantida pelo teste existente):

- `UserMenu.*`: `greeting`, `avatarLabel`, `printBase`, `resendBase`, `openSettings`,
  `providerLine`.
- `Settings.*`: `appearance`, `ai`, `backup`, títulos e descrições das abas.
- `Appearance.*`: `darkMode`, `darkModeDesc`, `language`, `help`, `helpDesc`.
- `Providers.*`: `gemini`, `openai`, `anthropic`, `openrouter`, `key`, `validate`,
  `detecting`, `detected`, `none`, `fallbackOrder`, `saved`, `warning`.
- `Backup.*`: `whatIs`, `whatIsDesc`, `preview`, `baseResume`, `apps`, `failed`,
  `size`, `lastExport`, `neverExported`, `noKeys`, `exported`, `imported`,
  `invalidBackup`.

## 8. Compatibilidade / migração de comportamento

- Usuário existente com `geminiKey` → vira `provider: "gemini"` com a mesma chave e os
  mesmos modelos; nada quebra ao abrir o app.
- `Onboarding` deixa de exigir Gemini: seletor de provedor + chave; valida a chave do
  provedor escolhido e detecta os modelos.
- O `SettingsDialog` continua acessível pelo novo dropdown (o botão "Configurações" sai
  da toolbar do dashboard).
- `ui-contract.test.ts` é **atualizado** (o contrato antigo exigia `SettingsDialog` e
  `BaseMenu` na toolbar do dashboard).

## 9. Testes (TDD)

| Arquivo | Teste | Cobertura |
|---|---|---|
| `tests/providers.test.ts` (novo) | `listModels` de cada provedor (fetch mockado): parse, filtro de modelos não-chat, normalização do id Gemini (T7); `resolveModels` (curada ∩ detectada, fallback heurístico, lista do usuário, detecção persistida — T3) |
| `tests/llm-chain.test.ts` (ajustado) | Fallback **dentro** do provedor ativo; não tenta outro provedor; erro agrega motivos; wrapper do store usa provider/chave/modelos do `Settings` novo |
| `tests/store.test.ts` (ajustado) | Migração do schema legado; `saveSettings` faz merge; backup v2 **sem chaves** e com settings; import v1/v2 sem deixar provider sem chave (T5); `isOnboarded` com provider ativo |
| `tests/ui-contract.test.ts` (ajustado) | `UserMenu` no header com avatar/saudação/dropdown; itens do dropdown; `SettingsDialog` com as 3 abas e os 4 provedores; `ui/switch.tsx` existe; nenhum componente novo usa `/api/` ou `../actions`; nenhuma string PT hardcoded; `DashboardTabs` **sem** `BaseMenu`/`SettingsDialog` (migraram para o menu do usuário) |
| `tests/i18n.test.ts` (ajustado — T4/T10) | Erro de chave agora é provider-aware: `tErr("en-US", "noKey", { provider: "OpenAI" })` menciona o provider; `validateGeminiKey` continua existindo (alias do provider Gemini) |
| `tests/onboarding.test.ts` (ajustado — T8/T10) | Onboarding mantém 3 passos; a URL de chave vem do registro de providers (não mais literal no componente) |
| `tests/tailor-retry.test.ts`, `tests/tailor-job-url.test.ts`, `tests/vacancy-chat.test.ts` (ajustados — T10) | `saveSettings` com o formato novo (`provider`/`keys`/`models`) |

Comandos: `npm test -- --run`, `npx tsc --noEmit`, `npm run build`.


## 10. Riscos e como são tratados

| Risco | Tratamento |
|---|---|
| Anthropic bloqueia browser sem o header | Header `anthropic-dangerous-direct-browser-access: true` documentado no README (a chave já é do usuário, o app já é BYOK) |
| CORS bloqueando `/models` | Se a detecção falhar por CORS, a UI mostra o erro e **usa a lista curada** — o app continua funcionando |
| Anthropic sem JSON mode | Prompt já pede "SOMENTE JSON"; parse com `extractJson` (idêntico ao reparo já existente) |
| Modelos depreciados | `DEPRECATED_GEMINI_MODELS` continua filtrando; listas curadas dos outros provedores são revisáveis |
| Trabalho não commitado no repo | Nada é sobrescrito: mudanças são aplicadas sobre o estado atual dos arquivos |
| Chave vazia no provedor ativo | `isOnboarded()` falso → volta ao onboarding; a UI de providers mostra "sem chave" no provedor ativo |
