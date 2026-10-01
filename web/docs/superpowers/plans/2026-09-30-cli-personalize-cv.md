# CLI personalize-cv Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `cli/` Node+TS package exposing `personalize-cv` (onboard, generate, --list/--show/--report/--help, trilingual).

**Architecture:** Self-contained `cli/` (zero imports from `web/`/`mobile/`); JSON storage in `~/.personalize-cv/`; Gemini via native `fetch` with 3-model fallback; PDF-in via `pdfjs-dist/legacy`, PDF-out via `@react-pdf/renderer` reimplemented CVDocument.

**Tech Stack:** Node 20+, TypeScript strict ESM, commander, @inquirer/prompts, zod, react + @react-pdf/renderer, pdfjs-dist, vitest.

**Spec:** `web/docs/superpowers/specs/2026-09-30-cli-design.md`

## Global Constraints

- `cli/` totalmente autocontido: nenhum import de `web/` ou `mobile/`; duplicação consciente (schemas, prompts, tailor, report, filename).
- TypeScript strict + `npx tsc --noEmit` limpo; TDD com teste failing primeiro; commit por tarefa.
- Chave Gemini em `~/.personalize-cv/config.json` chmod 600 + aviso de não-cofre (obfuscation, não vault).
- Idioma do CV (`BaseLang` pt-BR|en|es) independente do locale da UI (pt-BR|en-US|es-ES), como no web.
- LLM sempre `fetch` direto a `generativelanguage.googleapis.com`, timeout 60s, sem cache.
- Novas strings visíveis exigem chaves nos 3 `messages/*.json` (parity test).

## Review Focus

- PDF escaneado/sem texto deve dar erro legível `unscannedPdf`, nunca travar — pinned in Task 5 (empty-text test).
- Caminho PDF inexistente no onboarding deve dar `notFound` localizado, não stack — pinned in Task 6 (missing-file test).
- `~/.personalize-cv` sem permissão de escrita deve dar `quota` hint, não crash silencioso — pinned in Task 2 (ENOSPC-mock test).
- Chave de mensagem ausente num locale deve cair para pt-BR — pinned in Task 2 (fallback test).
- Vaga < 20 chars deve recusar com `jobShort` antes de chamar a IA — pinned in Task 4 (short-job test).

---

### Task 1: Scaffold cli/ + configs

