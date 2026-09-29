# LocalStorage BYOK + Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar o app de Prisma SQLite para localStorage BYOK 100% cliente com onboarding de 3 passos e build estático.

**Architecture:** Next App Router client-side; `lib/store.ts` + `lib/secure-store.ts` como source of truth (`pmcv:*`); LLM via `fetch` direto com chave do usuário; PDF via `@react-pdf/renderer` `toBlob()`; `app/page.tsx` com gate para `<Onboarding/>`.

**Tech Stack:** Next 15, React 19, Zod 3.24, `pdfjs-dist` 4, `@react-pdf/renderer` 4, `secure-ls`, Vitest 3.

**Spec:** `web/docs/superpowers/specs/2026-09-29-localstorage-byok-design.md`

## Global Constraints

- Build final deve ser 100% estático (`output: export` em `web/next.config.ts`), sem Server Actions, sem Route Handlers, sem `process.env.GEMINI_*` em runtime cliente.
- Chaves de storage: `pmcv:base`, `pmcv:apps`, `pmcv:settings`, `pmcv:onboarded` — validadas com Zod no load; itens inválidos descartados sem crash.
- Chave Gemini guardada ofuscada via `secure-ls` (AES); documentar que é anti-leitura-casual, não cofre.
- PDFs nunca persistidos; gerar via `toBlob()` + object URL temporária com revoke.
- Sem migração do `dev.db`; começa zerado + import/export JSON manual.
- TDD: teste falhando antes de cada implementação; commit por tarefa.

## Review Focus

- Chave Gemini inválida/401-403: espera-se bloqueio guiado para o passo Conectar sem persistir lixo nem avançar.
- PDF sem texto selecionável: espera-se erro legível "PDF sem texto selecionável" sem salvar base parcial.
- `localStorage` com JSON corrompido: espera-se fallback para estado vazio válido, sem tela branca.
- `QuotaExceededError` ao salvar: espera-se aviso + botões exportar/limpar, sem perder o que está em memória.
- Múltiplas abas editando: espera-se sincronia via evento `storage` sem duplicar ids.

---

### Task 1: Store + secure-store (source of truth)

**Files:**
- Create: `web/lib/store.ts`
- Create: `web/lib/secure-store.ts`
- Create: `web/tests/store.test.ts`

**Interfaces:**
- Consumes: `ResumeSchema`, `TailorEnvelopeSchema` de `web/lib/resume-schema.ts`; `BaseLang` de `web/lib/llm/prompts.ts`.
- Produces: `loadBase(): StoredBase | null`, `saveBase(b: StoredBase): void`, `loadApps(): StoredApp[]`, `saveApps(a: StoredApp[]): void`, `loadSettings(): Settings`, `saveSettings(s: Settings): void`, `isOnboarded(): boolean`, `setOnboarded(v: boolean): void`, `exportBackup(): string`, `importBackup(json: string): void`, tipos `StoredBase`, `StoredApp`, `Settings`.

- [ ] **Step 1: Write the failing test**

```ts
// web/tests/store.test.ts
import { describe, expect, it, beforeEach, vi } from "vitest";
import { saveBase, loadBase, saveApps, loadApps, saveSettings, loadSettings, exportBackup, importBackup } from "@/lib/store";

const base = { resume: { cabecalho: { nome: "Ana", titulo_profissional: "Dev", contatos: [{ tipo: "email", valor: "a@a.com", link: null }] }, secoes: { resumo: "X", experiencia: [], formacao: [], habilidades: [], certificacoes: [], idiomas: [], projetos: [] } }, lang: "pt-BR" as const, updatedAt: new Date().toISOString() };

beforeEach(() => localStorage.clear());

describe("store", () => {
  it("round-trips base", () => {
    saveBase(base);
    expect(loadBase()?.resume.cabecalho.nome).toBe("Ana");
  });
  it("rejects corrupted JSON with empty fallback", () => {
    localStorage.setItem("pmcv:apps", "[[[");
    expect(loadApps()).toEqual([]);
  });
  it("exports and imports backup", () => {
    saveBase(base); saveApps([]);
    const json = exportBackup();
    localStorage.clear();
    importBackup(json);
    expect(loadBase()?.resume.cabecalho.nome).toBe("Ana");
  });
  it("surfaces quota errors with guidance", () => {
    const big = "x".repeat(100);
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => { throw new DOMException("full", "QuotaExceededError"); });
    expect(() => saveApps([{ id: "1", jobText: big, fileName: "f.pdf", resume: base.resume, cargo: "Vaga", empresa: "Empresa", matchPercent: 0, strengths: ["a"], weaknesses: ["b"], emailBody: "e", chatMessage: "c", status: "done", errorLog: "", lang: "pt-BR", createdAt: new Date().toISOString() }])).toThrow(/Armazenamento cheio/);
    setItem.mockRestore();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/store.test.ts` (em `web/`)
