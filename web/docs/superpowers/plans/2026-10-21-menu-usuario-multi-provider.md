# Menu de usuário (avatar) + Config. Sistema multi-provedor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unificar os botões de configuração do dashboard em um único dropdown com avatar (iniciais do nome extraído) e redesenhar as configurações para suportar 4 provedores de IA (um ativo por vez, com fallback entre modelos), com backup explicado e visualizado.

**Architecture:** Uma camada de registro de providers (`lib/llm/providers.ts`) abstrai detecção de modelos (`/models`) e chat (JSON/texto) de Gemini, OpenAI, Anthropic e OpenRouter; `lib/llm/chain.ts` itera o fallback **dentro** do provedor ativo e expõe wrappers que leem o store. O store passa a guardar `provider` + `keys`/`models`/`detected` por provedor (com migração do formato Gemini-only) e um backup v2 sem chaves. Na UI, um `UserMenu` (avatar + dropdown) no header substitui o cluster de topo e concentra as ações do currículo; `SettingsDialog` vira um dialog com abas (Aparência / IA / Backup e dados).

**Tech Stack:** Next.js 15 (`output: export`, App Router, client-only), React 19, TypeScript, Tailwind v4 + tokens em `app/globals.css`, kit de UI local estilo shadcn em `app/components/ui/` (**sem Radix**), `next-intl` (pt-BR/en-US/es-ES), `zod` 3, `secure-ls`, `sonner`, `react-icons/lu`, Vitest + jsdom.

**Spec:** `web/docs/superpowers/specs/2026-10-21-menu-usuario-multi-provider-design.md` (lê o spec antes de implementar; o plano argumenta a partir dele).

## Global Constraints

- Escopo: **apenas `web/`**. Nunca importar nada de `mobile/` (o projeto é autocontido por decisão — ver `web/AGENTS.md`).
- Static export: **nunca** criar rota `/api/`, Server Action, `middleware` ou chamada de servidor. Toda chamada de IA vai do browser direto ao provider.
- **Nunca** enviar/storear chave em servidor. Chaves ficam em `secure-ls` (`pmcv:settings`), ofuscadas — não é cofre.
- **Nunca** exportar chave de API no backup.
- **Fallback só dentro do provedor ativo** — nunca tentar outro provider na mesma chamada.
- String de UI nova vai nos **3** arquivos (`messages/pt-BR.json`, `messages/en-US.json`, `messages/es-ES.json`) com o **mesmo keyset** (o teste `tests/i18n.test.ts` falha se divergir). Nenhuma string em português hardcoded em componente (o teste `tests/ui-contract.test.ts` falha).
- Erro de lib usa `tErr(locale, key, vars)` — nunca `next-intl` dentro de `lib/` (sem React).
- Comandos (em `web/`): `npm test -- --run`, `npx tsc --noEmit`, `npm run build`. Os três precisam passar antes de commit.
- Idioma da UI ≠ idioma do currículo (`BaseLang` continua independente).
- **Trabalho não commitado do repo:** existe uma feature "chat da vaga" (`lib/vacancy-chat.ts`, `lib/job-url.ts`, `app/components/VacancyChat.tsx` e testes correspondentes) **não commitada**. Nunca sobrescrever/desfazer esse trabalho: ao editar `lib/store.ts`, `lib/llm/chain.ts`, `lib/llm/gemini.ts`, `lib/tailor-client.ts`, `messages/*.json` ou `tests/*`, preserve o conteúdo atual e **adapte** (o plano já traz o formato novo em cima do existente).
- Commits:Conventional Commits em PT-BR no estilo do repo (`feat:`, `fix:`, `test:`, `refactor:`), sem emoji, sem "Claude"/"GPT" no corpo.

## Review Focus

Cinco condições que o spec implica mas que nenhum teste do repositório exercita hoje — cada uma ganha um teste no task dono do código:

1. **Usuário legado**: settings salvas no formato antigo (`geminiKey`/`models`) → o app abre no dashboard, sem onboarding, com a chave Gemini preservada e `provider === "gemini"`. (Task 2)
2. **Chave sem acesso ao modelo topo** (free tier): a geração tenta o próximo modelo **do mesmo provedor** e concludes com sucesso — o usuário não vê erro. (Task 3)
3. **Provedor ativo sem chave**: salvar um provedor novo sem colar chave não pode derrubar o app no onboarding — o provedor anterior continua ativo e a UI avisa. (Task 2 + Task 6)
4. **Backup importado de outra máquina**: o arquivo pode carregar `provider: "openai"` sem chave local → o import **mantém** o provider local com chave. (Task 2)
5. **Anthropic**: não tem JSON mode e exige `max_tokens` → a geração do currículo não quebra (parse tolerante via `extractJson`). (Task 1 + Task 3)

---

### Task 1: Registro de providers e resolução de modelos

Cria a camada que isola Gemini/OpenAI/Anthropic/OpenRouter: como listar os modelos que a chave acessa e como chamar cada API. Nenhuma UI, nenhum store.

**Files:**
- Create: `web/lib/llm/models.ts`
- Create: `web/lib/llm/providers.ts`
- Delete: `web/lib/llm/gemini.ts` (conteúdo migrado para os 2 arquivos acima)
- Modify: `web/lib/llm/chain.ts` (só o import + chamada Gemini, para não quebrar)
- Modify: `web/app/components/SettingsDialog.tsx` (só o import de `DEFAULT_GEMINI_MODELS`)
- Test: `web/tests/providers.test.ts`

**Interfaces:**
- Produces `web/lib/llm/providers.ts`:
  ```ts
  export type ProviderId = "gemini" | "openai" | "anthropic" | "openrouter";
  export const PROVIDER_IDS: ProviderId[];                       // ["gemini","openai","anthropic","openrouter"]
  export interface ProviderChatOptions { json: boolean; maxTokens: number; }
  export interface ProviderDef {
    id: ProviderId;
    label: string;            // nome de produto: "Gemini" | "OpenAI" | "Anthropic" | "OpenRouter"
    keyPlaceholder: string;   // "GEMINI_API_KEY" | "sk-..." | "sk-ant-..." | "sk-or-..."
    keyUrl: string;
    curatedModels: string[];
    listModels(key: string): Promise<string[]>;
    chat(system: string, user: string, key: string, model: string, opts: ProviderChatOptions): Promise<string>;
  }
  export const PROVIDERS: Record<ProviderId, ProviderDef>;
  export function providerLabel(id: ProviderId): string;
  ```
- Produces `web/lib/llm/models.ts`:
  ```ts
  export const DEFAULT_GEMINI_MODELS: string[];   // ["gemini-3.8-flash","gemini-3.7-flash","gemini-3.6-flash","gemini-3.5-flash","gemini-3.5-flash-lite"]
  export const DEPRECATED_GEMINI_MODELS: Set<string>;
  export const CURATED_MODELS: Record<ProviderId, string[]>;
  export function isDeprecatedModel(id: string): boolean;
  export function resolveModels(provider: ProviderId, detected: string[], saved: string[]): string[];
  export function rankDetected(ids: string[]): string[];
  ```
- `providers.ts` importa `CURATED_MODELS` (runtime) de `models.ts`; `models.ts` importa **apenas o tipo** `ProviderId` de `providers.ts` (`import type`) — sem ciclo em runtime.

- [ ] **Step 1: Escrever o teste que falha**

`web/tests/providers.test.ts`:

