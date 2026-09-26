# Personalize My CV Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir o MVP tela-única que cria o default JSON do CV via LLM e gera PDFs otimizados por vaga com análise e mensagens.

**Architecture:** Next.js App Router + Server Actions síncronas; Prisma SQLite (`prisma/dev.db`); chain LLM Zen → Gemini → OpenRouter com `generateJson`; PDF via `@react-pdf/renderer` em `renderToFile(public/generated/...)`.

**Tech Stack:** Next.js 15 (App Router, TS), Tailwind, Prisma 6 + SQLite, Zod 3, @react-pdf/renderer 4, pdfjs-dist 4, vitest.

**Spec:** `docs/superpowers/specs/2026-09-25-personalize-my-cv-design.md`

## Global Constraints

- Persistência em SQLite via Prisma; models `BaseResume` e `TailoredApplication` exatamente como na spec.
- Fallback LLM nesta ordem: Zen → Gemini → OpenRouter; timeout 60s por provider; falha total salva `status="failed"` + `errorLog` + botão retry.
- PDF via `@react-pdf/renderer` com `StyleSheet.create` (Tailwind só na UI da página, nunca no PDF).
- Schema Zod canônico é a estrutura 2 (`cabecalho` + `secoes` resumo/experiencia/formacao/habilidades/certificacoes/idiomas/projetos); datas `YYYY-MM`; `local` nullable.
- Filename: `sanitize(nome)_sanitize(cargo)_sanitize(empresa)_YYYYMMDD-HHmmss.pdf` em `public/generated/`, sanitize remove `\/|:*?"<>` e troca espaços por `_`.
- Tela única `app/page.tsx`, sem auth, sem fila, MVP local.
- Env vars: `OPENCODE_ZEN_API_KEY`, `OPENCODE_ZEN_MODEL` (default `glm-4.6`), `OPENCODE_ZEN_BASE_URL` (default `https://opencode.ai/zen/v1`), `GEMINI_API_KEY`, `GEMINI_MODEL` (default `gemini-2.5-flash`), `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` (default `openai/gpt-oss-20b:free`).

## Review Focus

- PDF escaneado/imagem retorna texto vazio → espera-se erro legível "PDF sem texto selecionável", não linha `failed` silenciosa.
- Vaga sem cargo/empresa explícitos → espera-se defaults `cargo="Vaga"`, `empresa="Empresa"` e filename válido.
- LLM retorna JSON embrulhado em markdown (```json ... ```) → espera-se extração e parse com sucesso, não erro de JSON.
- Nome/cargo com acentos, espaços e `/` (ex. "Desenvolvedor Front-end/React") → espera-se filename sem `/` e sem crash no `renderToFile`.
- Datas do CV em pt-BR ("Ago 2025 – atual", "Jul 2021 - Set 2022") → espera-se normalização para `YYYY-MM` + `atual:true`, não rejeição Zod.

---

### Task 1: Scaffolding Next.js + Tailwind + Prisma + deps + vitest

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`, `app/globals.css`, `app/layout.tsx`, `.env.example`, `.gitignore` (edit), `vitest.config.ts`, `prisma/schema.prisma`
- Test: `tests/smoke.test.ts`

**Interfaces:**
- Consumes: nada (primeira task).
- Produces: app Next bootável (`npm run dev`), `prisma` CLI disponível, `npx vitest run` funcional, `.env.example` com as 7 vars.

- [ ] **Step 1: Write the failing test**

```ts
// tests/smoke.test.ts
import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";