Expected: FAIL with "Cannot find module '@/lib/store'"

- [ ] **Step 3: Write minimal implementation**

```ts
// web/lib/store.ts
import { z } from "zod";
import { ResumeSchema, TailorEnvelopeSchema } from "./resume-schema";
import { parseBaseLang, type BaseLang } from "./llm/prompts";
import { getSecure, setSecure, removeSecure } from "./secure-store";

export const StoredBaseSchema = z.object({ resume: ResumeSchema, lang: z.enum(["pt-BR", "en", "es"]), updatedAt: z.string() });
export type StoredBase = z.infer<typeof StoredBaseSchema>;
export const StoredAppSchema = TailorEnvelopeSchema.extend({ id: z.string().min(1), jobText: z.string(), fileName: z.string(), status: z.enum(["done", "failed"]), errorLog: z.string().default(""), createdAt: z.string() });
export type StoredApp = z.infer<typeof StoredAppSchema>;
export const SettingsSchema = z.object({ geminiKey: z.string().default(""), models: z.array(z.string()).min(1).default(["gemini-3-flash-preview", "gemini-2.5-flash", "gemini-2.5-flash-lite"]) });
export type Settings = z.infer<typeof SettingsSchema>;

function read<T>(key: string, schema: z.ZodType<T>, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return schema.parse(JSON.parse(raw));
  } catch { return fallback; }
}
function readArr(key: string): StoredApp[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    const out: StoredApp[] = [];
    for (const item of arr) { try { out.push(StoredAppSchema.parse(item)); } catch { /* descarta item inválido */ } }
    return out;
  } catch { return []; }
}
export function loadBase(): StoredBase | null { try { const raw = localStorage.getItem("pmcv:base"); if (!raw) return null; return StoredBaseSchema.parse(JSON.parse(raw)); } catch { return null; } }
export function saveBase(b: StoredBase): void { localStorage.setItem("pmcv:base", JSON.stringify(StoredBaseSchema.parse(b))); }
export function loadApps(): StoredApp[] { return readArr("pmcv:apps"); }
export function saveApps(a: StoredApp[]): void {
  try { localStorage.setItem("pmcv:apps", JSON.stringify(a)); }
  catch (e) { if (e instanceof DOMException && e.name === "QuotaExceededError") throw new Error("Armazenamento cheio — exporte o backup e limpe itens antigos."); throw e; }
}
export function loadSettings(): Settings { try { const s = getSecure("pmcv:settings"); if (!s) return SettingsSchema.parse({}); return SettingsSchema.parse(JSON.parse(s)); } catch { return SettingsSchema.parse({}); } }
export function saveSettings(s: Settings): void { setSecure("pmcv:settings", JSON.stringify(SettingsSchema.parse(s))); }
export function clearSettings(): void { removeSecure("pmcv:settings"); }
export function isOnboarded(): boolean { return localStorage.getItem("pmcv:onboarded") === "1" && !!loadSettings().geminiKey && !!loadBase(); }
export function setOnboarded(v: boolean): void { localStorage.setItem("pmcv:onboarded", v ? "1" : "0"); }
export function exportBackup(): string { return JSON.stringify({ base: loadBase(), apps: loadApps(), exportedAt: new Date().toISOString() }); }
export function importBackup(json: string): void {
  const parsed = z.object({ base: StoredBaseSchema.nullable(), apps: z.array(StoredAppSchema) }).parse(JSON.parse(json));
  if (parsed.base) saveBase(parsed.base); localStorage.setItem("pmcv:apps", JSON.stringify(parsed.apps));
}
export function touchUpdatedAt(): string { return new Date().toISOString(); }
export type { BaseLang };
export { parseBaseLang };
```