```ts
import { describe, expect, it, vi, afterEach } from "vitest";
import { PROVIDERS, PROVIDER_IDS } from "@/lib/llm/providers";
import { resolveModels, rankDetected } from "@/lib/llm/models";

afterEach(() => vi.unstubAllGlobals());

describe("providers registry", () => {
  it("exposes the 4 providers with key links and curated models", () => {
    expect(PROVIDER_IDS).toEqual(["gemini", "openai", "anthropic", "openrouter"]);
    expect(PROVIDERS.gemini.keyUrl).toBe("https://aistudio.google.com/apikey");
    expect(PROVIDERS.openai.keyUrl).toBe("https://platform.openai.com/api-keys");
    expect(PROVIDERS.anthropic.keyUrl).toBe("https://console.anthropic.com/settings/keys");
    expect(PROVIDERS.openrouter.keyUrl).toBe("https://openrouter.ai/keys");
    expect(PROVIDERS.gemini.curatedModels[0]).toBe("gemini-3.8-flash");
  });

  it("lists gemini models without the models/ prefix and only generateContent ones", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true, status: 200,
      json: async () => ({ models: [
        { name: "models/gemini-3.8-flash", supportedGenerationMethods: ["generateContent"] },
        { name: "models/text-embedding-004", supportedGenerationMethods: ["embedContent"] },
      ] }),
    })));
    expect(await PROVIDERS.gemini.listModels("K")).toEqual(["gemini-3.8-flash"]);
  });

  it("lists openai models without embeddings/image/audio models", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true, status: 200,
      json: async () => ({ data: [
        { id: "gpt-5.1" }, { id: "text-embedding-3-small" },
        { id: "dall-e-3" }, { id: "whisper-1" }, { id: "gpt-4.1-mini" },
      ] }),
    })));
    expect(await PROVIDERS.openai.listModels("K")).toEqual(["gpt-5.1", "gpt-4.1-mini"]);
  });

  it("lists anthropic models with the browser-access header", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true, status: 200,
      json: async () => ({ data: [{ id: "claude-sonnet-4-5" }, { id: "claude-haiku-4-5" }] }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await PROVIDERS.anthropic.listModels("K")).toEqual(["claude-sonnet-4-5", "claude-haiku-4-5"]);
    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers["anthropic-dangerous-direct-browser-access"]).toBe("true");
    expect(headers["anthropic-version"]).toBe("2023-06-01");
  });

  it("lists openrouter models without embeddings", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true, status: 200,
      json: async () => ({ data: [{ id: "openai/gpt-5.1" }, { id: "openai/text-embedding-3-large" }] }),
    })));
    expect(await PROVIDERS.openrouter.listModels("K")).toEqual(["openai/gpt-5.1"]);
  });

  it("raises a provider-aware error when the key is rejected", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 401, text: async () => "denied" })));
    await expect(PROVIDERS.openai.listModels("bad")).rejects.toThrow(/OpenAI/);
  });
});

describe("resolveModels", () => {
  it("keeps the user selection and its order", () => {
    expect(resolveModels("openai", ["gpt-5.1"], ["gpt-5", "gpt-4.1"])).toEqual(["gpt-5", "gpt-4.1"]);
  });
  it("falls back to curated ∩ detected when nothing was selected", () => {
    expect(resolveModels("openai", ["gpt-4.1-mini", "gpt-5.1"], [])).toEqual(["gpt-5.1", "gpt-4.1-mini"]);
  });
  it("uses the detected list ranked when the curated list does not overlap", () => {
    const out = resolveModels("openai", ["o-model-b", "o-model-a"], []);
    expect(out).toHaveLength(2);
    expect(out).toEqual([...out].sort().reverse());
  });
  it("uses the curated list when nothing was detected", () => {
    expect(resolveModels("gemini", [], [])[0]).toBe("gemini-3.8-flash");
  });
  it("drops deprecated gemini models from the user selection", () => {
    expect(resolveModels("gemini", [], ["gemini-2.5-flash", "gemini-3.8-flash"])).toEqual(["gemini-3.8-flash"]);
  });
  it("ranks free/flash/lite models first", () => {
    expect(rankDetected(["big-model", "flash-model", "free-model"])[0]).toBe("free-model");
  });
});
```

- [ ] **Step 2: Rodar o teste para ver falhar**

Run: `cd web && npm test -- --run tests/providers.test.ts`
Expected: FAIL — "Cannot find module '@/lib/llm/providers'".

- [ ] **Step 3: Implementar `web/lib/llm/models.ts`**

Conteúdo: `DEFAULT_GEMINI_MODELS` (5 ids, na ordem do spec), `DEPRECATED_GEMINI_MODELS` (mover o `Set` atual de `gemini.ts`, sem mudar nenhum id), `CURATED_MODELS`:

```ts
export const CURATED_MODELS: Record<ProviderId, string[]> = {
  gemini: [...DEFAULT_GEMINI_MODELS],
  openai: ["gpt-5.1", "gpt-5.1-mini", "gpt-5", "gpt-5-mini", "gpt-4.1", "gpt-4.1-mini"],
  anthropic: ["claude-sonnet-4-5", "claude-haiku-4-5", "claude-opus-4-1"],
  openrouter: ["openrouter/auto"],
};
```

- `isDeprecatedModel(id)` → `DEPRECATED_GEMINI_MODELS.has(id)`.
- `rankDetected(ids)`: score `free` +100, `flash` +50, `lite` +30, `mini` +20, `pro` +10, `max` +5; ordena por score desc e, no empate, por id em ordem decrescente (determinístico).
- `resolveModels(provider, detected, saved)`:
  1. `saved` não vazio → `saved` filtrando deprecados (só Gemini tem deprecados) e strings vazias;
  2. `detected` não vazio → interseção com `CURATED_MODELS[provider]` **preservando a ordem curada**; se vazia → `rankDetected(detected)`;
  3. senão → `CURATED_MODELS[provider]`.

- [ ] **Step 4: Implementar `web/lib/llm/providers.ts`**

Regras por provider (todas com timeout de 60s via `AbortController` e `Accept: application/json`):

| provider | `listModels` | `chat` |
|---|---|---|
| gemini | `GET https://generativelanguage.googleapis.com/v1beta/models?key={key}` → `json.models[]`, manter só quem tem `supportedGenerationMethods` incluindo `generateContent`, id = `name` sem o prefixo `models/` | `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}`, body `{system_instruction:{parts:[{text:system}]}, contents:[{parts:[{text:user}]}]}` + `generationConfig:{responseMimeType:"application/json", maxOutputTokens}` quando `opts.json`; lê `candidates[0].content.parts[].text` |
| openai | `GET https://api.openai.com/v1/models` (header `Authorization: Bearer {key}`) → `json.data[].id`, removendo quem casa `/embedding|whisper|tts|dall-e|gpt-image|moderation|audio|video|realtime|search/i` | `POST https://api.openai.com/v1/chat/completions`, body `{model, messages:[{role:"system",content:system},{role:"user",content:user}]}`; `max_completion_tokens` quando o modelo casa `/^(gpt-5|o\d)/`, senão `max_tokens`; `response_format:{type:"json_object"}` quando `opts.json`; se a resposta for 400 **e** havia `response_format`, repetir **uma vez** sem ele; ler `choices[0].message.content` |
| anthropic | `GET https://api.anthropic.com/v1/models?limit=1000` (headers `x-api-key`, `anthropic-version: 2023-06-01`, `anthropic-dangerous-direct-browser-access: true`) → `json.data[].id` | `POST https://api.anthropic.com/v1/messages` (mesmos 3 headers), body `{model, max_tokens: opts.maxTokens, system, messages:[{role:"user",content:user}]}`; ler `content[0].text` (sem JSON mode — o parse é tolerante) |
| openrouter | `GET https://openrouter.ai/api/v1/models` → `json.data[].id`, removendo quem casa o mesmo regex de não-chat | `POST https://openrouter.ai/api/v1/chat/completions`, body no formato OpenAI com `response_format:{type:"json_object"}` quando `opts.json`; ler `choices[0].message.content` |