**Files:**
- Create: `cli/package.json`, `cli/tsconfig.json`, `cli/vitest.config.ts`, `cli/README.md`, `cli/.gitignore`
- Test: `cli/tests/scaffold.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `npm run build` (tsc → dist/), `npm test` (vitest), bin `personalize-cv` → `dist/index.js`.

- [ ] **Step 1: Write the failing test**

```ts
// cli/tests/scaffold.test.ts
import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
describe("scaffold", () => {
  it("exposes bin personalize-cv", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    expect(pkg.bin["personalize-cv"]).toBe("./dist/index.js");
  });
  it("has type module + node engine", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    expect(pkg.type).toBe("module");
    expect(existsSync("tsconfig.json")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd cli && npm test -- --run tests/scaffold.test.ts`
Expected: FAIL (files do not exist yet).

- [ ] **Step 3: Write minimal implementation**

```json
// cli/package.json
{
  "name": "personalize-my-cv-cli",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "bin": { "personalize-cv": "./dist/index.js" },
  "scripts": { "build": "tsc -p tsconfig.json", "test": "vitest run", "dev": "tsx src/index.ts" },
  "engines": { "node": ">=20" },
  "dependencies": {
    "@inquirer/prompts": "^7.0.0",
    "@react-pdf/renderer": "^4.0.0",
    "commander": "^12.0.0",
    "pdfjs-dist": "^4.0.0",
    "react": "^19.0.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.6.0",
    "vitest": "^3.0.0"
  }
}
```

```json
// cli/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022", "module": "NodeNext", "moduleResolution": "NodeNext",
    "strict": true, "outDir": "dist", "rootDir": "src",
    "resolveJsonModule": true, "esModuleInterop": true, "skipLibCheck": true
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "tests/**/*.ts"]
}
```

```ts
// cli/vitest.config.ts
import { defineConfig } from "vitest/config";
export default defineConfig({ test: { include: ["tests/**/*.test.ts"] } });
```

```ts
// cli/src/index.ts
#!/usr/bin/env node
console.log("personalize-cv");
```

```gitignore
# cli/.gitignore
dist/
node_modules/
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd cli && npm i && npm test -- --run && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add cli/package.json cli/tsconfig.json cli/vitest.config.ts cli/src/index.ts cli/tests/scaffold.test.ts cli/.gitignore
git commit -m "feat(cli): scaffold package with bin personalize-cv"
```

### Task 2: store (home JSON) + i18n + messages + filename + report

**Files:**
- Create: `cli/src/lib/store.ts`, `cli/src/lib/i18n.ts`, `cli/src/lib/filename.ts`, `cli/src/lib/report.ts`
- Create: `cli/messages/pt-BR.json`, `cli/messages/en-US.json`, `cli/messages/es-ES.json`
- Test: `cli/tests/store.test.ts`, `cli/tests/i18n.test.ts`, `cli/tests/pure.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `homeDir()`, `loadConfig/saveConfig/loadBase/saveBase/loadApps/saveApps` (Zod, discard-invalid); `UiLocale`, `parseLocale()`, `t(locale,key,vars?)`; `buildFileName/buildFailedFileName/sanitizePart`; `weekRange/bucketByWeekday/weekLabel`.

- [ ] **Step 1: Write the failing tests**

```ts
// cli/tests/i18n.test.ts
import { describe, expect, it } from "vitest";
import pt from "../messages/pt-BR.json";
import en from "../messages/en-US.json";
import es from "../messages/es-ES.json";
import { t } from "../src/lib/i18n";
function keys(o: unknown, p = ""): string[] {
  if (typeof o === "string") return [p];
  return Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => keys(v, p ? `${p}.${k}` : k));
}
describe("i18n parity", () => {
  it("same keyset in 3 locales", () => {
    expect(keys(en).sort()).toEqual(keys(pt).sort());
    expect(keys(es).sort()).toEqual(keys(pt).sort());
  });
  it("falls back to pt-BR", () => {
    expect(t("en-US" as never, "Cli.onlyInPt" as never)).toContain("somente");
  });
});
```

```ts
// cli/tests/store.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";
describe("store", () => {
  it("discards invalid apps, keeps valid", async () => {
    process.env.PMCV_HOME = "/tmp/opencode/pmcv-test-home";
    const { saveApps, loadApps } = await import("../src/lib/store");
    saveApps([{ bogus: 1 } as never]);
    expect(loadApps()).toEqual([]);
  });
});
```

```ts
// cli/tests/pure.test.ts
import { describe, expect, it } from "vitest";
import { buildFileName } from "../src/lib/filename";
import { bucketByWeekday, weekRange } from "../src/lib/report";
describe("pure", () => {
  it("builds stamped filename", () => {
    const n = buildFileName("Ana Souza", "Dev", "Acme", new Date("2026-01-05T10:20:30"));
    expect(n).toMatch(/^Ana_Souza_Dev_Acme_20260105-102030\.pdf$/);
  });
  it("monday-based week buckets mon=0", () => {
    const { start } = weekRange(new Date("2026-09-30T12:00:00"), 0);
    expect(start.getDay()).toBe(1);
    expect(bucketByWeekday([new Date("2026-09-28T10:00:00")])[0]).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd cli && npm test -- --run tests/i18n.test.ts tests/store.test.ts tests/pure.test.ts`
Expected: FAIL (modules missing).

- [ ] **Step 3: Write minimal implementation**

```ts
// cli/src/lib/i18n.ts
import ptBR from "../../messages/pt-BR.json";
import enUS from "../../messages/en-US.json";
import esES from "../../messages/es-ES.json";
export const LOCALES = ["pt-BR", "en-US", "es-ES"] as const;
export type UiLocale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: UiLocale = "pt-BR";
const TABLES: Record<UiLocale, unknown> = { "pt-BR": ptBR, "en-US": enUS, "es-ES": esES };
function lookup(table: unknown, key: string): string | null {
  let cur: unknown = table;
  for (const part of key.split(".")) {
    if (typeof cur !== "object" || cur === null) return null;
    cur = (cur as Record<string, unknown>)[part];
  }
  return typeof cur === "string" ? cur : null;
}
export function t(locale: UiLocale, key: string, vars?: Record<string, string | number>): string {
  const raw = lookup(TABLES[locale], key) ?? lookup(TABLES[DEFAULT_LOCALE], key) ?? key;
  return raw.replace(/\{(\w+)\}/g, (_, k: string) => String(vars?.[k] ?? `{${k}}`));
}
export function parseLocale(v: unknown): UiLocale {
  const s = String(v ?? "").trim();
  if (s === "pt-BR" || s === "pt_BR") return "pt-BR";
  if (s.startsWith("en")) return "en-US";
  if (s.startsWith("es")) return "es-ES";
  if ((LOCALES as readonly string[]).includes(s)) return s as UiLocale;
  const env = `${process.env.LC_ALL ?? ""} ${process.env.LANG ?? ""}`;
  if (/pt/i.test(env)) return "pt-BR";
  if (/es/i.test(env)) return "es-ES";
  if (/en/i.test(env)) return "en-US";
  return DEFAULT_LOCALE;
}
```

```ts
// cli/src/lib/store.ts
import { mkdirSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { StoredAppSchema, StoredBaseSchema, SettingsSchema } from "./schemas.js";
export function homeDir(): string {
  return process.env.PMCV_HOME ?? join(homedir(), ".personalize-cv");
}
function ensureDir(): string {
  const d = homeDir();
  mkdirSync(d, { recursive: true });
  return d;
}
function p(name: string): string { return join(ensureDir(), name); }
function readJson<T>(name: string): unknown | null {
  try { return JSON.parse(readFileSync(p(name), "utf8")); } catch { return null; }
}
function writeJson(name: string, v: unknown): void {
  try {
    writeFileSync(p(name), JSON.stringify(v, null, 2));
    if (name === "config.json") { try { chmodSync(p(name), 0o600); } catch {} }
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err?.code === "ENOSPC") throw new Error("quota");
    throw e;
  }
}
export function loadBase() {
  const raw = readJson("base.json");
  if (!raw) return null;
  try { return StoredBaseSchema.parse(raw); } catch { return null; }
}
export function saveBase(b: unknown): void { writeJson("base.json", StoredBaseSchema.parse(b)); }
export function loadApps() {
  const raw = readJson("apps.json");
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw) { try { out.push(StoredAppSchema.parse(item)); } catch {} }
  return out;
}
export function saveApps(a: unknown[]): void {
  const clean = [];
  for (const item of a) clean.push(StoredAppSchema.parse(item));
  writeJson("apps.json", clean);
}
export function loadConfig() {
  try { return SettingsSchema.parse(readJson("config.json") ?? {}); }
  catch { return SettingsSchema.parse({}); }
}
export function saveConfig(c: unknown): void { writeJson("config.json", SettingsSchema.parse(c)); }
export type StoredBase = z.infer<typeof StoredBaseSchema>;
export type StoredApp = z.infer<typeof StoredAppSchema>;
```

```ts
// cli/src/lib/filename.ts (copy of web/lib/filename.ts verbatim)
export function sanitizePart(s: string): string {
  return (s || "").trim().replace(/[/\\|:*?"<>]/g, "").replace(/\s+/g, "_").slice(0, 60) || "Vaga";
}
function stamp(d: Date): string {
  const p = (n: number, l = 2) => String(n).padStart(l, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
export function buildFileName(nome: string, cargo: string, empresa: string, now = new Date()): string {
  return `${sanitizePart(nome)}_${sanitizePart(cargo)}_${sanitizePart(empresa)}_${stamp(now)}.pdf`;
}
export function buildFailedFileName(): string {
  return `failed_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.pdf`;
}
```

```ts
// cli/src/lib/report.ts (copy of web/lib/report.ts verbatim)
export const WEEKDAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
function startOfDay(d: Date): Date { const c = new Date(d); c.setHours(0, 0, 0, 0); return c; }
function mondayOf(date: Date): Date {
  const d = startOfDay(date);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}
export function weekRange(ref: Date, offsetWeeks: number): { start: Date; end: Date } {
  const clamped = Math.min(offsetWeeks, 0);
  const start = mondayOf(ref);
  start.setDate(start.getDate() + clamped * 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return { start, end };
}
export function bucketByWeekday(dates: Date[]): number[] {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const d of dates) counts[(d.getDay() + 6) % 7] += 1;
  return counts;
}
export function weekLabel(start: Date, end: Date): string {
  const fmt = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
  return `${fmt(start)} – ${fmt(end)}`;
}
```

`messages/*.json`: copy `web/messages/*.json` top-level namespaces verbatim, then add `Cli` namespace per locale:

```json
// pt-BR Cli (en-US/es-ES translated equivalents required)
"Cli": {
  "onlyInPt": "somente pt",
  "enterKey": "Cole sua GEMINI_API_KEY (https://aistudio.google.com/apikey):",
  "enterPdf": "Caminho do PDF base:",
  "enterJob": "Cole o texto da vaga (termine com linha vazia):",
  "analysis": "Análise",
  "savedPdf": "PDF salvo em {file}"
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd cli && npm test -- --run && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add cli/src/lib/store.ts cli/src/lib/i18n.ts cli/src/lib/filename.ts cli/src/lib/report.ts cli/messages cli/tests/store.test.ts cli/tests/i18n.test.ts cli/tests/pure.test.ts
git commit -m "feat(cli): home store, trilingual i18n, filename, weekly report"
```

### Task 3: schemas + LLM (gemini/chain/prompts) + tailor normalize

**Files:**
- Create: `cli/src/lib/schemas.ts`, `cli/src/lib/gemini.ts`, `cli/src/lib/chain.ts`, `cli/src/lib/prompts.ts`, `cli/src/lib/tailor.ts`
- Test: `cli/tests/tailor.test.ts`, `cli/tests/llm.test.ts`

**Interfaces:**
- Consumes: `t()` from Task 2.
- Produces: `ResumeSchema/TailorEnvelopeSchema/StoredBaseSchema/StoredAppSchema/SettingsSchema`; `chatJsonGemini()`, `generateJson()`, `validateGeminiKey()`; `buildBaseExtractSystem/buildTailorSystem/buildTailorUser/buildRepairUser/parseBaseLang`; `normalizeResume/normalizeEnvelope/newId/runTailorJob/retryStoredApp`.

- [ ] **Step 1: Write the failing tests**

```ts
// cli/tests/tailor.test.ts
import { describe, expect, it } from "vitest";
import { normalizeEnvelope } from "../src/lib/tailor";
describe("tailor", () => {
  it("rejects short job before AI (jobShort)", async () => {
    const { runTailorJob } = await import("../src/lib/tailor");
    await expect(runTailorJob("curta", "pt-BR", "pt-BR")).rejects.toThrow();
  });
  it("fills missing cargo/empresa with MISSING_JOB", () => {
    const env = normalizeEnvelope({ resume: minimalResume(), cargo: "", empresa: "" }, "pt-BR");
    expect(env.cargo).toBe("Vaga");
  });
});
```

```ts
// cli/tests/llm.test.ts
import { describe, expect, it, vi } from "vitest";
describe("llm fallback", () => {
  it("tries 3 models in order", async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error("500"))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"a":1}' }] } }] }) });
    vi.stubGlobal("fetch", fetchMock);
    const { generateJson } = await import("../src/lib/chain");
    await generateJson("sys", "user", "key", ["m1", "m2"], "pt-BR");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.unstubAllGlobals();
  });
});
```

(minimalResume helper below — smallest object passing ResumeSchema.)

```ts
function minimalResume() {
  return {
    cabecalho: { nome: "Teste", titulo_profissional: "Dev", contatos: [{ tipo: "email", valor: "a@b.c" }] },
    secoes: { resumo: "r", experiencia: [], formacao: [], habilidades: [{ nome: "H", itens: ["x"] }], certificacoes: [], idiomas: [], projetos: [] },
  };
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd cli && npm test -- --run tests/tailor.test.ts tests/llm.test.ts`
Expected: FAIL (modules missing).

- [ ] **Step 3: Write minimal implementation**

Copy verbatim from web (retype, never import): `web/lib/resume-schema.ts` → `cli/src/lib/schemas.ts` (Resume + Envelope + StoredBase/StoredApp + Settings with geminiKey default ""); `web/lib/llm/prompts.ts` → `cli/src/lib/prompts.ts`; `web/lib/llm/gemini.ts` → `cli/src/lib/gemini.ts` (replace `@/lib/i18n/locale` with `../i18n.js`, add `validateGeminiKey` from `web/lib/llm/chain.ts` using `fetch` + `t(locale,...)`); `web/lib/llm/chain.ts generateJson` → `cli/src/lib/chain.ts`; `web/lib/tailor.ts` normalize functions → `cli/src/lib/tailor.ts`; `web/lib/tailor-client.ts runTailorJob/retryStoredApp/newId/failedApp` → append to `cli/src/lib/tailor.ts` replacing `localStorage` store with Task-2 `loadBase/loadApps/saveApps/loadSettings` and `MISSING_JOB`/`buildFileName` local imports. `jobShort` guard (`trim().length < 20`) throws `t(locale,"Errors.jobShort")` before any fetch.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd cli && npm test -- --run && npx tsc --noEmit`
Expected: PASS (mocked fetch, no network).

- [ ] **Step 5: Commit**

```bash
git add cli/src/lib/schemas.ts cli/src/lib/gemini.ts cli/src/lib/chain.ts cli/src/lib/prompts.ts cli/src/lib/tailor.ts cli/tests/tailor.test.ts cli/tests/llm.test.ts
git commit -m "feat(cli): schemas, gemini fallback chain, tailor normalize+generate"
```

### Task 4: PDF extract + PDF render

**Files:**
- Create: `cli/src/lib/pdf-extract.ts`, `cli/src/lib/pdf.ts`
- Test: `cli/tests/pdf.test.ts`

**Interfaces:**
- Consumes: `Resume` type (Task 3), `pdfLabels()` (local copy of web `lib/pdf/i18n.ts`).
- Produces: `extractPdfText(path): Promise<string>`; `renderPdf(resume, lang, outPath): Promise<void>`.

- [ ] **Step 1: Write the failing test**

```ts
// cli/tests/pdf.test.ts
import { describe, expect, it } from "vitest";
describe("pdf", () => {
  it("rejects non-pdf with invalidPdf", async () => {
    const { extractPdfText } = await import("../src/lib/pdf-extract");
    await expect(extractPdfText("/tmp/opencode/nope.txt")).rejects.toThrow();
  });
  it("renders a pdf file from minimal resume", async () => {
    const { renderPdf } = await import("../src/lib/pdf");
    const out = "/tmp/opencode/pmcv-render-test.pdf";
    await renderPdf(minimalResume(), "pt-BR", out);
    const { statSync } = await import("node:fs");
    expect(statSync(out).size).toBeGreaterThan(1000);
  }, 30000);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd cli && npm test -- --run tests/pdf.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

```ts
// cli/src/lib/pdf-extract.ts
import { readFileSync } from "node:fs";
import { t, type UiLocale } from "./i18n.js";
export async function extractPdfText(path: string, locale: UiLocale = "pt-BR"): Promise<string> {
  if (!/\.pdf$/i.test(path)) throw new Error(t(locale, "Errors.invalidPdf"));
  let buf: Buffer;
  try { buf = readFileSync(path); } catch { throw new Error(t(locale, "Errors.notFound")); }
  if (buf.length < 100) throw new Error(t(locale, "Errors.emptyPdf"));
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), isEvalSupported: false }).promise;
  try {
    let out = "";
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const tc = await page.getTextContent();
      out += tc.items.map((it) => ("str" in (it as object) ? (it as { str: string }).str : "")).join(" ") + "\n";
    }
    const text = out.trim();
    if (!text) throw new Error(t(locale, "Errors.unscannedPdf"));
    return text;
  } finally { await doc.destroy(); }
}
```

`cli/src/lib/pdf.ts`: reimplement `web/lib/pdf/CVDocument.tsx` with `React.createElement` (no JSX needed) using local `pdfLabels/MONTHS` copy; export `renderPdf(resume, lang, outPath)` via `pdf(el).toFile(outPath)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd cli && npm test -- --run tests/pdf.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add cli/src/lib/pdf-extract.ts cli/src/lib/pdf.ts cli/tests/pdf.test.ts
git commit -m "feat(cli): pdf text extract and react-pdf render to file"
```

### Task 5: Commands (index, onboard, generate, list, show, report, help)

**Files:**
- Create: `cli/src/commands/onboard.ts`, `generate.ts`, `list.ts`, `show.ts`, `report.ts`
- Modify: `cli/src/index.ts` (full commander wiring)
- Test: `cli/tests/commands.test.ts`

**Interfaces:**
- Consumes: all Task 2-4 libs.
- Produces: CLI flags `--locale --cv-lang --out --list --show --report --week --help --json`.

- [ ] **Step 1: Write the failing test**

```ts
// cli/tests/commands.test.ts
import { describe, expect, it } from "vitest";
describe("commands", () => {
  it("help mentions all commands in 3 locales", async () => {
    const { helpText } = await import("../src/index.js");
    for (const l of ["pt-BR", "en-US", "es-ES"] as const)
      for (const w of ["--list", "--show", "--report", "--help"]) expect(helpText(l)).toContain(w);
  });
  it("report renders ascii bars", async () => {
    const { renderReport } = await import("../src/commands/report.js");
    process.env.PMCV_HOME = "/tmp/opencode/pmcv-test-home";
    expect(renderReport("pt-BR", 0)).toMatch(/Total|Média|Seg/);
  });
  it("missing pdf path throws localized notFound", async () => {
    const { onboardWithPdf } = await import("../src/commands/onboard.js");
    await expect(onboardWithPdf("/tmp/opencode/does-not-exist.pdf", "pt-BR", "pt-BR")).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd cli && npm test -- --run tests/commands.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

`src/index.ts`: commander program with options `--locale --cv-lang --out --list --show <id> --report --week --json`; default action = interactive flow (key prompt via `@inquirer/prompts` password, pdf path via input, job text via editor, cv-lang via select); `--list` prints table + numeric select submenu (view/download/retry/delete); `--show` prints analysis + copies PDF to `--out`; `--report` prints `renderReport()` (total/avg/best + ASCII bars `█` scaled to max); `--help` prints `helpText(locale)` trilingual. Export `helpText()` for tests. All user strings via `t()`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd cli && npm test -- --run && npx tsc --noEmit && npm run build && node dist/index.js --help`
Expected: PASS + help printed.

- [ ] **Step 5: Commit**

```bash
git add cli/src/commands cli/src/index.ts cli/tests/commands.test.ts
git commit -m "feat(cli): onboard/generate/list/show/report/help commands"
```

### Task 6: README + manual verify + push

**Files:**
- Modify: `cli/README.md`, root `README.md` (add cli row).

**Interfaces:**
- Consumes: dist build from Task 5.
- Produces: documented `npm link` flow for PS/CMD/Bash.

- [ ] **Step 1: Write README install block**

```md
## CLI

cd cli && npm i && npm run build && npm link
personalize-cv --help
personalize-cv
personalize-cv --list
personalize-cv --report --week -1
```

- [ ] **Step 2: Manual verify (no test)**

Run: `cd cli && npm test -- --run && npx tsc --noEmit && npm run build`
Then (needs real key, human-run): `personalize-cv` onboard → generate → `--list` select → `--show <id> --out /tmp/x.pdf` → `--report`.
Expected: analysis printed, PDF opens, report bars match web week logic.

- [ ] **Step 3: Commit + push**

```bash
git add cli/README.md README.md
git commit -m "docs(cli): usage for powershell/cmd/bash"
git push origin master
```