```ts
// web/lib/secure-store.ts
import SecureLS from "secure-ls";
const ls = new SecureLS({ encodingType: "aes" });
export function getSecure(key: string): string | null { try { return ls.get(key) as string | null; } catch { return localStorage.getItem(key); } }
export function setSecure(key: string, value: string): void { try { ls.set(key, value); } catch { localStorage.setItem(key, value); } }
export function removeSecure(key: string): void { try { ls.remove(key); } catch { localStorage.removeItem(key); } }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run tests/store.test.ts` (em `web/`)
Expected: PASS (3 testes). Depois rode a suite parcial: `npm test -- --run tests/resume-schema.test.ts tests/tailor.test.ts`
Expected: PASS sem regressão.

- [ ] **Step 5: Commit**

```bash
git add web/lib/store.ts web/lib/secure-store.ts web/tests/store.test.ts
git commit -m "feat: store localStorage + secure-store com testes"
```

### Task 2: LLM client-safe com chave por parâmetro + validar chave

**Files:**
- Modify: `web/lib/llm/gemini.ts`
- Modify: `web/lib/llm/chain.ts`
- Modify: `web/tests/llm-chain.test.ts`
- Test: `web/tests/llm-chain.test.ts` (validar chave 401 + fallback)

**Interfaces:**
- Consumes: tipos de `web/lib/store.ts` (`Settings`) para obter `key`/`models`.
- Produces: `geminiModels(models?: string[]): string[]`, `chatJsonGemini(system: string, user: string, key: string, model?: string): Promise<unknown>`, `generateJson(system: string, user: string, key: string, models?: string[]): Promise<{ data: unknown; provider: string }>`, `validateGeminiKey(key: string): Promise<{ ok: true } | { ok: false; error: string }>`.

- [ ] **Step 1: Write the failing test**

```ts
// adicionar em web/tests/llm-chain.test.ts
import { describe, expect, it, vi } from "vitest";
import { generateJson } from "@/lib/llm/chain";
import { validateGeminiKey } from "@/lib/llm/chain";

describe("byok", () => {
  it("passes key in query string", async () => {
    const fetch = vi.fn(async () => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"ok":1}' }] } }] }) }));
    vi.stubGlobal("fetch", fetch);
    await generateJson("s", "u", "KEY123");
    expect(String(fetch.mock.calls[0][0])).toContain("key=KEY123");
    vi.unstubAllGlobals();
  });
  it("validateKey reports 401 as invalid", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 401, text: async () => "bad key" })));
    const r = await validateGeminiKey("BAD");
    expect(r.ok).toBe(false);
    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/llm-chain.test.ts` (em `web/`)
Expected: FAIL (generateJson espera 2 args, validateGeminiKey não existe)

- [ ] **Step 3: Write minimal implementation**

```ts
// web/lib/llm/gemini.ts (substituir inteiro)
export const DEFAULT_GEMINI_MODELS = ["gemini-3-flash-preview", "gemini-2.5-flash", "gemini-2.5-flash-lite"];
export function geminiModels(models?: string[]): string[] {
  if (models && models.length) return models.map((s) => s.trim()).filter(Boolean);
  return [...DEFAULT_GEMINI_MODELS];
}
export async function chatJsonGemini(system: string, user: string, key: string, model = geminiModels()[0]): Promise<unknown> {
  if (!key) throw new Error("Configure a chave Gemini no onboarding.");
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 60_000);
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
      method: "POST", signal: ctl.signal, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system_instruction: { parts: [{ text: system }] }, contents: [{ parts: [{ text: user }] }], generationConfig: { responseMimeType: "application/json" } }),
    });
    if (res.status === 401 || res.status === 403) throw new Error("Chave Gemini inválida (401/403). Confira em https://aistudio.google.com/apikey");
    if (!res.ok) throw new Error(`gemini ${res.status}: ${await res.text()}`);
    const j = (await res.json()) as { candidates: { content: { parts: { text: string }[] } }[] };
    const text = j.candidates?.[0]?.content?.parts?.map((p) => p.text).join("");
    if (typeof text !== "string" || !text.trim()) throw new Error("gemini: resposta vazia da IA.");
    const { extractJson } = await import("@/lib/json-text");
    return JSON.parse(extractJson(text));
  } finally { clearTimeout(t); }
}
```