Regras comuns:
- Chave vazia → `throw new Error(tErr(locale, "noKey", { provider: label, url: keyUrl }))` (locale via `getLocale()`).
- `res.status === 401 || 403` → `throw new Error(tErr(locale, "invalidKey", { provider: label, url: keyUrl }))`.
- Outro `!res.ok` → `throw new Error(`${label} ${res.status}: ${await res.text()}``)`.
- `listModels` devolve `[]` quando a API responde 200 com lista vazia (não é erro).
- `PROVIDERS.anthropic.curatedModels` etc. vêm de `CURATED_MODELS` (fonte única).

- [ ] **Step 5: Apagar `web/lib/llm/gemini.ts` e ajustar os 2 importadores**

- `web/lib/llm/chain.ts`: trocar o import de `./gemini` por `import { PROVIDERS } from "./providers";` e as chamadas `chatJsonGemini(...)`/`chatTextGemini(...)` por `PROVIDERS.gemini.chat(system, user, key, model, { json: true, maxTokens: 8192 })` / `{ json: false, maxTokens: 8192 }` (comportamento idêntico ao atual).
- `web/app/components/SettingsDialog.tsx`: `import { DEFAULT_GEMINI_MODELS } from "@/lib/llm/models";`.

- [ ] **Step 6: Rodar os testes para ver passar**

Run: `cd web && npm test -- --run tests/providers.test.ts tests/llm-chain.test.ts`
Expected: PASS (o `llm-chain` continua verde porque a chamada Gemini é equivalente).

- [ ] **Step 7: Commit**

```bash
git add web/lib/llm/models.ts web/lib/llm/providers.ts web/lib/llm/gemini.ts web/lib/llm/chain.ts web/app/components/SettingsDialog.tsx web/tests/providers.test.ts
git commit -m "feat(llm): registro de providers (gemini, openai, anthropic, openrouter) com deteccao de modelos"
```

---

### Task 2: Store — settings multi-provedor, migração e backup v2

Troca `Settings` para `provider` + `keys`/`models`/`detected` por provedor, com merge no `saveSettings`, migração do formato legado e backup v2 sem chaves.

**Files:**
- Modify: `web/lib/store.ts`
- Test: `web/tests/store.test.ts`

**Interfaces:**
- Consumes: `ProviderId`, `PROVIDER_IDS` de `@/lib/llm/providers` (Task 1); `CURATED_MODELS` não é usada aqui.
- Produces (em `web/lib/store.ts`):
  ```ts
  export const SettingsSchema: z.ZodObject<...>;   // provider, keys, models, detected
  export type Settings = z.infer<typeof SettingsSchema>;
  export type SettingsPatch = {
    provider?: ProviderId;
    geminiKey?: string;                 // legado aceito na escrita (transição)
    keys?: Partial<Record<ProviderId, string>>;
    models?: string[] | Partial<Record<ProviderId, string[]>>;   // string[] = legado (Gemini)
    detected?: Partial<Record<ProviderId, string[]>>;
  };
  export function loadSettings(): Settings;
  export function saveSettings(patch: SettingsPatch): void;
  export function clearSettings(): void;
  export function isOnboarded(): boolean;
  export function exportBackup(): string;
  export function importBackup(json: string): void;
  export function loadLastExport(): string | null;
  export function markBackupExported(): string;
  ```

- [ ] **Step 1: Escrever os testes que falham**

Adicionar em `web/tests/store.test.ts`:

```ts
it("migrates legacy gemini settings to the multi-provider shape", () => {
  setSecure("pmcv:settings", JSON.stringify({ geminiKey: "K", models: ["gemini-3.8-flash"] }));
  const s = loadSettings();
  expect(s.provider).toBe("gemini");
  expect(s.keys.gemini).toBe("K");
  expect(s.models.gemini).toEqual(["gemini-3.8-flash"]);
  expect(s.keys.openai).toBe("");
});

it("keeps a legacy user onboarded", () => {
  setSecure("pmcv:settings", JSON.stringify({ geminiKey: "K", models: ["gemini-3.8-flash"] }));
  saveBase(base);
  localStorage.setItem("pmcv:onboarded", "1");
  expect(isOnboarded()).toBe(true);
});

it("merges settings per provider instead of overwriting", () => {
  saveSettings({ provider: "gemini", keys: { gemini: "G" } });
  saveSettings({ provider: "openai", keys: { openai: "O" } });
  const s = loadSettings();
  expect(s.provider).toBe("openai");
  expect(s.keys.gemini).toBe("G");
  expect(s.keys.openai).toBe("O");
});

it("never activates a provider without a key", () => {
  saveSettings({ provider: "gemini", keys: { gemini: "G" } });
  saveSettings({ provider: "openai" });            // sem chave
  expect(loadSettings().provider).toBe("gemini");  // recusa a troca
});

it("exports a backup with settings and without any key", () => {
  saveSettings({ provider: "openai", keys: { openai: "SECRET" } });
  const parsed = JSON.parse(exportBackup());
  expect(parsed.version).toBe(2);
  expect(parsed.settings.provider).toBe("openai");
  expect(JSON.stringify(parsed)).not.toContain("SECRET");
});

it("imports a backup keeping the local provider when it has no key", () => {
  saveSettings({ provider: "gemini", keys: { gemini: "G" } });
  const json = JSON.stringify({ version: 2, exportedAt: new Date().toISOString(), base: null, apps: [],
    settings: { provider: "openai", models: { openai: ["gpt-5.1"] }, locale: "en-US" } });
  importBackup(json);
  expect(loadSettings().provider).toBe("gemini");
  expect(loadSettings().keys.gemini).toBe("G");
  expect(loadSettings().models.openai).toEqual(["gpt-5.1"]);
  expect(loadLocale()).toBe("en-US");
});

it("imports a legacy v1 backup", () => {
  const json = JSON.stringify({ base, apps: [], exportedAt: new Date().toISOString() });
  importBackup(json);
  expect(loadBase()?.resume.cabecalho.nome).toBe("Ana");
});
```

Importar `setSecure` no topo do teste: `import { setSecure } from "@/lib/secure-store";`.

- [ ] **Step 2: Rodar os testes para ver falhar**

Run: `cd web && npm test -- --run tests/store.test.ts`
Expected: FAIL — `loadSettings()` não devolve `provider`/`keys`; `exportBackup()` não tem `version`.

- [ ] **Step 3: Implementar o novo `SettingsSchema` e a migração em `web/lib/store.ts`**

```ts
export const SettingsSchema = z.object({
  provider: z.enum(["gemini", "openai", "anthropic", "openrouter"]).default("gemini"),
  keys: z.object({
    gemini: z.string().default(""), openai: z.string().default(""),
    anthropic: z.string().default(""), openrouter: z.string().default(""),
  }),
  models: z.object({
    gemini: z.array(z.string()).default([]), openai: z.array(z.string()).default([]),
    anthropic: z.array(z.string()).default([]), openrouter: z.array(z.string()).default([]),
  }),
  detected: z.object({
    gemini: z.array(z.string()).default([]), openai: z.array(z.string()).default([]),
    anthropic: z.array(z.string()).default([]), openrouter: z.array(z.string()).default([]),
  }),
});
```

`loadSettings()`: ler o JSON cru de `getSecure("pmcv:settings")`; se ele tiver a chave legada `geminiKey` (string), montar `{provider:"gemini", keys:{gemini: geminiKey, ...vazios}, models:{gemini: models ?? [], ...}, detected:{...vazios}}`; senão `SettingsSchema.parse(parsed)`. Qualquer erro → `SettingsSchema.parse({})`.

`saveSettings(patch)` — **ordem importa**:
1. parte de `loadSettings()` e aplica `keys`/`models`/`detected` do patch primeiro (merge por provedor);
2. `models` como `string[]` (legado) → `models.gemini = patch.models`; como objeto → merge por provedor;
3. `geminiKey` legado → `keys.gemini = patch.geminiKey`;
4. **só depois** avalia a troca de `provider`: ela é aceita **somente** se `merged.keys[patch.provider]` estiver não vazia; caso contrário, o provider anterior é mantido (regra "nunca ativar provider sem chave");
5. grava `SettingsSchema.parse(merged)` com `setSecure`.

`isOnboarded()`: `localStorage.getItem("pmcv:onboarded") === "1" && !!loadSettings().keys[loadSettings().provider] && !!loadBase()`.

`exportBackup()`:
```ts
const s = loadSettings();
return JSON.stringify({
  version: 2,
  exportedAt: new Date().toISOString(),
  base: loadBase(),
  apps: loadApps(),
  settings: { provider: s.provider, models: s.models, locale: loadLocale() },
});
```
(sem `keys` e sem `detected`).

`importBackup(json)`: parse tolerante (`z.object({...}).passthrough()`); restaurar `base` e `apps` como hoje; se `settings.models` existir, fazer merge em `loadSettings().models`; se `settings.locale` existir, `saveLocale(...)`; se `settings.provider` existir **e** `loadSettings().keys[provedorDoBackup]` não for vazia, ativar esse provedor — **senão manter o provider atual**.

`loadLastExport()` / `markBackupExported()`: `localStorage` key `pmcv:backup:lastExport` (ISO string). Adicionar essa key à lista de `wipeAll()`.

- [ ] **Step 4: Ajustar os testes legados que quebram**

Em `web/tests/store.test.ts`, o teste "round-trips settings through secure storage" usa o formato antigo:
```ts
saveSettings({ geminiKey: "K", models: ["m1", "m2"] });
expect(loadSettings()).toEqual({ geminiKey: "K", models: ["m1", "m2"] });
```
→ trocar por:
```ts
saveSettings({ geminiKey: "K", models: ["m1", "m2"] });
const s = loadSettings();
expect(s.keys.gemini).toBe("K");
expect(s.models.gemini).toEqual(["m1", "m2"]);
```
E o teste "wipeAll ..." (`expect(loadSettings().geminiKey).toBe("")`) → `expect(loadSettings().keys.gemini).toBe("")`. Adicionar `pmcv:backup:lastExport` à lista de keys checadas no mesmo teste.

- [ ] **Step 5: Rodar os testes para ver passar**

Run: `cd web && npm test -- --run tests/store.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add web/lib/store.ts web/tests/store.test.ts
git commit -m "feat(store): settings multi-provedor com migracao do formato legado e backup v2 sem chaves"
```

---

### Task 3: `chain.ts` provider-aware + wrappers + call sites

O fallback passa a iterar **dentro do provedor ativo**, lido do store; os 4 call sites passam a usar os wrappers.

**Files:**
- Modify: `web/lib/llm/chain.ts`
- Modify: `web/lib/tailor-client.ts`
- Modify: `web/lib/vacancy-chat.ts`
- Modify: `web/app/components/BaseSetup.tsx`
- Modify: `web/app/components/Onboarding.tsx`
- Test: `web/tests/llm-chain.test.ts`

**Interfaces:**
- Consumes: `PROVIDERS`, `ProviderId` (Task 1); `loadSettings()` (Task 2).
- Produces (em `web/lib/llm/chain.ts`):
  ```ts
  export async function generateJson(system: string, user: string, key: string, models?: string[], locale?: UiLocale, provider?: ProviderId): Promise<{ data: unknown; provider: string }>;
  export async function generateText(system: string, user: string, key: string, models?: string[], locale?: UiLocale, provider?: ProviderId): Promise<{ text: string; provider: string }>;
  export async function generateJsonFromSettings(system: string, user: string, locale?: UiLocale): Promise<{ data: unknown; provider: string }>;
  export async function generateTextFromSettings(system: string, user: string, locale?: UiLocale): Promise<{ text: string; provider: string }>;
  export async function validateProviderKey(provider: ProviderId, key: string, locale?: UiLocale): Promise<{ ok: true } | { ok: false; error: string }>;
  export async function validateGeminiKey(key: string, locale?: UiLocale): Promise<{ ok: true } | { ok: false; error: string }>;  // alias do provider "gemini"
  ```
  O campo `provider` do retorno passa a ser `` `${providerId}:${model}` `` (ex.: `"openai:gpt-5.1"`).

- [ ] **Step 1: Escrever os testes que falham**

Em `web/tests/llm-chain.test.ts` (preservando os testes existentes — inclusive os que usam `gemini-3.8-flash` etc.), adicionar:

```ts
it("falls back to the next model of the SAME provider", async () => {
  // 1ª chamada (gpt-5.1) falha com 500; 2ª (gpt-5-mini) responde
  // espera: 2 chamadas, nenhuma tentativa em outro provider
  expect(calls.map((c) => c.url)).toEqual([
    "https://api.openai.com/v1/chat/completions",
    "https://api.openai.com/v1/chat/completions",
  ]);
  expect(bodies[0].model).toBe("gpt-5.1");
  expect(bodies[1].model).toBe("gpt-5-mini");
});