describe("scaffolding", () => {
  it("has env example with all providers", () => {
    const env = readFileSync(".env.example", "utf8");
    for (const k of ["OPENCODE_ZEN_API_KEY", "GEMINI_API_KEY", "OPENROUTER_API_KEY"]) {
      expect(env).toContain(k);
    }
  });
  it("has prisma schema with both models", () => {
    const s = readFileSync("prisma/schema.prisma", "utf8");
    expect(s).toContain("model BaseResume");
    expect(s).toContain("model TailoredApplication");
  });
  it("has generated dir gitkeep", () => {
    expect(existsSync("public/generated/.gitkeep")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/smoke.test.ts`
Expected: FAIL (arquivos não existem).

- [ ] **Step 3: Scaffold Next + install deps**

Run:
```bash
npx create-next-app@latest . --typescript --tailwind --app --src-dir=false --import-alias="@/*" --use-npm --no-git
npm i prisma @prisma/client zod @react-pdf/renderer pdfjs-dist
npm i -D vitest @vitejs/plugin-react
mkdir -p public/generated lib/llm lib/pdf tests docs/superpowers/plans
touch public/generated/.gitkeep
npx prisma init --datasource-provider sqlite
```

`prisma/schema.prisma` (sobrescrever o gerado):
```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "sqlite"; url = "file:./dev.db" }
model BaseResume {
  id        Int      @id @default(1)
  json      String
  updatedAt DateTime @updatedAt
}
model TailoredApplication {
  id           Int      @id @default(autoincrement())
  jobText      String
  cargo        String   @default("Vaga")
  empresa      String   @default("Empresa")
  fileName     String   @unique
  pdfPath      String
  matchPercent Int      @default(0)
  strengths    String
  weaknesses   String
  emailBody    String   @default("")
  chatMessage  String   @default("")
  status       String   @default("done")
  errorLog     String   @default("")
  createdAt    DateTime @default(now())
}
```

`.env.example`:
```
OPENCODE_ZEN_API_KEY=
OPENCODE_ZEN_MODEL=glm-4.6
OPENCODE_ZEN_BASE_URL=https://opencode.ai/zen/v1
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
OPENROUTER_API_KEY=
OPENROUTER_MODEL=openai/gpt-oss-20b:free
```

`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
export default defineConfig({ test: { include: ["tests/**/*.test.ts"] } });
```

Append em `.gitignore`: `.env`, `prisma/dev.db*`, `/public/generated/*.pdf`, `node_modules/.cache`.

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npx vitest run tests/smoke.test.ts
npx tsc --noEmit
npx prisma validate
```
Expected: PASS (3 testes), tsc sem erro, prisma OK.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: scaffold next+tailwind+prisma+vitest"
```

---

### Task 2: Schema Zod canônico (estrutura 2) + normalização de datas

**Files:**
- Create: `lib/resume-schema.ts`
- Test: `tests/resume-schema.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `ResumeSchema`, `TailorEnvelopeSchema`, tipos `Resume`, `TailorEnvelope`, `parseResumeнял` não — exato: `parseResume(json: unknown): Resume`, `parseEnvelope(json: unknown): TailorEnvelope`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/resume-schema.test.ts
import { describe, expect, it } from "vitest";
import { parseResume } from "@/lib/resume-schema";

const valid = {
  cabecalho: { nome: "Filipe de Leonel Batista", titulo_profissional: "Desenvolvedor Front-end",
    contatos: [{ tipo: "email", valor: "filipe.x2016@gmail.com", link: "mailto:filipe.x2016@gmail.com" }] },
  secoes: { resumo: "Dev front-end com React.", experiencia: [], formacao: [],
    habilidades: [{ nome: "Front", itens: ["React"] }], certificacoes: [],
    idiomas: [{ idioma: "Português", nivel: "Nativo" }], projetos: [] },
};

describe("parseResume", () => {
  it("accepts minimal valid resume", () => {
    expect(parseResume(valid).cabecalho.nome).toContain("Filipe");
  });
  it("rejects missing nome", () => {
    expect(() => parseResume({ ...valid, cabecalho: { ...valid.cabecalho, nome: "" } })).toThrow();
  });
  it("accepts periodo atual with fim null", () => {
    const r = parseResume({ ...valid, secoes: { ...valid.secoes,
      experiencia: [{ cargo: "Dev", empresa: "CI&T", local: "Remoto",
        periodo: { inicio: "2025-08", fim: null, atual: true },
        descricao: "x", realizacoes: ["y"], tecnologias: ["React"] }] } });
    expect(r.secoes.experiencia[0].periodo.atual).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/resume-schema.test.ts`
Expected: FAIL ("Cannot find module '@/lib/resume-schema'").

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/resume-schema.ts
import { z } from "zod";

export const ContatoSchema = z.object({
  tipo: z.enum(["email", "telefone", "linkedin", "github", "portfolio", "localizacao"]),
  valor: z.string().min(1),
  link: z.string().nullable().default(null),
});
export const PeriodoSchema = z.object({
  inicio: z.string().regex(/^\d{4}-\d{2}$/, "inicio deve ser YYYY-MM"),
  fim: z.string().regex(/^\d{4}-\d{2}$/).nullable().default(null),
  atual: z.boolean().default(false),
});
export const ExperienciaSchema = z.object({
  cargo: z.string().min(1), empresa: z.string().min(1),
  local: z.string().nullable().default(null), periodo: PeriodoSchema,
  descricao: z.string().default(""), realizacoes: z.array(z.string()).default([]),
  tecnologias: z.array(z.string()).default([]),
});
export const FormacaoSchema = z.object({
  curso: z.string().min(1), instituicao: z.string().min(1),
  local: z.string().nullable().default(null), periodo: PeriodoSchema,
  descricao: z.string().nullable().default(null),
});
export const ResumeSchema = z.object({
  cabecalho: z.object({
    nome: z.string().min(1), titulo_profissional: z.string().min(1),
    contatos: z.array(ContatoSchema).min(1),
  }),
  secoes: z.object({
    resumo: z.string().min(1), experiencia: z.array(ExperienciaSchema).default([]),
    formacao: z.array(FormacaoSchema).default([]),
    habilidades: z.array(z.object({ nome: z.string(), itens: z.array(z.string()) })).default([]),
    certificacoes: z.array(z.object({ nome: z.string(), emissor: z.string(), ano: z.number().int(), link: z.string().nullable().default(null) })).default([]),
    idiomas: z.array(z.object({ idioma: z.string(), nivel: z.string() })).default([]),
    projetos: z.array(z.object({ nome: z.string(), descricao: z.string(), link: z.string().nullable().default(null), tecnologias: z.array(z.string()).default([]) })).default([]),
  }),
});
export const TailorEnvelopeSchema = z.object({
  resume: ResumeSchema, cargo: z.string().min(1), empresa: z.string().min(1),
  matchPercent: z.number().int().min(0).max(100),
  strengths: z.array(z.string()).min(1).max(8), weaknesses: z.array(z.string()).min(1).max(8),
  emailBody: z.string().min(1), chatMessage: z.string().min(1),
});
export type Resume = z.infer<typeof ResumeSchema>;
export type TailorEnvelope = z.infer<typeof TailorEnvelopeSchema>;
export function parseResume(json: unknown): Resume { return ResumeSchema.parse(json); }
export function parseEnvelope(json: unknown): TailorEnvelope { return TailorEnvelopeSchema.parse(json); }
```

- [ ] **Step 4: Run test to verify it passes** (+ Review Focus: datas pt-BR viram instrução de prompt, não deste parser — parser exige `YYYY-MM`; teste acima cobre `fim:null`/`atual:true`)

Run: `npx vitest run tests/resume-schema.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add lib/resume-schema.ts tests/resume-schema.test.ts
git commit -m "feat: add resume zod schema v2"
```

---

### Task 3: filename util + strip de markdown JSON

**Files:**
- Create: `lib/filename.ts`, `lib/json-text.ts`
- Test: `tests/filename.test.ts`, `tests/json-text.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `buildFileName(nome, cargo, empresa: string, now?: Date): string`, `sanitizePart(s: string): string`, `extractJson(raw: string): string`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/filename.test.ts
import { describe, expect, it } from "vitest";
import { buildFileName } from "@/lib/filename";
describe("buildFileName", () => {
  it("builds Nome_Cargo_Empresa_timestamp", () => {
    const f = buildFileName("Filipe de Leonel Batista", "Front-end React", "CI&T", new Date("2026-09-25T14:30:00"));
    expect(f).toBe("Filipe_de_Leonel_Batista_Front-end_React_CI&T_20260925-143000.pdf");
  });
  it("strips slashes and colons", () => {
    const f = buildFileName("A", "Front-end/React", "X:Y", new Date("2026-01-02T03:04:05"));
    expect(f).not.toContain("/");
    expect(f).not.toContain(":");
    expect(f.endsWith(".pdf")).toBe(true);
  });
});
// tests/json-text.test.ts
import { describe, expect, it } from "vitest";
import { extractJson } from "@/lib/json-text";
describe("extractJson", () => {
  it("unwraps ```json fences", () => {
    expect(JSON.parse(extractJson('```json\n{"a":1}\n```'))).toEqual({ a: 1 });
  });
  it("passes plain json through", () => {
    expect(JSON.parse(extractJson('{"a":2}'))).toEqual({ a: 2 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/filename.test.ts tests/json-text.test.ts`
Expected: FAIL (módulos ausentes).

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/filename.ts
export function sanitizePart(s: string): string {
  return (s || "").trim().replace(/[\/\\|:*?"<>]/g, "").replace(/\s+/g, "_").slice(0, 60) || "Vaga";
}
function stamp(d: Date): string {
  const p = (n: number, l = 2) => String(n).padStart(l, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
export function buildFileName(nome: string, cargo: string, empresa: string, now = new Date()): string {
  return `${sanitizePart(nome)}_${sanitizePart(cargo)}_${sanitizePart(empresa)}_${stamp(now)}.pdf`;
}
// lib/json-text.ts
export function extractJson(raw: string): string {
  const m = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const inner = (m ? m[1] : raw).trim();
  const s = inner.indexOf("{"), e = inner.lastIndexOf("}");
  return s >= 0 && e > s ? inner.slice(s, e + 1) : inner;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/filename.test.ts tests/json-text.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add lib/filename.ts lib/json-text.ts tests/filename.test.ts tests/json-text.test.ts
git commit -m "feat: add filename builder and json extractor"
```

---

### Task 4: LLM providers + chain Zen→Gemini→OpenRouter + prompts

**Files:**
- Create: `lib/llm/zen.ts`, `lib/llm/gemini.ts`, `lib/llm/openrouter.ts`, `lib/llm/chain.ts`, `lib/llm/prompts.ts`
- Test: `tests/llm-chain.test.ts`

**Interfaces:**
- Consumes: `extractJson` (Task 3).
- Produces: `chatJsonZen/Gemini/Openrouter(system, user: string): Promise<unknown>`, `generateJson(system, user): Promise<{ data: unknown; provider: "zen"|"gemini"|"openrouter" }>`, `BASE_EXTRACT_SYSTEM: string`, `TAILOR_SYSTEM: string`, `buildTailorUser(baseJson, jobText: string): string`, `buildRepairUser(badJson, errors: string): string`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/llm-chain.test.ts
import { describe, expect, it, vi, afterEach } from "vitest";
import { generateJson } from "@/lib/llm/chain";
afterEach(() => vi.unstubAllGlobals());
describe("generateJson fallback", () => {
  it("uses zen when it succeeds", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: '{"ok":1}' } }] }) })));
    const r = await generateJson("s", "u");
    expect(r.provider).toBe("zen");
    expect(r.data).toEqual({ ok: 1 });
  });
  it("falls back zen→gemini→openrouter", async () => {
    const fetch = vi.fn()
      .mockRejectedValueOnce(new Error("zen down"))
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => "gemini err" } as unknown as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ choices: [{ message: { content: '{"ok":3}' } }] }) } as unknown as Response);
    vi.stubGlobal("fetch", fetch);
    const r = await generateJson("s", "u");
    expect(r.provider).toBe("openrouter");
  });
  it("throws with all three errors", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("down"); }));
    await expect(generateJson("s", "u")).rejects.toThrow(/zen.*gemini.*openrouter/s);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/llm-chain.test.ts`
Expected: FAIL (módulo ausente).

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/llm/zen.ts
export async function chatJsonZen(system: string, user: string): Promise<unknown> {
  const base = process.env.OPENCODE_ZEN_BASE_URL || "https://opencode.ai/zen/v1";
  const model = process.env.OPENCODE_ZEN_MODEL || "glm-4.6";
  const key = process.env.OPENCODE_ZEN_API_KEY || "";
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 60_000);
  try {
    const res = await fetch(`${base}/chat/completions`, { method: "POST", signal: ctl.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, messages: [{ role: "system", content: system }, { role: "user", content: user }], response_format: { type: "json_object" } }) });
    if (!res.ok) throw new Error(`zen ${res.status}: ${await res.text()}`);
    const j = await res.json() as { choices: { message: { content: string } }[] };
    const { extractJson } = await import("@/lib/json-text");
    return JSON.parse(extractJson(j.choices[0].message.content));
  } finally { clearTimeout(t); }
}
// lib/llm/gemini.ts
export async function chatJsonGemini(system: string, user: string): Promise<unknown> {
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const key = process.env.GEMINI_API_KEY || "";
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 60_000);
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      { method: "POST", signal: ctl.signal, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system_instruction: { parts: [{ text: system }] }, contents: [{ parts: [{ text: user }] }], generationConfig: { responseMimeType: "application/json" } }) });
    if (!res.ok) throw new Error(`gemini ${res.status}: ${await res.text()}`);
    const j = await res.json() as { candidates: { content: { parts: { text: string }[] } }[] };
    const { extractJson } = await import("@/lib/json-text");
    return JSON.parse(extractJson(j.candidates[0].content.parts.map((p) => p.text).join("")));
  } finally { clearTimeout(t); }
}
// lib/llm/openrouter.ts
export async function chatJsonOpenrouter(system: string, user: string): Promise<unknown> {
  const model = process.env.OPENROUTER_MODEL || "openai/gpt-oss-20b:free";
  const key = process.env.OPENROUTER_API_KEY || "";
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 60_000);
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", { method: "POST", signal: ctl.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, "HTTP-Referer": "http://localhost:3000", "X-Title": "personalize-my-cv" },
      body: JSON.stringify({ model, messages: [{ role: "system", content: system }, { role: "user", content: user }], response_format: { type: "json_object" } }) });
    if (!res.ok) throw new Error(`openrouter ${res.status}: ${await res.text()}`);
    const j = await res.json() as { choices: { message: { content: string } }[] };
    const { extractJson } = await import("@/lib/json-text");
    return JSON.parse(extractJson(j.choices[0].message.content));
  } finally { clearTimeout(t); }
}
// lib/llm/chain.ts
import { chatJsonZen } from "./zen"; import { chatJsonGemini } from "./gemini"; import { chatJsonOpenrouter } from "./openrouter";
export type Provider = "zen" | "gemini" | "openrouter";
export async function generateJson(system: string, user: string): Promise<{ data: unknown; provider: Provider }> {
  const errs: string[] = [];
  try { return { data: await chatJsonZen(system, user), provider: "zen" }; } catch (e) { errs.push(`zen: ${(e as Error).message}`); }
  try { return { data: await chatJsonGemini(system, user), provider: "gemini" }; } catch (e) { errs.push(`gemini: ${(e as Error).message}`); }
  try { return { data: await chatJsonOpenrouter(system, user), provider: "openrouter" }; } catch (e) { errs.push(`openrouter: ${(e as Error).message}`); }
  throw new Error(errs.join(" | "));
}
// lib/llm/prompts.ts
export const BASE_EXTRACT_SYSTEM = `Converta o texto do currículo para o ResumeSchema v2 (cabecalho{nome,titulo_profissional,contatos[]} + secoes{resumo,experiencia[],formacao[],habilidades[],certificacoes[],idiomas[],projetos[]}). Não invente dados. Normalize periodo.inicio/fim para YYYY-MM (ex. "Ago 2025"→"2025-08"); se "atual", fim=null e atual=true. Retorne SOMENTE JSON.`;
export const TAILOR_SYSTEM = `Dado baseJson (ResumeSchema) + jobText, reescreva resumo e realizacoes priorizando keywords da vaga, sem inventar cargos/empresas/datas. Retorne SOMENTE o envelope {resume,cargo,empresa,matchPercent(0-100 honesto),strengths[3-8],weaknesses[3-8],emailBody(pt-BR),chatMessage(pt-BR)}. Se cargo/empresa ausentes na vaga use "Vaga"/"Empresa".`;
export const buildTailorUser = (baseJson: string, jobText: string) => `baseJson:\n${baseJson}\n\njobText:\n${jobText}`;
export const buildRepairUser = (badJson: string, errors: string) => `Corrija este JSON conforme os erros Zod e retorne SOMENTE JSON válido:\n${badJson}\n\nErros:\n${errors}`;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/llm-chain.test.ts`
Expected: PASS. (Nota: o 2º teste conta com gemini retornando `ok:false` → chain avança.)

- [ ] **Step 5: Commit**

```bash
git add lib/llm tests/llm-chain.test.ts
git commit -m "feat: add llm chain zen-gemini-openrouter"
```

---

### Task 5: Prisma client + extração PDF + `uploadBase`

**Files:**
- Create: `lib/db.ts`, `lib/cv-text.ts`, `app/actions.ts` (parcial: `getBase`, `uploadBase`)
- Test: `tests/cv-text.test.ts`

**Interfaces:**
- Consumes: `parseResume` (Task 2), `generateJson` + prompts (Task 4).
- Produces: `db` (PrismaClient singleton), `extractCvText(buf: Buffer): Promise<string>`, actions `getBase(): Promise<Resume|null>`, `uploadBase(formData: FormData): Promise<{ ok: true } | { ok: false; error: string }>`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/cv-text.test.ts
import { describe, expect, it } from "vitest";
import { extractCvText } from "@/lib/cv-text";
describe("extractCvText", () => {
  it("throws friendly error on empty buffer", async () => {
    await expect(extractCvText(Buffer.from(""))).rejects.toThrow(/PDF/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/cv-text.test.ts`
Expected: FAIL (módulo ausente).

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/db.ts
import { PrismaClient } from "@prisma/client";
const g = globalThis as unknown as { __db?: PrismaClient };
export const db = g.__db ?? new PrismaClient();
if (!g.__db) g.__db = db;
// lib/cv-text.ts
export async function extractCvText(buf: Buffer): Promise<string> {
  if (!buf || buf.length < 100) throw new Error("PDF inválido ou vazio.");
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
  let out = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    out += tc.items.map((it) => ("str" in (it as object) ? (it as { str: string }).str : "")).join(" ") + "\n";
  }
  const text = out.trim();
  if (!text) throw new Error("PDF sem texto selecionável — envie um PDF com texto, não escaneado.");
  return text;
}
// app/actions.ts (parte 1)
"use server";
import { db } from "@/lib/db";
import { extractCvText } from "@/lib/cv-text";
import { parseResume, type Resume } from "@/lib/resume-schema";
import { generateJson } from "@/lib/llm/chain";
import { BASE_EXTRACT_SYSTEM, buildRepairUser } from "@/lib/llm/prompts";

export async function getBase(): Promise<Resume | null> {
  const row = await db.baseResume.findUnique({ where: { id: 1 } });
  return row ? (JSON.parse(row.json) as Resume) : null;
}
export async function uploadBase(formData: FormData): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const file = formData.get("pdf") as File | null;
    if (!file) return { ok: false, error: "Envie um arquivo PDF." };
    const text = await extractCvText(Buffer.from(await file.arrayBuffer()));
    const { data } = await generateJson(BASE_EXTRACT_SYSTEM, text.slice(0, 12000));
    try {
      const resume = parseResume(data);
      await db.baseResume.upsert({ where: { id: 1 }, create: { id: 1, json: JSON.stringify(resume) }, update: { json: JSON.stringify(resume) } });
      return { ok: true };
    } catch (zerr) {
      const { data: fixed } = await generateJson(BASE_EXTRACT_SYSTEM, buildRepairUser(JSON.stringify(data), String(zerr)));
      const resume = parseResume(fixed);
      await db.baseResume.upsert({ where: { id: 1 }, create: { id: 1, json: JSON.stringify(resume) }, update: { json: JSON.stringify(resume) } });
      return { ok: true };
    }
  } catch (e) { return { ok: false, error: (e as Error).message.slice(0, 500) }; }
}
```

Run once: `npx prisma migrate dev --name init` (cria `dev.db`).

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npx vitest run tests/cv-text.test.ts
npx tsc --noEmit
```
Expected: PASS + tsc limpo.

- [ ] **Step 5: Commit**

```bash
git add lib/db.ts lib/cv-text.ts app/actions.ts tests/cv-text.test.ts prisma/schema.prisma
git commit -m "feat: add base upload with pdf extract"
```

---

### Task 6: `CVDocument` react-pdf + smoke render

**Files:**
- Create: `lib/pdf/CVDocument.tsx`
- Test: `tests/cv-pdf.test.ts`

**Interfaces:**
- Consumes: `Resume` (Task 2).
- Produces: `<CVDocument resume={...} />` (Document A4 P&B fiel à spec §6).

- [ ] **Step 1: Write the failing test**

```ts
// tests/cv-pdf.test.ts
import { describe, expect, it } from "vitest";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { CVDocument } from "@/lib/pdf/CVDocument";
const resume = { cabecalho: { nome: "Filipe de Leonel Batista", titulo_profissional: "Desenvolvedor Front-end",
  contatos: [{ tipo: "email", valor: "a@b.com", link: "mailto:a@b.com" }] },
  secoes: { resumo: "Dev React.", experiencia: [], formacao: [],
    habilidades: [{ nome: "F", itens: ["React"] }], certificacoes: [], idiomas: [], projetos: [] } } as never;
describe("CVDocument", () => {
  it("renders to buffer", async () => {
    const buf = await renderToBuffer(React.createElement(CVDocument, { resume }));
    expect(buf.length).toBeGreaterThan(1000);
  }, 30000);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/cv-pdf.test.ts`
Expected: FAIL (componente ausente).

- [ ] **Step 3: Write minimal implementation**

```tsx
// lib/pdf/CVDocument.tsx
import React from "react";
import { Document, Page, Text, View, Link, StyleSheet } from "@react-pdf/renderer";
import type { Resume } from "@/lib/resume-schema";

const s = StyleSheet.create({
  page: { padding: 56, fontFamily: "Helvetica", fontSize: 10, lineHeight: 1.4, color: "#000" },
  header: { textAlign: "center", marginBottom: 16 },
  name: { fontSize: 21, fontWeight: "bold" },
  contact: { fontSize: 9, color: "#0056b3", textDecoration: "underline", marginTop: 4 },
  role: { fontSize: 14, fontWeight: "bold", marginTop: 8 },
  subtitle: { fontStyle: "italic", marginBottom: 4 },
  body: { textAlign: "justify" },
  h2: { fontSize: 14, fontWeight: "bold", marginTop: 12, marginBottom: 4 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  jobTitle: { fontSize: 11, fontWeight: "bold" },
  org: { fontStyle: "italic", marginVertical: 2 },
  skills: { flexDirection: "row" },
  col: { width: "50%", paddingRight: 8 },
  bullet: { marginLeft: 12, marginBottom: 2 },
  comp: { marginTop: 4 },
  bold: { fontWeight: "bold" },
});

export function CVDocument({ resume }: { resume: Resume }) {
  const c = resume.cabecalho, sec = resume.secoes;
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.name}>{c.nome}</Text>
          <Text style={s.contact}>{c.contatos.map((k) => k.valor).join(" | ")}</Text>
        </View>
        <Text style={s.role}>{c.titulo_profissional}</Text>
        <Text style={s.body}>{sec.resumo}</Text>
        <Text style={s.h2}>Habilidades</Text>
        <View style={s.skills}>
          {[0, 1].map((col) => (
            <View key={col} style={s.col}>
              {sec.habilidades.flatMap((g) => g.itens).filter((_, i) => i % 2 === col).map((t) => (
                <Text key={t} style={s.bullet}>• {t}</Text>
              ))}
            </View>
          ))}
        </View>
        <Text style={s.h2}>Experiências</Text>
        {sec.experiencia.map((e) => (
          <View key={`${e.cargo}-${e.empresa}-${e.periodo.inicio}`} wrap={false} style={{ marginBottom: 10 }}>
            <View style={s.row}>
              <Text style={s.jobTitle}>{e.cargo}</Text>
              <Text>{e.periodo.inicio} – {e.periodo.atual ? "atual" : e.periodo.fim}</Text>
            </View>
            <Text style={s.org}>{e.empresa}{e.local ? `. ${e.local}` : ""}</Text>
            <Text style={s.body}>{e.descricao}</Text>
            {e.realizacoes.map((r) => <Text key={r} style={s.bullet}>• {r}</Text>)}
            <Text style={s.comp}><Text style={s.bold}>Competências: </Text>{e.tecnologias.join(", ")}</Text>
          </View>
        ))}
        <Text style={s.h2}>Educação</Text>
        {sec.formacao.map((f) => (
          <View key={`${f.curso}-${f.instituicao}`} wrap={false} style={{ marginBottom: 8 }}>
            <View style={s.row}>
              <Text style={s.jobTitle}>{f.curso}</Text>
              <Text>{f.periodo.inicio} - {f.periodo.atual ? "atual" : f.periodo.fim}</Text>
            </View>
            <Text style={s.org}>{f.instituicao}{f.local ? `. ${f.local}` : ""}</Text>
            {f.descricao ? <Text style={s.body}>{f.descricao}</Text> : null}
          </View>
        ))}
        {sec.projetos.length ? (<><Text style={s.h2}>Projetos</Text>{sec.projetos.map((p) => (
          <View key={p.nome} style={{ marginBottom: 6 }}>
            <Text style={s.jobTitle}>{p.nome}</Text>
            <Text style={s.body}>{p.descricao}{p.tecnologias.length ? ` (${p.tecnologias.join(", ")})` : ""}</Text>
            {p.link ? <Link style={s.contact} src={p.link}>{p.link}</Link> : null}
          </View>))}</>) : null}
      </Page>
    </Document>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/cv-pdf.test.ts`
Expected: PASS (buffer maior que 1KB).

- [ ] **Step 5: Commit**

```bash
git add lib/pdf/CVDocument.tsx tests/cv-pdf.test.ts
git commit -m "feat: add cv pdf document"
```

---

### Task 7: `tailorResume` + `retryTailor` + escrita do PDF

**Files:**
- Modify: `app/actions.ts` (append)
- Test: `tests/tailor.test.ts` (chain mockeada + filename)

**Interfaces:**
- Consumes: `getBase`, `CVDocument`, `buildFileName`, `parseEnvelope`, `generateJson`, `TAILOR_SYSTEM`.
- Produces: `tailorResume(jobText: string): Promise<{ ok: true; id: number } | { ok: false; error: string; id?: number }>`, `retryTailor(id: number): Promise<{ ok: boolean; error?: string }>`, `listApplications(): Promise<TailoredApplication[]>`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/tailor.test.ts
import { describe, expect, it } from "vitest";
import { buildFileName } from "@/lib/filename";
import { parseEnvelope } from "@/lib/resume-schema";
describe("tailor envelope", () => {
  it("parses envelope with match bounds", () => {
    const env = { resume: { cabecalho: { nome: "N", titulo_profissional: "T", contatos: [{ tipo: "email", valor: "a", link: null }] },
      secoes: { resumo: "r", experiencia: [], formacao: [], habilidades: [], certificacoes: [], idiomas: [], projetos: [] } },
      cargo: "Dev", empresa: "X", matchPercent: 82, strengths: ["React"], weaknesses: ["Inglês"],
      emailBody: "Olá", chatMessage: "Oi" };
    expect(parseEnvelope(env).matchPercent).toBe(82);
    expect(buildFileName("N", "Dev", "X", new Date("2026-09-25T00:00:00")).endsWith(".pdf")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/tailor.test.ts`
Expected: FAIL se `parseEnvelope` ainda não cobre envelope (na prática passa — então este teste é de contrato; a parte nova são as actions, verificadas no step 4 via `tsc`).

- [ ] **Step 3: Write minimal implementation** (append em `app/actions.ts`)

```ts
import React from "react";
import { renderToFile } from "@react-pdf/renderer";
import { CVDocument } from "@/lib/pdf/CVDocument";
import { parseEnvelope } from "@/lib/resume-schema";
import { buildFileName } from "@/lib/filename";
import { TAILOR_SYSTEM, buildTailorUser, buildRepairUser } from "@/lib/llm/prompts";

export async function listApplications() {
  const { db } = await import("@/lib/db");
  return db.tailoredApplication.findMany({ orderBy: { createdAt: "desc" } });
}
export async function tailorResume(jobText: string): Promise<{ ok: true; id: number } | { ok: false; error: string; id?: number }> {
  const { db } = await import("@/lib/db");
  if (!jobText || jobText.trim().length < 20) return { ok: false, error: "Cole o texto da vaga (mín. 20 caracteres)." };
  try {
    const base = await getBase();
    if (!base) return { ok: false, error: "Cadastre o currículo base primeiro." };
    let env;
    try {
      const { data } = await generateJson(TAILOR_SYSTEM, buildTailorUser(JSON.stringify(base), jobText));
      env = parseEnvelope(data);
    } catch (zerr) {
      throw new Error(`Envelope inválido: ${String(zerr).slice(0, 300)}`);
    }
    const fileName = buildFileName(base.cabecalho.nome, env.cargo || "Vaga", env.empresa || "Empresa");
    const abs = `./public/generated/${fileName}`;
    await renderToFile(React.createElement(CVDocument, { resume: env.resume }), abs);
    const row = await db.tailoredApplication.create({ data: {
      jobText, cargo: env.cargo, empresa: env.empresa, fileName, pdfPath: `/generated/${fileName}`,
      matchPercent: env.matchPercent, strengths: JSON.stringify(env.strengths),
      weaknesses: JSON.stringify(env.weaknesses), emailBody: env.emailBody,
      chatMessage: env.chatMessage, status: "done", errorLog: "" } });
    return { ok: true, id: row.id };
  } catch (e) {
    const msg = (e as Error).message.slice(0, 1000);
    const row = await db.tailoredApplication.create({ data: { jobText,
      cargo: "Vaga", empresa: "Empresa", fileName: `failed_${Date.now()}.pdf`, pdfPath: "",
      matchPercent: 0, strengths: "[]", weaknesses: "[]", status: "failed", errorLog: msg } });
    return { ok: false, error: `As 3 IAs falharam. Vaga salva como failed para retry. Detalhe: ${msg}`, id: row.id };
  }
}
export async function retryTailor(id: number): Promise<{ ok: boolean; error?: string }> {
  const { db } = await import("@/lib/db");
  const row = await db.tailoredApplication.findUnique({ where: { id } });
  if (!row) return { ok: false, error: "Registro não encontrado." };
  const r = await tailorResume(row.jobText);
  if (r.ok && r.id !== id) await db.tailoredApplication.delete({ where: { id } });
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npx vitest run tests/tailor.test.ts
npx tsc --noEmit
```
Expected: PASS + tsc limpo.

- [ ] **Step 5: Commit**

```bash
git add app/actions.ts tests/tailor.test.ts
git commit -m "feat: add tailor and retry actions"
```

---

### Task 8: Tela única (page + componentes client)

**Files:**
- Create: `app/page.tsx`, `app/components/BaseSetup.tsx`, `app/components/VacancyTable.tsx`, `app/components/GenerateModal.tsx`, `app/components/DetailDrawer.tsx`
- Modify: `app/layout.tsx`, `app/globals.css` (se necessário)

**Interfaces:**
- Consumes: actions da Task 5/7 (`getBase`, `uploadBase`, `tailorResume`, `retryTailor`, `listApplications`).
- Produces: `/` renderiza setup-ou-dashboard; tabela com Ver/Baixar/Retry/Copiar; modal com textarea; drawer com PDF + análise + mensagens + data.

- [ ] **Step 1: Write the failing test** (contrato de render: checa exports)

```ts
// tests/ui-contract.test.ts
import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
describe("ui contract", () => {
  it("page and components exist", () => {
    for (const f of ["app/page.tsx", "app/components/BaseSetup.tsx", "app/components/VacancyTable.tsx", "app/components/GenerateModal.tsx", "app/components/DetailDrawer.tsx"]) {
      expect(existsSync(f), f).toBe(true);
    }
    expect(readFileSync("app/components/VacancyTable.tsx", "utf8")).toContain("Tentar novamente");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui-contract.test.ts`
Expected: FAIL (arquivos não existem).

- [ ] **Step 3: Write minimal implementation**

`app/page.tsx` (Server Component):
```tsx
import { getBase, listApplications } from "./actions";
import { BaseSetup } from "./components/BaseSetup";
import { VacancyTable } from "./components/VacancyTable";
import { GenerateModal } from "./components/GenerateModal";

export default async function Page() {
  const base = await getBase();
  const apps = base ? await listApplications() : [];
  if (!base) return (<main className="mx-auto max-w-3xl p-6"><h1 className="text-2xl font-bold">Personalize My CV</h1><BaseSetup /></main>);
  return (
    <main className="mx-auto max-w-5xl p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Personalize My CV</h1><p className="text-sm text-gray-600">Base: {base.cabecalho.nome} — {base.cabecalho.titulo_profissional}</p></div>
        <GenerateModal />
      </header>
      <VacancyTable apps={apps} />
      <details><summary className="cursor-pointer text-sm">Re-enviar currículo base</summary><BaseSetup /></details>
    </main>
  );
}
```

`BaseSetup.tsx` (`"use client"`, form PDF → `uploadBase` → `location.reload()`; mostra erro em vermelho).
`GenerateModal.tsx` (`"use client"`, dialog com textarea + `tailorResume` + loading + erro; reload ao ok).
`VacancyTable.tsx` (server-passed rows; badge done/failed; colunas cargo/empresa/match%/data; botões Ver→drawer, Baixar→`pdfPath`, Retry→`retryTailor`, Copiar email/chat via `navigator.clipboard`).
`DetailDrawer.tsx` (`"use client"`, props app; match bar `width:%`; listas fortes/fracos via `JSON.parse`; `<pre>` email/chat + botões Copiar; link Baixar PDF; data `new Date(createdAt).toLocaleString("pt-BR")`; jobText em `<details>`).

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npx vitest run tests/ui-contract.test.ts
npx tsc --noEmit
npm run build
```
Expected: PASS + build OK.

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx app/components tests/ui-contract.test.ts
git commit -m "feat: add single-screen ui"
```

---

### Task 9: Verificação final + README

**Files:**
- Create: `README.md`
- Test: full suite `npx vitest run`

**Interfaces:**
- Consumes: todas as tasks.
- Produces: README com setup `.env`, `prisma migrate`, `npm run dev`, fluxo de uso e troubleshooting das 3 IAs.

- [ ] **Step 1: Write the failing check**

Run: `npx vitest run`
Expected: alguma falha pendente aparece aqui (se tudo passar, ok — o "fail" desta task é o `npm run build` ainda não rodado após Task 8 em CI limpo).

- [ ] **Step 2: Fix anything failing**

```bash
npx prisma migrate dev --name init
npx vitest run
npm run build
```

- [ ] **Step 3: Write README**

```md
# Personalize My CV (MVP)
1. cp .env.example .env (preencha ZEN/GEMINI/OPENROUTER)
2. npm i && npx prisma migrate dev && npm run dev
3. Envie o PDF base → cole a vaga → baixe o PDF + copie email/chat.
Fallback: Zen → Gemini → OpenRouter; falha total salva failed + retry.
```

- [ ] **Step 4: Run final verification**

Run:
```bash
npx vitest run
npm run build
```
Expected: todos os testes PASS + build OK.

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: add mvp readme"
```