```ts
// web/lib/llm/chain.ts (substituir inteiro)
import { chatJsonGemini, geminiModels } from "./gemini";
export type Provider = string;
export async function generateJson(system: string, user: string, key: string, models?: string[]): Promise<{ data: unknown; provider: Provider }> {
  const errs: string[] = [];
  for (const model of geminiModels(models)) {
    try { return { data: await chatJsonGemini(system, user, key, model), provider: `gemini:${model}` }; }
    catch (e) { errs.push(`${model}: ${(e as Error).message}`); }
  }
  throw new Error(errs.join(" | "));
}
export async function validateGeminiKey(key: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!key.trim()) return { ok: false, error: "Cole uma chave." };
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`);
    if (res.status === 401 || res.status === 403) return { ok: false, error: "Chave inválida (401/403). Gere em https://aistudio.google.com/apikey" };
    if (!res.ok) return { ok: false, error: `Falha ao validar: ${res.status}` };
    return { ok: true };
  } catch (e) { return { ok: false, error: (e as Error).message.slice(0, 300) }; }
}
```

Nota: atualizar os testes antigos de `geminiModels()` que liam `process.env.GEMINI_MODELS` para passar lista por parâmetro: `geminiModels([" gemini-2.5-flash ,, gemini-2.5-flash-lite "])` deve retornar `["gemini-2.5-flash", "gemini-2.5-flash-lite"]`; e `generateJson("s","u","K")` nos 3 testes de fallback.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run tests/llm-chain.test.ts` (em `web/`)
Expected: PASS (7 testes: 5 antigos adaptados + 2 novos)

- [ ] **Step 5: Commit**

```bash
git add web/lib/llm/gemini.ts web/lib/llm/chain.ts web/tests/llm-chain.test.ts
git commit -m "feat: LLM client-safe BYOK com validacao de chave"
```

### Task 3: Extração de PDF no browser + PDF on-demand

**Files:**
- Create: `web/lib/cv-text-client.ts`
- Create: `web/lib/pdf/client.ts`
- Create: `web/tests/cv-text-client.test.ts`
- Create: `web/tests/pdf-client.test.ts`

**Interfaces:**
- Consumes: `cvElement` de `web/lib/pdf/CVDocument.tsx`; `Resume` de `web/lib/resume-schema.ts`.
- Produces: `extractCvTextFromFile(file: File): Promise<string>`, `resumeToBlob(resume: Resume, lang: BaseLang): Promise<Blob>`, `openResumePdf(resume: Resume, lang: BaseLang): Promise<void>`.

- [ ] **Step 1: Write the failing test**

```ts
// web/tests/cv-text-client.test.ts
import { describe, expect, it } from "vitest";
import { extractCvTextFromFile } from "@/lib/cv-text-client";
describe("cv-text-client", () => {
  it("rejects non-pdf", async () => {
    await expect(extractCvTextFromFile(new File(["x"], "a.txt", { type: "text/plain" }))).rejects.toThrow(/PDF/);
  });
});
```

```ts
// web/tests/pdf-client.test.ts
import { describe, expect, it } from "vitest";
import { resumeToBlob } from "@/lib/pdf/client";
const resume: any = { cabecalho: { nome: "Ana", titulo_profissional: "Dev", contatos: [{ tipo: "email", valor: "a@a.com", link: null }] }, secoes: { resumo: "X", experiencia: [], formacao: [], habilidades: [], certificacoes: [], idiomas: [], projetos: [] } };
describe("pdf-client", () => {
  it("generates a pdf blob", async () => {
    const b = await resumeToBlob(resume, "pt-BR");
    expect(b.type).toBe("application/pdf");
    expect(b.size).toBeGreaterThan(500);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run tests/cv-text-client.test.ts tests/pdf-client.test.ts` (em `web/`)