it("never tries another provider when the active one fails", async () => {
  // todas as chamadas falham -> erro agregado citando só os modelos do provider ativo
  await expect(generateJson("s", "u", "K", ["gpt-5.1", "gpt-5-mini"], "pt-BR", "openai")).rejects.toThrow(/gpt-5\.1.*gpt-5-mini/);
});

it("reads provider, key and models from the store", async () => {
  saveSettings({ provider: "openai", keys: { openai: "OK" }, models: { openai: ["gpt-5.1"] } });
  const r = await generateJsonFromSettings("s", "u");
  expect(r.provider).toBe("openai:gpt-5.1");
});

it("parses a non-strict JSON answer from anthropic (no JSON mode)", async () => {
  // anthropic responde texto puro: "Aqui vai: {\"a\": 1}" (sem response_format)
  vi.stubGlobal("fetch", vi.fn(async () => ({
    ok: true, status: 200,
    json: async () => ({ content: [{ text: "Aqui vai: {\"ok\": true}" }] }),
  })));
  const r = await generateJson("s", "u", "K", ["claude-sonnet-4-5"], "pt-BR", "anthropic");
  expect(r.data).toEqual({ ok: true });
});
```

> O teste de fallback existente (que espera a sequência `gemini-3.8-flash … gemini-3.5-flash-lite`) continua válido: com o provider default `gemini` e sem `models`, a lista é a curada.

- [ ] **Step 2: Rodar os testes para ver falhar**

Run: `cd web && npm test -- --run tests/llm-chain.test.ts`
Expected: FAIL — `generateJsonFromSettings` não existe; `generateJson` não aceita `provider`.

- [ ] **Step 3: Implementar `web/lib/llm/chain.ts`**

- `generateJson(system, user, key, models, locale = getLocale(), provider: ProviderId = "gemini")`: itera `resolveModels(provider, [], models)` — quando `models` vier do usuário, `resolveModels` devolve exatamente a lista dele; para cada modelo chama `PROVIDERS[provider].chat(system, user, key, model, { json: true, maxTokens: 8192 })`, faz `JSON.parse(extractJson(texto))` e devolve `{ data, provider: `${provider}:${model}` }`; em erro, acumula `` `${model}: ${msg}` `` e no fim lança `new Error(errs.join(" | "))`.
- `generateText(...)`: idem com `{ json: false, maxTokens: 8192 }`, devolvendo `{ text, provider }` (sem parse).
- `generateJsonFromSettings(system, user, locale = getLocale())`: lê `loadSettings()`, chama `generateJson(system, user, s.keys[s.provider], s.models[s.provider], locale, s.provider)`.
- `generateTextFromSettings(...)`: idem.
- `validateProviderKey(provider, key, locale = getLocale())`: chave vazia → `{ ok: false, error: tErr(locale, "pasteKey") }`; senão `PROVIDERS[provider].listModels(key)`; `401/403` → `{ ok: false, error: tErr(locale, "invalidKey", { provider: label, url: keyUrl }) }`; outro erro → `{ ok: false, error: tErr(locale, "validateFailed", { status }) }` ou a mensagem do erro (slice 300); sucesso → `{ ok: true }`.
- `validateGeminiKey(key, locale)` → `validateProviderKey("gemini", key, locale)` (mantém a API atual, que `tests/i18n.test.ts` usa).

- [ ] **Step 4: Migrar os 4 call sites para os wrappers**

- `web/lib/tailor-client.ts`: `const { data } = await generateJsonFromSettings(system, buildTailorUser(...), locale);` e o reparo `await generateJsonFromSettings(system, buildRepairUser(...), locale);` — apagar as linhas `const settings = loadSettings();` que ficarem sem uso e o import `loadSettings` se não for mais usado.
- `web/lib/vacancy-chat.ts`: `const { text } = await generateTextFromSettings(buildVacancyChatSystem(locale), buildVacancyChatUser(app, question, history), locale);` — remover `loadSettings` do import.
- `web/app/components/BaseSetup.tsx`: idem, com `generateJsonFromSettings(system, text.slice(0, 12000))` e o reparo.
- `web/app/components/Onboarding.tsx`: idem (a UI de provedor entra na Task 7).

> **Preservar** o conteúdo atual desses arquivos: o `lib/vacancy-chat.ts` e os testes de `job-url` são trabalho não commitado — só trocar as chamadas, não reescrever.

- [ ] **Step 5: Rodar os testes para ver passar**

Run: `cd web && npm test -- --run tests/llm-chain.test.ts tests/tailor-retry.test.ts tests/vacancy-chat.test.ts tests/tailor-job-url.test.ts tests/cv-text-client.test.ts`
Expected: PASS (os testes que chamam `saveSettings({ geminiKey: "K", models: [...] })` continuam válidos porque o `saveSettings` aceita o formato legado — Task 2).

- [ ] **Step 6: Commit**

```bash
git add web/lib/llm/chain.ts web/lib/tailor-client.ts web/lib/vacancy-chat.ts web/app/components/BaseSetup.tsx web/app/components/Onboarding.tsx web/tests/llm-chain.test.ts
git commit -m "feat(llm): fallback dentro do provedor ativo e wrappers que leem o store"
```

---

### Task 4: Kit de UI — switch, input, label, separator, dialog empilhado, dropdown extras

Primitivas novas + dialogs empilhados (para o botão "Ajuda" abrir por cima do dialog de Configurações) + labels/separadores no dropdown.

**Files:**
- Create: `web/app/components/ui/switch.tsx`
- Create: `web/app/components/ui/input.tsx`
- Create: `web/app/components/ui/label.tsx`
- Create: `web/app/components/ui/separator.tsx`
- Modify: `web/app/components/ui/dialog.tsx`
- Modify: `web/app/components/ui/dropdown.tsx`
- Modify: `web/app/components/HelpDialog.tsx`
- Test: `web/tests/ui-contract.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // ui/switch.tsx
  export function Switch({ checked, onCheckedChange, disabled, id, "aria-label": ariaLabel }: {
    checked: boolean; onCheckedChange: (v: boolean) => void; disabled?: boolean; id?: string; "aria-label"?: string;
  }): JSX.Element;   // <button role="switch" aria-checked={checked}>
  // ui/input.tsx
  export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>): JSX.Element;
  // ui/label.tsx
  export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>): JSX.Element;
  // ui/separator.tsx
  export function Separator({ className, orientation = "horizontal" }: { className?: string; orientation?: "horizontal" | "vertical" }): JSX.Element;
  // ui/dialog.tsx — novo
  export function Dialog({ open, onClose, children, className }: { open: boolean; onClose: () => void; children: React.ReactNode; className?: string }): JSX.Element;
  // ui/dropdown.tsx — novo
  export function DropdownLabel({ children }: { children: React.ReactNode }): JSX.Element;
  export function DropdownSeparator(): JSX.Element;
  // ui/dropdown.tsx — Dropdown ganha onOpenChange
  export function Dropdown({ trigger, children, align, onOpenChange }: { trigger: React.ReactNode; children: React.ReactNode; align?: "left" | "right"; onOpenChange?: (open: boolean) => void }): JSX.Element;
  // HelpDialog.tsx — vira controlável
  export function HelpDialog({ open, onClose }: { open?: boolean; onClose?: () => void }): JSX.Element;
  ```

> **Nenhum componente `RadioGroup` novo**: os cards de provedor usam `<input type="radio">` nativo (o repo já usa `<input type="checkbox">` cru nos formulários) — menos código e sem_radix.

- [ ] **Step 1: Escrever o teste que falha**

Adicionar em `web/tests/ui-contract.test.ts`:

```ts
it("ui kit has switch, input, label and separator", () => {
  for (const f of ["app/components/ui/switch.tsx", "app/components/ui/input.tsx", "app/components/ui/label.tsx", "app/components/ui/separator.tsx"]) {
    expect(existsSync(f), f).toBe(true);
  }
  expect(readFileSync("app/components/ui/switch.tsx", "utf8")).toContain('role="switch"');
});