Expected: FAIL (módulos não existem)

- [ ] **Step 3: Write minimal implementation**

```ts
// web/lib/cv-text-client.ts
export async function extractCvTextFromFile(file: File): Promise<string> {
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) throw new Error("Envie um arquivo PDF.");
  const buf = new Uint8Array(await file.arrayBuffer());
  if (buf.length < 100) throw new Error("PDF inválido ou vazio.");
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  try {
    let out = "";
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const tc = await page.getTextContent();
      out += tc.items.map((it) => ("str" in (it as object) ? (it as { str: string }).str : "")).join(" ") + "\n";
    }
    const text = out.trim();
    if (!text) throw new Error("PDF sem texto selecionável — envie um PDF com texto, não escaneado.");
    return text;
  } finally { await doc.destroy(); }
}
```

```ts
// web/lib/pdf/client.ts
import { pdf } from "@react-pdf/renderer";
import { cvElement } from "./CVDocument";
import type { Resume } from "@/lib/resume-schema";
import type { BaseLang } from "@/lib/llm/prompts";
export async function resumeToBlob(resume: Resume, lang: BaseLang): Promise<Blob> {
  return pdf(cvElement(resume, lang)).toBlob();
}
export async function openResumePdf(resume: Resume, lang: BaseLang): Promise<void> {
  const blob = await resumeToBlob(resume, lang);
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run tests/cv-text-client.test.ts tests/pdf-client.test.ts` (em `web/`)
Expected: PASS (2 testes)

- [ ] **Step 5: Commit**

```bash
git add web/lib/cv-text-client.ts web/lib/pdf/client.ts web/tests/cv-text-client.test.ts web/tests/pdf-client.test.ts
git commit -m "feat: extracao PDF browser + PDF on-demand"
```

### Task 4: Onboarding wizard + gate

**Files:**
- Create: `web/app/components/Onboarding.tsx`
- Create: `web/tests/onboarding.test.ts`
- Modify: `web/app/page.tsx`
- Modify: `web/app/components/SettingsDialog.tsx` (criar se não existir; usa `loadSettings/saveSettings`)

**Interfaces:**
- Consumes: `loadBase/saveBase/loadSettings/saveSettings/setOnboarded` de `@/lib/store`; `validateGeminiKey/generateJson` de `@/lib/llm/chain`; `extractCvTextFromFile` de `@/lib/cv-text-client`; `normalizeResume` de `@/lib/tailor`.
- Produces: `<Onboarding onDone(): void>` com 3 passos internos; `page.tsx` renderiza `<Onboarding/>` se `!key || !base`, senão dashboard atual.

- [ ] **Step 1: Write the failing test**

```ts
// web/tests/onboarding.test.ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
describe("onboarding", () => {
  it("has 3-step wizard with apikey link", () => {
    const s = readFileSync("app/components/Onboarding.tsx", "utf8");
    expect(s).toMatch(/Bem-vindo|Como funciona/);
    expect(s).toContain("https://aistudio.google.com/apikey");
    expect(s).toMatch(/Criar base|Gerar.*base/);
  });
  it("page gates on key/base", () => {
    const s = readFileSync("app/page.tsx", "utf8");
    expect(s).toContain("Onboarding");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/onboarding.test.ts` (em `web/`)
Expected: FAIL (arquivo não existe)

- [ ] **Step 3: Write minimal implementation**

```tsx
// web/app/components/Onboarding.tsx ("use client"; wizard com useState step: 0|1|2)
// Passo 0: Card Bem-vindo com 3 bullets + Button "Começar"
// Passo 1: Card Conectar Gemini: <a href="https://aistudio.google.com/apikey" target="_blank">Criar chave</a>, input password, Button Validar (validateGeminiKey), Button Salvar e continuar (saveSettings + setStep(2)); erro 401 mostra guia
// Passo 2: file input + Select lang + Button Criar base: extractCvTextFromFile(file).slice(0,12000) -> generateJson(buildBaseExtractSystem(lang), text, key, models) -> normalizeResume(data) com 1x repair (buildRepairUser) -> saveBase({resume, lang, updatedAt}) -> setOnboarded(true) -> onDone()
// Progress: "Passo X de 3", back/next desabilitados durante loading, mesmos STAGES do BaseSetup
```

```tsx
// web/app/components/Onboarding.tsx
"use client";
import { useState } from "react";
import { toast } from "sonner";
import { validateGeminiKey, generateJson } from "@/lib/llm/chain";
import { buildBaseExtractSystem, buildRepairUser, type BaseLang } from "@/lib/llm/prompts";
import { extractCvTextFromFile } from "@/lib/cv-text-client";
import { normalizeResume } from "@/lib/tailor";
import { loadSettings, saveSettings, saveBase, setOnboarded } from "@/lib/store";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";

export function Onboarding({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [key, setKey] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [lang, setLang] = useState<BaseLang>("pt-BR");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onValidateSave() {
    setError(""); setLoading(true);
    try {
      const v = await validateGeminiKey(key);
      if (!v.ok) { setError(v.error); return; }
      const cur = loadSettings();
      saveSettings({ ...cur, geminiKey: key.trim() });
      setStep(2);
    } finally { setLoading(false); }
  }

  async function onCreateBase() {
    if (!file) return;
    setError(""); setLoading(true);
    try {
      const settings = loadSettings();
      const text = await extractCvTextFromFile(file);
      const system = buildBaseExtractSystem(lang);
      const { data } = await generateJson(system, text.slice(0, 12000), settings.geminiKey, settings.models);
      let resume;
      try { resume = normalizeResume(data); }
      catch (zerr) {
        const { data: fixed } = await generateJson(system, buildRepairUser(JSON.stringify(data), String(zerr)), settings.geminiKey, settings.models);
        resume = normalizeResume(fixed);
      }
      saveBase({ resume, lang, updatedAt: new Date().toISOString() });
      setOnboarded(true);
      toast.success("Currículo base criado!");
      onDone();
    } catch (e) { setError((e as Error).message.slice(0, 500)); }
    finally { setLoading(false); }
  }

  if (step === 0) return (
    <Card><CardHeader><CardTitle>Bem-vindo ao Personalize My CV</CardTitle>
    <CardDescription>Como funciona</CardDescription></CardHeader>
    <CardContent className="space-y-2 text-sm">
      <p>1. Você cadastra seu currículo base em PDF — a IA cataloga tudo em JSON.</p>
      <p>2. Para cada vaga, geramos um CV sob medida com match, pontos fortes/fracos, email e mensagem.</p>
      <p>3. Tudo fica no seu browser (localStorage) com sua própria chave Gemini.</p>
      <Button onClick={() => setStep(1)}>Começar</Button>
    </CardContent></Card>
  );
  if (step === 1) return (
    <Card><CardHeader><CardTitle>Conectar Gemini</CardTitle>
    <CardDescription>Crie sua chave e cole abaixo</CardDescription></CardHeader>
    <CardContent className="space-y-3">
      <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" className="text-sm underline">Criar chave em aistudio.google.com/apikey</a>
      <input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Cole a GEMINI_API_KEY" className="w-full rounded border p-2 text-sm" disabled={loading} />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setStep(0)} disabled={loading}>Voltar</Button>
        <Button onClick={onValidateSave} disabled={loading || !key.trim()}>{loading ? "Validando…" : "Validar e continuar"}</Button>
      </div>
    </CardContent></Card>
  );
  return (
    <Card><CardHeader><CardTitle>Criar base</CardTitle>
    <CardDescription>Envie seu currículo em PDF para a IA catalogar</CardDescription></CardHeader>
    <CardContent className="space-y-3">
      <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} disabled={loading} />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setStep(1)} disabled={loading}>Voltar</Button>
        <Button onClick={onCreateBase} disabled={loading || !file}>{loading ? "Criando base…" : "Criar currículo base"}</Button>
      </div>
    </CardContent></Card>
  );
}
```