it("dialog supports a custom class and stacked overlays", () => {
  const d = readFileSync("app/components/ui/dialog.tsx", "utf8");
  expect(d).toContain("className?: string");
  expect(d).toContain("stack");  // contador de overlays
});
```

- [ ] **Step 2: Rodar o teste para ver falhar**

Run: `cd web && npm test -- --run tests/ui-contract.test.ts`
Expected: FAIL — os 4 arquivos de UI não existem.

- [ ] **Step 3: Criar as 4 primitivas**

- `ui/switch.tsx`: `<button type="button" role="switch" aria-checked={checked} data-state={checked ? "checked" : "unchecked"} className={cn("inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50", checked ? "bg-primary" : "bg-input")}>` com um `<span className={cn("pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform", checked ? "translate-x-5" : "translate-x-0")} />` dentro.
- `ui/input.tsx`: `<input>` com `h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50`.
- `ui/label.tsx`: `<label>` com `text-sm font-medium leading-none`.
- `ui/separator.tsx`: `<div role="separator">` com `h-px w-full bg-border` (horizontal) ou `h-full w-px` (vertical).

- [ ] **Step 4: `ui/dialog.tsx` — `className` + pilha de overlays**

- Prop `className?: string` aplicada no container do dialog (default atual `max-w-2xl`).
- Pilha: contador de módulo `let openCount = 0;` — ao abrir, `openCount++` e aplicar `z-[50+openCount]` no overlay; ao fechar (unmount), `openCount--` e restaurar `document.body.style.overflow = ""` **somente** quando `openCount === 0`. O `Escape` deve fechar **apenas o dialog do topo** (o do topo é o último montado — usar um contador para decidir: o handler só age se `openCount === 1` **ou** se o dialog for o do topo; implementação simples: cada dialog guarda seu `zIndex` no state e só reage ao Escape se o seu zIndex for o maior).

- [ ] **Step 5: `ui/dropdown.tsx` — label, separator e `onOpenChange`**

- `Dropdown` passa a chamar `onOpenChange?.(true/false)` ao abrir/fechar (e mantém o `align` e o comportamento de fechar ao clicar fora / `Escape`).
- `DropdownLabel({ children })`: `<div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">`.
- `DropdownSeparator()`: `<div className="-mx-1 my-1 h-px bg-border" />`.

- [ ] **Step 6: `HelpDialog.tsx` controlável**

```tsx
export function HelpDialog({ open: openProp, onClose }: { open?: boolean; onClose?: () => void }) {
  const [internalOpen, setInternalOpen] = useState(false);
  const controlled = openProp !== undefined;
  const open = controlled ? openProp : internalOpen;
  const close = () => { if (!controlled) setInternalOpen(false); onClose?.(); };
  // controlled -> não renderiza o botão gatilho; uncontrolled -> mantém o Button atual
}
```

- [ ] **Step 7: Rodar os testes para ver passar**

Run: `cd web && npm test -- --run tests/ui-contract.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add web/app/components/ui/switch.tsx web/app/components/ui/input.tsx web/app/components/ui/label.tsx web/app/components/ui/separator.tsx web/app/components/ui/dialog.tsx web/app/components/ui/dropdown.tsx web/app/components/HelpDialog.tsx web/tests/ui-contract.test.ts
git commit -m "feat(ui): switch, input, label, separator, dialog empilhado e extras do dropdown"
```

---

### Task 5: Avatar, UserMenu e header

O dropdown do avatar no header, com as ações do currículo, e a remoção do cluster de topo e do `BaseMenu`.

**Files:**
- Create: `web/lib/initials.ts`
- Create: `web/app/components/UserAvatar.tsx`
- Create: `web/app/components/UserMenu.tsx`
- Modify: `web/app/page.tsx`
- Modify: `web/app/components/DashboardTabs.tsx`
- Modify: `web/app/components/SettingsDialog.tsx` (tornar controlável — o `UserMenu` precisa abrir sem botão gatilho)
- Delete: `web/app/components/BaseMenu.tsx`
- Modify: `web/messages/pt-BR.json`, `web/messages/en-US.json`, `web/messages/es-ES.json`
- Test: `web/tests/initials.test.ts` (novo), `web/tests/ui-contract.test.ts`

**Interfaces:**
- Produces `web/lib/initials.ts`:
  ```ts
  export function initialsFromName(name: string): string;   // "Filipe Batista V" -> "FB"
  ```
- Produces `web/app/components/UserAvatar.tsx`:
  ```tsx
  export function UserAvatar({ name, className }: { name: string; className?: string }): JSX.Element;
  ```
- Produces `web/app/components/UserMenu.tsx`:
  ```tsx
  export function UserMenu({ name }: { name: string }): JSX.Element;
  ```
  Renderiza: `Dropdown` (trigger = botão com `UserAvatar` + saudação + `LuChevronDown`), `DropdownLabel` (avatar + nome + linha do provider ativo), `DropdownItem` "Imprimir CV Base", `DropdownItem` "Reenviar CV Base", `DropdownSeparator`, `DropdownItem` "Config. Sistema"; mais os 2 dialogs (reenviar base com `BaseSetup`; configurações com `SettingsDialog`).
- Consumes: `initialsFromName`, `openResumePdf` (`@/lib/pdf/client`), `BaseSetup`, `SettingsDialog`, `loadSettings`, `loadBase`.

- [ ] **Step 1: Escrever o teste que falha**

`web/tests/initials.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { initialsFromName } from "@/lib/initials";

describe("initialsFromName", () => {
  it("uses the first and the second word", () => {
    expect(initialsFromName("Filipe Batista V")).toBe("FB");
  });
  it("uses a single letter for a single-word name", () => {
    expect(initialsFromName("Ana")).toBe("A");
  });
  it("ignores extra spaces and empty parts", () => {
    expect(initialsFromName("  Maria   Souza  ")).toBe("MS");
  });
  it("is upper case and safe for empty input", () => {
    expect(initialsFromName("")).toBe("");
    expect(initialsFromName("joão paulo")).toBe("JP");
  });
});
```

- [ ] **Step 2: Rodar o teste para ver falhar**

Run: `cd web && npm test -- --run tests/initials.test.ts`
Expected: FAIL — "Cannot find module '@/lib/initials'".

- [ ] **Step 3: Implementar `web/lib/initials.ts`**

```ts
export function initialsFromName(name: string): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}
```

- [ ] **Step 4: Implementar `UserAvatar.tsx`**

```tsx
export function UserAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <span aria-hidden className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground", className)}>
      {initialsFromName(name)}
    </span>
  );
}
```

- [ ] **Step 5: Implementar `UserMenu.tsx`**

- Trigger: `<Button variant="outline" className="h-auto gap-2 py-1.5 pl-1.5 pr-3">` contendo `UserAvatar`, `<span className="hidden max-w-[12rem] truncate sm:inline">{t("greeting", { name })}</span>` e `<LuChevronDown className={cn("transition-transform", open && "rotate-180")} />`; o `Dropdown` recebe `onOpenChange={setOpen}`.
- `DropdownLabel`: `UserAvatar` grande (`h-10 w-10`) + nome (`font-medium`) + linha do provider ativo (`text-xs text-muted-foreground`): `` `${providerLabel(s.provider)} · ${primeiroModeloResolvido}` `` (ou só o provider se não houver modelo).
- `DropdownItem` "Imprimir CV Base": chama `openResumePdf(base.resume, base.lang)` (mesmo código do `BaseMenu` atual); em erro → `toast.error(t("openPdfFail"), { description })`; se não houver base → `toast.error(te("noBase"))`.
- `DropdownItem` "Reenviar CV Base": abre um `Dialog` com `BaseSetup` (que recataloga pela IA) e `onDone={() => window.location.reload()}`.
- `SettingsDialog` continua onde está, mas passa a ser **controlável** (mesmo padrão do `HelpDialog` da Task 4): `export function SettingsDialog({ open, onClose }: { open?: boolean; onClose?: () => void })` — com `open` definido, o componente é controlado (sem botão gatilho); sem `open`, mantém o botão gatilho atual (compatibilidade). É o que permite ao `UserMenu` abrir a configuração a partir do dropdown.
- `DropdownItem` "Config. Sistema": abre o `SettingsDialog` controlado (`open={settingsOpen}` / `onClose={() => setSettingsOpen(false)}`).

- [ ] **Step 6: Ligar no header (`web/app/page.tsx`)**

- No branch de **dashboard**: trocar o bloco
  ```tsx
  <div className="flex items-center gap-1"><LocaleSelector /><HelpDialog /><ThemeToggle /></div>
  ```
  por `<UserMenu name={base?.cabecalho.nome ?? ""} />`.
- No branch de **onboarding**: manter o cluster atual (idioma/ajuda/tema) — ainda não há nome extraído.
- Importar `UserMenu` e remover os imports de `LocaleSelector`/`HelpDialog`/`ThemeToggle` **apenas se** ficarem sem uso no arquivo (o branch de onboarding continua usando os três → manter os imports).

- [ ] **Step 7: Limpar a toolbar do dashboard (`web/app/components/DashboardTabs.tsx`)**

Remover `<BaseMenu />` e `<SettingsDialog />` do bloco de botões (o `GenerateModal`/"Personalizar com IA" **continua** na toolbar — é a ação principal, não configuração). Remover os imports correspondentes. **Não** tocar em mais nada do arquivo (preservar o `storage` listener e o `setApps`).

- [ ] **Step 8: Apagar `web/app/components/BaseMenu.tsx`**

`git rm web/app/components/BaseMenu.tsx` (as duas ações dele migraram para o `UserMenu`).

- [ ] **Step 9: Chaves de i18n (3 idiomas)**

Adicionar o namespace `UserMenu` nos 3 arquivos, com **exatamente** estes keys e estes valores em pt-BR:

| key | pt-BR |
|---|---|
| `greeting` | `Bem-vindo, {nome}` |
| `printBase` | `Imprimir CV Base` |
| `resendBase` | `Reenviar CV Base` |
| `openSettings` | `Config. Sistema` |
| `providerLine` | `{provider} · {model}` |
| `resendTitle` | `Reenviar currículo base` |
| `resendDesc` | `A IA vai recatalogar seus dados a partir do novo PDF.` |

en-US e es-ES: mesma estrutura, textos traduzidos (`"Welcome, {name}"`, `"Print base resume"`, `"Resend base resume"`, `"System settings"`, `"{provider} · {model}"`, `"Resend base resume"`, `"The AI will re-catalog your data from the new PDF."` / `"Bienvenido, {nombre}"`, `"Imprimir CV base"`, `"Reenviar CV base"`, `"Config. del sistema"`, `"El AI recatalogará tus datos a partir del nuevo PDF."`).

- [ ] **Step 10: Ajustar `web/tests/ui-contract.test.ts`**

- O bloco "base gear menu" (que exige `BaseMenu` e `openResumePdf` em `BaseMenu.tsx`) → exigir que **`UserMenu.tsx`** contenha `openResumePdf` e `BaseSetup`, e que `BaseMenu.tsx` **não** exista mais.
- O bloco "settings dialog (post-onboarding)" — a asserção `expect(tabs).toContain("SettingsDialog")` → `expect(readFileSync("app/components/UserMenu.tsx", "utf8")).toContain("SettingsDialog")`; e `expect(readFileSync("app/components/DashboardTabs.tsx", "utf8")).not.toContain("BaseMenu")`.
- Adicionar: o `page.tsx` do dashboard usa `UserMenu` e o `page.tsx` continua contendo `LocaleSelector`, `HelpDialog` e `ThemeToggle` (branch de onboarding).

- [ ] **Step 11: Rodar os testes para ver passar**

Run: `cd web && npm test -- --run tests/initials.test.ts tests/ui-contract.test.ts`
Expected: PASS.

- [ ] **Step 12: Commit**

```bash
git add web/lib/initials.ts web/app/components/UserAvatar.tsx web/app/components/UserMenu.tsx web/app/page.tsx web/app/components/DashboardTabs.tsx web/app/components/BaseMenu.tsx web/messages/pt-BR.json web/messages/en-US.json web/messages/es-ES.json web/tests/initials.test.ts web/tests/ui-contract.test.ts
git commit -m "feat(ui): menu do usuario com avatar, impressao/reenvio do CV base e config do sistema"
```

---

### Task 6: Redesenho das configurações — abas Aparência, IA e Backup

`SettingsDialog` controlado, com 3 abas. A aba "IA" implementa providers (chave, detecção, ordem de fallback); a aba "Backup e dados" implementa a visualização, a explicação do backup e o "Apagar tudo".

**Files:**
- Modify: `web/app/components/SettingsDialog.tsx` (reescrita)
- Create: `web/app/components/settings/AppearanceTab.tsx`
- Create: `web/app/components/settings/ProvidersTab.tsx`
- Create: `web/app/components/settings/BackupTab.tsx`
- Modify: `web/messages/pt-BR.json`, `web/messages/en-US.json`, `web/messages/es-ES.json`
- Test: `web/tests/ui-contract.test.ts`

**Interfaces:**
- Consumes: `PROVIDERS`, `PROVIDER_IDS`, `providerLabel` (Task 1); `resolveModels` (Task 1); `loadSettings`, `saveSettings`, `exportBackup`, `importBackup`, `loadLastExport`, `markBackupExported`, `wipeAll`, `loadLocale` (Task 2); `validateProviderKey` (Task 3); `Switch`, `Input`, `Label`, `Separator` (Task 4); `useUiLocale` (`@/lib/i18n/provider`); `useTheme` (`next-themes`).
- Produzes (API pública do componente):
  ```tsx
  export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }): JSX.Element;
  ```
  (controlado e **obrigatório** — o botão gatilho sai; quem abre é o `UserMenu`, que já passa `open`/`onClose` desde a Task 5).

- [ ] **Step 1: Escrever o teste que falha**

Adicionar em `web/tests/ui-contract.test.ts`:

```ts
it("settings dialog has appearance, AI and backup tabs", () => {
  const s = readFileSync("app/components/SettingsDialog.tsx", "utf8");
  expect(s).toContain("AppearanceTab");
  expect(s).toContain("ProvidersTab");
  expect(s).toContain("BackupTab");
  expect(s).toContain("TabsTrigger");
  const pt = JSON.parse(readFileSync("messages/pt-BR.json", "utf8"));
  expect(pt.Settings.appearance).toBe("Aparência");
  expect(pt.Settings.ai).toBe("IA");
  expect(pt.Settings.backupTab).toBe("Backup e dados");
});

it("providers tab lists the 4 providers and the fallback order", () => {
  const p = readFileSync("app/components/settings/ProvidersTab.tsx", "utf8");
  for (const id of ["gemini", "openai", "anthropic", "openrouter"]) expect(p, id).toContain(id);
  expect(p).toContain("listModels");
  expect(p).toContain("resolveModels");
  expect(p).toContain("fallbackOrder");
});

it("backup tab explains the backup and keeps the wipe-everything danger zone", () => {
  const b = readFileSync("app/components/settings/BackupTab.tsx", "utf8");
  expect(b).toContain("exportBackup");
  expect(b).toContain("importBackup");
  expect(b).toContain("wipeAll");
  expect(b).toContain("noKeys");
  const pt = JSON.parse(readFileSync("messages/pt-BR.json", "utf8"));
  expect(pt.Backup.whatIs).toBeTruthy();
  expect(pt.Backup.noKeys).toMatch(/chave/i);
});
```