Implementação segue o padrão visual de `BaseSetup.tsx` (Dropzone, Select de idioma, `useStagedSteps`, toast sonner). `page.tsx` vira `"use client"` com `useEffect` lendo store (`loadSettings().geminiKey`, `loadBase()`) e `useState` de loading/gate; enquanto carrega mostra `app/loading.tsx`; sem chave/base mostra `<Onboarding onDone={() => window.location.reload()}/>`, senão o dashboard atual (props `apps` agora vêm de `loadApps()` no cliente — ver Task 5).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run tests/onboarding.test.ts tests/store.test.ts` (em `web/`)
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/app/components/Onboarding.tsx web/tests/onboarding.test.ts web/app/page.tsx
git commit -m "feat: onboarding 3 passos com gate"
```

### Task 5: Dashboard 100% cliente (lista, gerar, retry, delete, relatórios)

**Files:**
- Modify: `web/app/components/GenerateModal.tsx`
- Modify: `web/app/components/VacancyTable.tsx`
- Modify: `web/app/components/DetailDrawer.tsx`
- Modify: `web/app/components/ReportsSection.tsx`
- Modify: `web/app/components/DashboardTabs.tsx`
- Modify: `web/app/components/BaseMenu.tsx` (trocar print/upload por `openResumePdf` + re-onboarding)
- Test: `web/tests/ui-contract.test.ts` (atualizar `AppRow.id: string`, sem `pdfPath` em disco)

**Interfaces:**
- Consumes: `loadBase/loadApps/saveApps/loadSettings` de `@/lib/store`; `generateJson` de `@/lib/llm/chain`; `normalizeEnvelope` de `@/lib/tailor`; `buildFileName/buildFailedFileName` de `@/lib/filename`; `resumeToBlob/openResumePdf` de `@/lib/pdf/client`.
- Produces: mesmos componentes com props `apps: StoredApp[]` (id string, campo `resume` do envelope, sem `pdfPath` em disco); download via blob URL; retry/delete só no store.

- [ ] **Step 1: Write the failing test**

```ts
// acrescentar em web/tests/ui-contract.test.ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
describe("client dashboard", () => {
  it("GenerateModal uses store+generateJson, not actions", () => {
    const s = readFileSync("app/components/GenerateModal.tsx", "utf8");
    expect(s).toContain("@/lib/store");
    expect(s).not.toContain("../actions");
  });
  it("VacancyTable deletes from store", () => {
    const s = readFileSync("app/components/VacancyTable.tsx", "utf8");
    expect(s).toContain("saveApps");
  });
  it("dashboard syncs across tabs", () => {
    const s = readFileSync("app/components/DashboardTabs.tsx", "utf8");
    expect(s).toContain("storage");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/ui-contract.test.ts` (em `web/`)
Expected: FAIL (ainda importa `../actions`)

- [ ] **Step 3: Write minimal implementation**

- `GenerateModal`: substitui `tailorResume(jobText, lang)` pelo fluxo cliente abaixo; sem `window.location.reload` global — usa callback `onChanged` ou evento `storage`.

```ts
import { loadBase, loadApps, saveApps, loadSettings } from "@/lib/store";
import { generateJson } from "@/lib/llm/chain";
import { buildTailorSystem, buildTailorUser, buildRepairUser } from "@/lib/llm/prompts";
import { normalizeEnvelope } from "@/lib/tailor";
import { buildFileName, buildFailedFileName } from "@/lib/filename";

async function runTailor(jobText: string, lang: "pt-BR" | "en" | "es") {
  const base = loadBase();
  if (!base) throw new Error("Cadastre o currículo base primeiro.");
  const settings = loadSettings();
  const { data } = await generateJson(buildTailorSystem(lang), buildTailorUser(JSON.stringify(base.resume), jobText), settings.geminiKey, settings.models);
  let env;
  try { env = normalizeEnvelope(data, lang, base.resume); }
  catch (zerr) {
    const { data: fixed } = await generateJson(buildTailorSystem(lang), buildRepairUser(JSON.stringify(data), String(zerr)), settings.geminiKey, settings.models);
    env = normalizeEnvelope(fixed, lang, base.resume);
  }
  const apps = loadApps();
  saveApps([...apps, { ...env, id: crypto.randomUUID(), jobText, fileName: buildFileName(env.resume.cabecalho.nome, env.cargo, env.empresa), status: "done" as const, errorLog: "", createdAt: new Date().toISOString() }]);
}
```
- `VacancyTable`: `AppRow` com `id: string`; `onDelete` = `saveApps(apps.filter(...))`; `onRetry` = re-executa `runTailor` acima e atualiza o item; download/print abaixo; remove links `/api/applications/.../pdf` e `app.pdfPath` em disco.

```ts
import { resumeToBlob, openResumePdf } from "@/lib/pdf/client";
async function downloadPdf(app: StoredApp) {
  const blob = await resumeToBlob(app.resume, app.lang);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = app.fileName; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
```
- `ReportsSection`: calcula `weekRange/bucketByWeekday` sobre `loadApps().map(a => new Date(a.createdAt))` no cliente (remove `getWeekStats` server).
- `BaseMenu`: "Imprimir base" → `openResumePdf(base.resume, base.lang)`; "Atualizar" → volta ao passo 2 do onboarding ou reabre `BaseSetup` cliente.
- `DashboardTabs`: recebe `apps` do store via hook + `storage` listener para multi-aba.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run tests/ui-contract.test.ts tests/reports.test.ts tests/pagination.test.ts` (em `web/`)
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/app/components/GenerateModal.tsx web/app/components/VacancyTable.tsx web/app/components/DetailDrawer.tsx web/app/components/ReportsSection.tsx web/app/components/DashboardTabs.tsx web/app/components/BaseMenu.tsx web/tests/ui-contract.test.ts
git commit -m "feat: dashboard 100% cliente via store"
```

### Task 6: Export estático + limpeza Prisma/server + docs

**Files:**
- Modify: `web/next.config.ts`
- Modify: `web/package.json`
- Modify: `web/.gitignore`
- Modify: `web/tests/smoke.test.ts`
- Modify: `web/README.md`
- Delete: `web/lib/db.ts`, `web/prisma/`, `web/app/actions.ts`, `web/app/api/`, `web/public/generated/`, `web/.env.example`, `web/lib/cv-text.ts` (server)

**Interfaces:**
- Consumes: todas as tasks anteriores (nada pode importar `@/lib/db`, `../actions` ou `/api/`).
- Produces: `npm run build` gera `web/out/`; `npm test` verde sem Prisma.

- [ ] **Step 1: Write the failing test**

```ts
// web/tests/smoke.test.ts (substituir inteiro)
import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
describe("static byok", () => {
  it("next config is export", () => {
    expect(readFileSync("next.config.ts", "utf8")).toContain("output: \"export\"");
  });
  it("no server leftovers", () => {
    expect(existsSync("lib/db.ts")).toBe(false);
    expect(existsSync("prisma")).toBe(false);
    expect(existsSync("app/actions.ts")).toBe(false);
    expect(existsSync("app/api")).toBe(false);
  });
  it("store keys documented", () => {
    expect(readFileSync("lib/store.ts", "utf8")).toContain("pmcv:base");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/smoke.test.ts` (em `web/`)
Expected: FAIL (ainda tem prisma/actions, sem output export)

- [ ] **Step 3: Write minimal implementation**

```ts
// web/next.config.ts
import type { NextConfig } from "next";
const nextConfig: NextConfig = { output: "export" };
export default nextConfig;
```

```json
// web/package.json: scripts -> { "dev": "next dev", "build": "next build", "start": "next start", "test": "vitest run" }; remover deps @prisma/client, prisma; adicionar secure-ls
```

```bash
npm rm @prisma/client prisma && npm i secure-ls
rm -rf lib/db.ts prisma app/actions.ts "app/api" public/generated lib/cv-text.ts .env.example
```

`.gitignore`: remover linhas `prisma/dev.db*` e `/public/generated/*.pdf`; adicionar `/out/`. `README.md`: trocar `npx prisma migrate dev` por "1. npm i 2. npm run dev 3. complete o onboarding (chave em https://aistudio.google.com/apikey)"; documentar backup import/export e aviso secure-ls = ofuscação.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run` (em `web/`)
Expected: PASS (toda a suite verde)

Run: `npm run build` (em `web/`)
Expected: PASS com pasta `out/` gerada

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: export estatico, remove prisma/server"
```