- [ ] **Step 2: Rodar o teste para ver falhar**

Run: `cd web && npm test -- --run tests/ui-contract.test.ts`
Expected: FAIL — os 3 arquivos das abas não existem.

- [ ] **Step 3: Reescrever `SettingsDialog.tsx`**

- Assinatura: `export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void })`.
- `<Dialog open={open} onClose={onClose} className="max-w-3xl">` com `DialogHeader` (título + descrição) e `Tabs` (`value`/`onChange` internos, default `"aparencia"`).
- `TabsList` com 3 `TabsTrigger`: `appearance` (ícone `LuPalette`), `ai` (ícone `LuBrainCircuit`), `backup` (ícone `LuDatabase`).
- `TabsContent` renderiza `<AppearanceTab />`, `<ProvidersTab />`, `<BackupTab />`.
- **Remover** do arquivo: o botão gatilho `Button variant="outline"` com `t("open")`, o `useState` de `open` e o `handleClearKey` (o "remover chave" passa a morar na aba "IA"). A chave `Settings.open` sai dos 3 arquivos de messages (e o teste que a exigia é ajustado no Step 8).

- [ ] **Step 4: Implementar `settings/AppearanceTab.tsx`**

- **Modo escuro**: `useTheme()` → `theme`, `resolvedTheme`; `mounted` guard (igual ao `theme-toggle.tsx`); `Switch` com `checked = resolvedTheme === "dark"`, `onCheckedChange` → `setTheme(v ? "dark" : "light")`, `aria-label` = `t("darkMode")`. O texto ao lado: "Modo escuro" + descrição curta.
- **Idioma**: `useUiLocale()` → `locale`, `setLocale`; `Select` com `LOCALES`/`LOCALE_LABELS` de `@/lib/i18n/config` (mesmo markup do `LocaleSelector` atual).
- **Ajuda**: `Button variant="outline"` que abre `<HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />` (controlado — sem botão gatilho).

- [ ] **Step 5: Implementar `settings/ProvidersTab.tsx`**

Estado local: `selectedProvider` (default = `loadSettings().provider`), `key` (default = `keys[selectedProvider]`), `detected` (default = `settings.detected[selectedProvider]`), `selectedModels` (default = `resolveModels(provider, detected, settings.models[provider])`), `loading`, `error`, `saved`.

Render:
1. **Cards de provedor** (4) — `role="radio"`/`aria-checked`, com `label`, `keyUrl` (link "criar chave"), e badge "Ativo" no provedor ativo. Clicar troca `selectedProvider` e recarrega `key`/`detected`/`selectedModels` daquele provedor (a troca **não** persiste nada — só o "Salvar" persiste).
2. **Chave**: `Input type="password"` + `Button` "Validar e detectar modelos" → `await PROVIDERS[selectedProvider].listModels(key)`; em sucesso: `detected = res`, `selectedModels = resolveModels(selectedProvider, res, [])` e `saveSettings({ detected: { [selectedProvider]: res } })` (merge); em erro → `error = message`.
3. **Modelos**: lista com `Checkbox` (input[type=checkbox] com `label` do `Label`) dos modelos detectados + os curados (union, na ordem de `resolveModels`); marcar/desmarcar muda `selectedModels` **preservando a ordem da lista** (a ordem exibida é a ordem de fallback).
4. **Resumo**: `t("fallbackOrder")` + a lista `selectedModels.join(" → ")` (ou `t("noModel")` se vazia).
5. **Salvar**: `saveSettings({ provider: selectedProvider, keys: { [selectedProvider]: key }, models: { [selectedProvider]: selectedModels } })` — **bloqueado** se `key.trim()` estiver vazio (`error = t("noKeySelected")`); depois `toast.success(t("saved"))`. Como o `saveSettings` recusa trocar de provider sem chave (Task 2), o app nunca fica sem chave ativa; se o usuário tentar salvar sem chave, mostrar `t("noKeySelected")` e **não** salvar.
6. Aviso fixo no rodapé: `t("warning")` ("As chaves ficam só no seu navegador").
7. Botão "Remover chave" (por provedor): `saveSettings({ keys: { [selectedProvider]: "" } })` + `toast.success(t("keyRemoved"))`; se o provedor removido for o ativo, o `saveSettings` mantém o provider anterior (chave não vazia) — nunca deixar o app sem chave ativa.

- [ ] **Step 6: Implementar `settings/BackupTab.tsx`**

- **Card "O que é o backup"**: `t("whatIs")` + `t("whatIsDesc")` + `t("noKeys")` (explica que as chaves de API não são incluídas).
- **Card "O que será exportado"**: linhas com
  - currículo base: `loadBase() ? t("yes") + " · " + formatDate(base.updatedAt) : t("no")`;
  - currículos gerados: `loadApps().length` (e quantos `status === "failed"` → `t("failed")`);
  - tamanho estimado: `Math.round(exportBackup().length / 1024) + " KB"`;
  - provedor de IA: `providerLabel(loadSettings().provider)`;
  - idioma: `loadLocale()`;
  - último backup: `loadLastExport() ? formatDate(loadLastExport()) : t("never")`.
- **Botões**: "Exportar backup" → `markBackupExported()` + download do blob JSON (mesmo padrão do `SettingsDialog` atual: `Blob` → `URL.createObjectURL` → `<a download="pmcv-backup-YYYY-MM-DD.json">` → `revokeObjectURL` após 10s) + `toast.success(t("exported"))`; "Importar backup" → `<input type="file" accept="application/json">` (escondido) → `importBackup(await file.text())` → `toast.success(t("imported"))` + `window.location.reload()`; em erro → `toast.error(t("invalidBackup"), { description })`.
- **Zona de perigo**: `Separator` + `t("dangerZone")` + `Button variant="destructive"` "Apagar tudo" → `Dialog` de confirmação com `t("wipeTitle")` / `t("wipeDesc")` (texto com "irreversível") e `Button variant="destructive"` `t("wipeConfirm")` → `wipeAll()` + `window.location.reload()`.

- [ ] **Step 7: Chaves de i18n (3 idiomas)**

Namespaces `Settings` (novos/alterados), `Appearance`, `Providers`, `Backup`. Valores em pt-BR (idênticos nos 3 idiomas **só nos keys**, valores traduzidos):

`Settings`: `title` "Configurações" · `desc` "Aparência, provedor de IA e seus dados." · `appearance` "Aparência" · `ai` "IA" · `backupTab` "Backup e dados" · `updated` "Configurações atualizadas!"

`Appearance`: `darkMode` "Modo escuro" · `darkModeDesc` "Alterna entre o tema claro e escuro." · `language` "Idioma" · `languageDesc` "Idioma da interface. O idioma do currículo é escolhido a cada geração." · `help` "Ajuda" · `helpDesc` "Como usar o app, passo a passo."

`Providers`: `title` "Provedor de IA" · `desc` "Um provedor por vez. A IA tenta os modelos em ordem até um responder." · `active` "Ativo" · `key` "Chave da API" · `createKey` "Criar chave" · `validate` "Validar e detectar modelos" · `validating` "Detectando…" · `detected` "{n} modelos disponíveis" · `noModels` "Nenhum modelo detectado — usando a lista padrão." · `selectModels` "Modelos (a ordem é a de tentativa)" · `fallbackOrder` "Tentará, nesta ordem" · `noModel` "Nenhum modelo selecionado." · `noKeySelected` "Cole a chave antes de salvar." · `save` "Salvar" · `saved` "Provedor salvo!" · `keyRemoved` "Chave removida." · `removeKey` "Remover chave" · `warning` "As chaves ficam apenas no seu navegador — nunca são enviadas para nenhum servidor nosso (não existe servidor)."

`Backup`: `whatIs` "O que é o backup" · `whatIsDesc` "Um arquivo JSON com tudo que este app guardou no seu navegador: seu currículo base, os currículos gerados e suas preferências. Guarde-o onde quiser — se limpar o navegador, ele é a sua forma de recuperar tudo." · `noKeys` "As chaves de API não são incluídas no backup (por segurança): você precisa colar a chave de novo no outro dispositivo." · `preview` "O que será exportado" · `baseResume` "Currículo base" · `apps` "Currículos gerados" · `failed` "{n} com falha" · `size` "Tamanho estimado" · `provider` "Provedor de IA" · `locale` "Idioma" · `lastExport` "Último backup" · `never` "Nunca" · `yes` "Sim" · `no` "Não" · `export` "Exportar backup" · `import` "Importar backup" · `exported` "Backup exportado!" · `imported` "Backup importado!" · `invalidBackup` "Backup inválido" · `dangerZone` "Zona de perigo" · `wipeAll` "Apagar tudo" · `wipeTitle` "Apagar todos os dados?" · `wipeDesc` "Isso é irreversível: base, vagas, chaves, idioma, tema e consentimento serão removidos deste navegador." · `wipeConfirm` "Apagar tudo"

> `wipeDesc` **precisa** conter "irreversível" em pt-BR (o teste de contrato checa `/irrevers/i` nos 3 idiomas) — traduzir mantendo o equivalente ("irreversible" / "irreversible").

- [ ] **Step 8: Ajustar `web/tests/ui-contract.test.ts`**

- Remover a asserção `expect(readFileSync("app/components/SettingsDialog.tsx", "utf8")).toContain('t("open")')` e `expect(pt.Settings.open).toBe("Configurações")` (a chave `Settings.open` saiu); no lugar, exigir `expect(pt.UserMenu.openSettings).toBe("Config. Sistema")`.
- O teste "settings has an irreversible wipe-everything danger zone" passa a ler `app/components/settings/BackupTab.tsx` (e ainda `lib/store.ts`).
- O teste "has models selector, clear-key and backup export/import" passa a ler `ProvidersTab.tsx` (chave/modelos) e `BackupTab.tsx` (export/import).
- O teste "no hardcoded PT UI strings remain in flows" deve incluir os 3 arquivos novos das abas na lista.

- [ ] **Step 9: Rodar os testes para ver passar**

Run: `cd web && npm test -- --run tests/ui-contract.test.ts tests/i18n.test.ts`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add web/app/components/SettingsDialog.tsx web/app/components/settings/ web/messages/pt-BR.json web/messages/en-US.json web/messages/es-ES.json web/tests/ui-contract.test.ts
git commit -m "feat(settings): redesign em abas com aparencia, providers multi-provedor e backup explicado"
```

---

### Task 7: Onboarding multi-provedor

O passo 2 do wizard passa a escolher o provedor (e não só a chave do Gemini), validando a chave chosen e detectando os modelos.

**Files:**
- Modify: `web/app/components/Onboarding.tsx`
- Modify: `web/messages/pt-BR.json`, `web/messages/en-US.json`, `web/messages/es-ES.json`
- Test: `web/tests/onboarding.test.ts`

**Interfaces:**
- Consumes: `PROVIDERS`, `PROVIDER_IDS`, `providerLabel` (Task 1); `validateProviderKey` (Task 3); `saveSettings` (Task 2).
- Produces: nenhuma API nova (o `Onboarding` continua `export function Onboarding({ onDone }: { onDone: () => void })`).

- [ ] **Step 1: Escrever o teste que falha**

Em `web/tests/onboarding.test.ts`:

```ts
it("onboarding lets the user pick the provider and validates its key", () => {
  const s = readFileSync("app/components/Onboarding.tsx", "utf8");
  expect(s).toContain("PROVIDER_IDS");
  expect(s).toContain("validateProviderKey");
  expect(s).toContain("saveSettings");
  expect(s).not.toContain("https://aistudio.google.com/apikey");  // a URL vem do registro
  const pt = JSON.parse(readFileSync("messages/pt-BR.json", "utf8"));
  expect(pt.Onboarding.pickProvider).toBeTruthy();
});

it("onboarding keeps the 3-step wizard", () => {
  const s = readFileSync("app/components/Onboarding.tsx", "utf8");
  expect(s).toContain("setStep(3)");
  expect(s).toContain("stepName1");
});
```

- [ ] **Step 2: Rodar o teste para ver falhar**

Run: `cd web && npm test -- --run tests/onboarding.test.ts`
Expected: FAIL — `PROVIDER_IDS` não aparece no componente.

- [ ] **Step 3: Implementar o passo 2 com seletor de provedor**

- Estado novo: `provider` (default `"gemini"`), `detected` (string[]).
- No passo 1 (chave): renderizar 4 cards de provedor (`<input type="radio">` nativo, com `role="radio"`/`aria-checked`), cada um com `label` + link "criar chave" (`PROVIDERS[id].keyUrl`).
- O link "criar chave" passa a ser `PROVIDERS[provider].keyUrl` (o literal `https://aistudio.google.com/apikey` sai do componente).
- `onValidateSave`:
  ```ts
  const v = await validateProviderKey(provider, trimmed);
  if (!v.ok) { setError(v.error); return; }
  const detected = await PROVIDERS[provider].listModels(trimmed).catch(() => [] as string[]);
  saveSettings({ provider, keys: { [provider]: trimmed }, detected: { [provider]: detected } });
  setStep(2);
  ```
  (se a detecção falhar, segue com a lista curada — o app não bloqueia o onboarding por causa de CORS).
- O texto do campo de chave usa `PROVIDERS[provider].keyPlaceholder` como placeholder.
- Manter os 3 passos, o stepper, o confete e `setStep(3)` intactos.

- [ ] **Step 4: Chaves de i18n (3 idiomas)**

`Onboarding`: `pickProvider` "Provedor de IA" · `providerDesc` "Escolha um provedor. Você pode trocar depois em Configurações." · `connectTitle` "Conectar provedor de IA" · `connectDesc` "Crie a chave e cole abaixo" · `createKeyLink` "Criar chave" · `keyPlaceholder` (agora dinâmico, por provider — remover do messages se não for mais usado; se outro lugar usar, manter) · `validate` "Validar e continuar" · `validating` "Validando…" · `modelsDetected` "{n} modelos detectados".

> O `Onboarding.stepName2` ("Chave Gemini") passa a ser "Chave da IA" / "AI key" / "Clave de IA".

- [ ] **Step 5: Rodar os testes para ver passar**

Run: `cd web && npm test -- --run tests/onboarding.test.ts tests/i18n.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add web/app/components/Onboarding.tsx web/messages/pt-BR.json web/messages/en-US.json web/messages/es-ES.json web/tests/onboarding.test.ts
git commit -m "feat(onboarding): escolha de provedor de IA com validacao e deteccao de modelos"
```

---

### Task 8: Verificação final e documentação

Fecha o trabalho: suíte completa, tipos, build e a documentação que promete BYOK em 4 providers.

**Files:**
- Modify: `web/README.md` (seção de providers/chaves + aviso de segurança)
- Modify: `PROJECT.md` (paridade de features — linha "settings (key, models, backup)")

- [ ] **Step 1: Suíte completa**

Run: `cd web && npm test -- --run`
Expected: todos os testes PASS (nenhum arquivo pulado por erro de import).

- [ ] **Step 2: Tipos**

Run: `cd web && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Build estático**

Run: `cd web && npm run build`
Expected: build ok, `web/out/` gerado.

- [ ] **Step 4: Conferir o app rodando (manual, em `npm run dev`)**

- Dashboard mostra o avatar com as iniciais e a saudação; o dropdown abre com os 3 itens.
- "Imprimir CV Base" abre o PDF; "Reenviar CV Base" abre o dialog de recatalogação.
- "Config. Sistema" abre as 3 abas; o switch de dark mode alterna o tema; o idioma troca; o "Ajuda" abre por cima.
- Na aba "IA": escolher OpenAI, colar chave, "Validar e detectar modelos" lista os modelos e o resumo da ordem de fallback; "Salvar" persiste.
- Na aba "Backup e dados": o preview mostra base/vagas/tamanho; exportar gera o JSON **sem** a chave; importar restaura; "Apagar tudo" limpa tudo.
- Verificar no console que nenhuma requisição foi feita para um domínio do app (só para os providers).

- [ ] **Step 5: Documentação**

- `web/README.md`: adicionar a lista de providers suportados (Gemini, OpenAI, Anthropic, OpenRouter), como trocar o provider ativo, o que o backup inclui/não inclui, e o aviso de que a chave da Anthropic trafega direto do browser para `api.anthropic.com` (header `anthropic-dangerous-direct-browser-access`).
- `PROJECT.md`: na linha de paridade, trocar "settings (key, models, backup)" por "settings (provider + key/models por provider, backup)".

- [ ] **Step 6: Commit**

```bash
git add web/README.md PROJECT.md
git commit -m "docs: providers suportados, backup e aviso de seguranca das chaves"
```
