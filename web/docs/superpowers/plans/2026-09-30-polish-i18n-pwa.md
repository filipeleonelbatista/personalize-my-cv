# Polish (Splash, Ícones, Ajuda, I18n, PWA, SEO) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship app polish: next-intl UI in pt-BR/en-US/es-ES, boot splash, light/dark icons, help dialog, Serwist PWA, and full SEO — keeping `output: export`.

**Architecture:** next-intl provider-only (no routing/middleware; locale in React state + `pmcv:locale`); lib errors via static message tables + optional locale param; `@serwist/next` SW with offline navigation fallback; metadata/manifest/icons committed.

**Tech Stack:** Next 15, React 19, next-intl 4, @serwist/next + serwist, sharp (dev, icon generation), Zod 3.24, Vitest 3.

**Spec:** `web/docs/superpowers/specs/2026-09-30-polish-i18n-pwa-design.md`

**Plan ruling (supersedes spec §2 naming):** UI locale IDs are `"pt-BR" | "en-US" | "es-ES"` (user explicitly requested EN-US/ES-ES tags); message files `messages/pt-BR.json`, `messages/en-US.json`, `messages/es-ES.json`. CV-content `BaseLang` (`pt-BR|en|es`) is untouched and independent.

## Global Constraints

- Build final 100% estático (`output: export`); sem Server Actions novas, sem middleware, sem redirect de locale.
- UI locale em `pmcv:locale`, Zod-validado no load, fallback `pt-BR`; `<html lang>` dinâmico.
- I18n traduz SÓ a UI; `BaseLang` de geração e `lib/pdf/i18n` intocados.
- secure-ls segue ofuscação anti-leitura-casual, não cofre.
- PDFs nunca persistidos; SW nunca faz cache de `generativelanguage.googleapis.com` (NetworkOnly explícito).
- TDD: teste falhando antes de cada implementação; commit por tarefa.

## Review Focus

- Locale corrompido em `pmcv:locale` deve cair em `pt-BR` sem crash — pinned in Task 1 (`loads pt-BR on garbage` test).
- POST à Gemini nunca servido do cache SW — pinned in Task 5 (NetworkOnly rule + test asserting matcher order).
- Chave de mensagem ausente num locale deve usar fallback `pt-BR` — pinned in Task 1 (fallback test) + keyset parity test failing the build on divergence.
- IA acionada offline deve avisar antes de chamar a API — pinned in Task 3 (offline guard test).
- Ícone/manifest 404 quebram install prompt — pinned in Task 4+5 (files-exist test + manifest validation test).

---

### Task 1: I18n foundation (next-intl, locale store, selector)

**Files:**
- Create: `web/messages/pt-BR.json`, `web/messages/en-US.json`, `web/messages/es-ES.json` (Common, Locale, Errors namespaces full; other namespaces `{}` extended in Tasks 2-3)
- Create: `web/lib/i18n/config.ts`
- Create: `web/lib/i18n/locale.ts`
- Create: `web/lib/i18n/provider.tsx`
- Create: `web/app/components/LocaleSelector.tsx`
- Modify: `web/lib/store.ts` (add `pmcv:locale`)
- Modify: `web/app/layout.tsx` (mount provider)
- Test: `web/tests/i18n.test.ts`

**Interfaces:**
- Consumes: nothing new (foundation).
- Produces: `UiLocale`, `LOCALES`, `DEFAULT_LOCALE`, `LOCALE_LABELS` from `@/lib/i18n/config`; `getLocale(): UiLocale`, `tErr(locale, key, vars?): string` from `@/lib/i18n/locale`; `<I18nProvider>` + `useUiLocale(): { locale, setLocale }` from `@/lib/i18n/provider`; `loadLocale(): UiLocale`, `saveLocale(l: UiLocale): void` from `@/lib/store`; `<LocaleSelector/>`.

- [ ] **Step 1: Install deps**

```bash
npm i next-intl
```

- [ ] **Step 2: Write the failing test**

```ts
// web/tests/i18n.test.ts
import { describe, expect, it, beforeEach } from "vitest";
import ptBR from "@/messages/pt-BR.json";
import enUS from "@/messages/en-US.json";
import esES from "@/messages/es-ES.json";
import { DEFAULT_LOCALE, LOCALES } from "@/lib/i18n/config";
import { getLocale, tErr } from "@/lib/i18n/locale";
import { loadLocale, saveLocale } from "@/lib/store";

function keys(o: unknown, prefix = ""): string[] {
  if (typeof o !== "object" || o === null) return [prefix];
  return Object.entries(o as Record<string, unknown>).flatMap(([k, v]) =>
    typeof v === "object" && v !== null ? keys(v, prefix ? `${prefix}.${k}` : k) : [prefix ? `${prefix}.${k}` : k],
  );
}
beforeEach(() => localStorage.clear());

describe("i18n", () => {
  it("supports exactly the 3 locales with pt-BR default", () => {
    expect([...LOCALES].sort()).toEqual(["en-US", "es-ES", "pt-BR"]);
    expect(DEFAULT_LOCALE).toBe("pt-BR");
  });
  it("all locales share the same keyset", () => {
    expect(keys(enUS).sort()).toEqual(keys(ptBR).sort());
    expect(keys(esES).sort()).toEqual(keys(ptBR).sort());
  });
  it("loads pt-BR on garbage locale", () => {
    localStorage.setItem("pmcv:locale", "xx");
    expect(loadLocale()).toBe("pt-BR");
    expect(getLocale()).toBe("pt-BR");
  });
  it("round-trips locale", () => {
    saveLocale("es-ES");
    expect(loadLocale()).toBe("es-ES");
  });
  it("lib errors translate per locale with pt-BR fallback", () => {
    expect(tErr("en-US", "noKey")).toMatch(/Gemini key/i);
    expect(tErr("es-ES", "noKey")).toMatch(/clave/i);
    expect(tErr("pt-BR", "noKey")).toMatch(/chave/i);
    expect(tErr("en-US", "missing.key" as never)).toBe(tErr("pt-BR", "missing.key" as never));
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- --run tests/i18n.test.ts` (em `web/`)
Expected: FAIL with "Cannot find module '@/messages/pt-BR.json'"

- [ ] **Step 4: Write minimal implementation**

```ts
// web/lib/i18n/config.ts
export const LOCALES = ["pt-BR", "en-US", "es-ES"] as const;
export type UiLocale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: UiLocale = "pt-BR";
export const LOCALE_LABELS: Record<UiLocale, string> = { "pt-BR": "PT-BR", "en-US": "EN-US", "es-ES": "ES-ES" };
```

```ts
// web/lib/i18n/locale.ts
import { z } from "zod";
import ptBR from "@/messages/pt-BR.json";
import enUS from "@/messages/en-US.json";
import esES from "@/messages/es-ES.json";
import { DEFAULT_LOCALE, type UiLocale } from "./config";

const LocaleSchema = z.enum(["pt-BR", "en-US", "es-ES"]);
const TABLES: Record<UiLocale, unknown> = { "pt-BR": ptBR, "en-US": enUS, "es-ES": esES };

export function getLocale(): UiLocale {
  try {
    const raw = localStorage.getItem("pmcv:locale");
    return LocaleSchema.parse(raw ?? DEFAULT_LOCALE);
  } catch {
    return DEFAULT_LOCALE;
  }
}

function lookup(table: unknown, key: string): string | null {
  let cur: unknown = table;
  for (const part of key.split(".")) {
    if (typeof cur !== "object" || cur === null) return null;
    cur = (cur as Record<string, unknown>)[part];
  }
  return typeof cur === "string" ? cur : null;
}

export function tErr(locale: UiLocale, key: string, vars?: Record<string, string | number>): string {
  const raw = lookup(TABLES[locale], key) ?? lookup(TABLES[DEFAULT_LOCALE], key) ?? key;
  return raw.replace(/\{(\w+)\}/g, (_, k: string) => String(vars?.[k] ?? `{${k}}`));
}
```

```tsx
// web/lib/i18n/provider.tsx
"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import ptBR from "@/messages/pt-BR.json";
import enUS from "@/messages/en-US.json";
import esES from "@/messages/es-ES.json";
import { DEFAULT_LOCALE, type UiLocale } from "./config";
import { loadLocale, saveLocale } from "@/lib/store";

const MESSAGES = { "pt-BR": ptBR, "en-US": enUS, "es-ES": esES } as const;
const Ctx = createContext<{ locale: UiLocale; setLocale: (l: UiLocale) => void }>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
});
export const useUiLocale = () => useContext(Ctx);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<UiLocale>(DEFAULT_LOCALE);
  useEffect(() => setLocaleState(loadLocale()), []);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  const setLocale = useCallback((l: UiLocale) => {
    saveLocale(l);
    setLocaleState(l);
  }, []);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "pmcv:locale" || e.key === null) setLocaleState(loadLocale());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return (
    <Ctx.Provider value={{ locale, setLocale }}>
      <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]} key={locale}>
        {children}
      </NextIntlClientProvider>
    </Ctx.Provider>
  );
}
```

```tsx
// web/app/components/LocaleSelector.tsx
"use client";
import { LOCALE_LABELS, LOCALES } from "@/lib/i18n/config";
import { useUiLocale } from "@/lib/i18n/provider";
import { useTranslations } from "next-intl";
import { Select } from "./ui/select";

export function LocaleSelector() {
  const { locale, setLocale } = useUiLocale();
  const t = useTranslations("Locale");
  return (
    <label className="flex items-center gap-1 text-sm">
      <span className="sr-only">{t("label")}</span>
      <Select value={locale} onChange={(e) => setLocale(e.target.value as typeof locale)} aria-label={t("aria")}>
        {LOCALES.map((l) => (
          <option key={l} value={l}>
            {LOCALE_LABELS[l]}
          </option>
        ))}
      </Select>
    </label>
  );
}
```

```ts
// web/lib/store.ts — append (after setOnboarded):
import { DEFAULT_LOCALE, type UiLocale } from "./i18n/config";
export function loadLocale(): UiLocale {
  try {
    const raw = localStorage.getItem("pmcv:locale");
    if (raw === "pt-BR" || raw === "en-US" || raw === "es-ES") return raw;
    return DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}
export function saveLocale(l: UiLocale): void {
  localStorage.setItem("pmcv:locale", l);
}
```

```tsx
// web/app/layout.tsx — wrap children with <I18nProvider> (import from "@/lib/i18n/provider");
// keep everything else identical.
```

Messages (only Common, Locale, Errors namespaces now; Tasks 2-3 extend the same files):

```json
// web/messages/pt-BR.json
{
  "Common": { "back": "Voltar", "cancel": "Cancelar", "save": "Salvar", "close": "Fechar", "retry": "Tentar novamente", "loading": "Carregando…" },
  "Locale": { "label": "Idioma", "aria": "Trocar idioma" },
  "Errors": {
    "noKey": "Configure a chave Gemini no onboarding.",
    "invalidKey": "Chave Gemini inválida (401/403). Confira em https://aistudio.google.com/apikey",
    "emptyResponse": "gemini: resposta vazia da IA.",
    "validateFailed": "Falha ao validar: {status}",
    "pasteKey": "Cole uma chave.",
    "noBase": "Cadastre o currículo base primeiro.",
    "jobShort": "Cole o texto da vaga (mín. 20 caracteres).",
    "notFound": "Registro não encontrado.",
    "unknownFail": "Falha desconhecida.",
    "invalidPdf": "Envie um arquivo PDF.",
    "emptyPdf": "PDF inválido ou vazio.",
    "unscannedPdf": "PDF sem texto selecionável — envie um PDF com texto, não escaneado.",
    "quota": "Armazenamento cheio — exporte o backup e limpe itens antigos.",
    "offline": "Sem conexão — a IA precisa de internet. Tente de novo online."
  }
}
```

```json
// web/messages/en-US.json
{
  "Common": { "back": "Go back", "cancel": "Cancel", "save": "Save", "close": "Close", "retry": "Try again", "loading": "Loading…" },
  "Locale": { "label": "Language", "aria": "Change language" },
  "Errors": {
    "noKey": "Set your Gemini key in onboarding.",
    "invalidKey": "Invalid Gemini key (401/403). Check https://aistudio.google.com/apikey",
    "emptyResponse": "gemini: empty AI response.",
    "validateFailed": "Validation failed: {status}",
    "pasteKey": "Paste a key.",
    "noBase": "Register your base resume first.",
    "jobShort": "Paste the job text (min. 20 characters).",
    "notFound": "Record not found.",
    "unknownFail": "Unknown failure.",
    "invalidPdf": "Send a PDF file.",
    "emptyPdf": "Invalid or empty PDF.",
    "unscannedPdf": "PDF has no selectable text — send a text PDF, not a scan.",
    "quota": "Storage full — export a backup and delete old items.",
    "offline": "Offline — the AI needs internet. Try again online."
  }
}
```

```json
// web/messages/es-ES.json
{
  "Common": { "back": "Volver", "cancel": "Cancelar", "save": "Guardar", "close": "Cerrar", "retry": "Reintentar", "loading": "Cargando…" },
  "Locale": { "label": "Idioma", "aria": "Cambiar idioma" },
  "Errors": {
    "noKey": "Configura tu clave de Gemini en el onboarding.",
    "invalidKey": "Clave de Gemini inválida (401/403). Revisa https://aistudio.google.com/apikey",
    "emptyResponse": "gemini: respuesta vacía de la IA.",
    "validateFailed": "Validación fallida: {status}",
    "pasteKey": "Pega una clave.",
    "noBase": "Registra tu CV base primero.",
    "jobShort": "Pega el texto de la vacante (mín. 20 caracteres).",
    "notFound": "Registro no encontrado.",
    "unknownFail": "Fallo desconocido.",
    "invalidPdf": "Envía un archivo PDF.",
    "emptyPdf": "PDF inválido o vacío.",
    "unscannedPdf": "El PDF no tiene texto seleccionable — envía un PDF con texto, no escaneado.",
    "quota": "Almacenamiento lleno — exporta una copia y borra elementos antiguos.",
    "offline": "Sin conexión — la IA necesita internet. Inténtalo en línea."
  }
}
```

TypeScript: JSON imports need `resolveJsonModule` — check `web/tsconfig.json`; if off, enable it in this task (required for next-intl static messages).

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- --run tests/i18n.test.ts` (em `web/`)
Expected: PASS (5 testes)

- [ ] **Step 6: Commit**

```bash
git add web/messages web/lib/i18n web/lib/store.ts web/app/layout.tsx web/app/components/LocaleSelector.tsx web/tests/i18n.test.ts web/tsconfig.json
git commit -m "feat: i18n foundation next-intl + locale store"
```

### Task 2: Lib errors localizados + tradução do núcleo (Page, Onboarding, Base, Dashboard)

**Files:**
- Modify: `web/lib/llm/gemini.ts` (optional `locale` param, messages via `tErr`)
- Modify: `web/lib/llm/chain.ts` (optional `locale` param + validate messages via `tErr`)
- Modify: `web/lib/cv-text-client.ts` (optional `locale` param)
- Modify: `web/lib/store.ts` (`QUOTA_MESSAGE` → `quotaMessage(locale?)`, keep `QUOTA_MESSAGE` export as pt-BR alias)
- Modify: `web/lib/tailor-client.ts` (pass locale through; translate its 5 hardcoded PT strings via `tErr`)
- Modify: `web/tests/llm-chain.test.ts`, `web/tests/store.test.ts`, `web/tests/cv-text-client.test.ts`, `web/tests/tailor-retry.test.ts` (pass `"pt-BR"` explicitly where PT asserted)
- Modify: `web/messages/*.json` (add Page, Onboarding, Base, Dashboard, Theme, Dropzone namespaces below)
- Modify: `web/app/page.tsx`, `web/app/components/Onboarding.tsx`, `web/app/components/BaseSetup.tsx`, `web/app/components/BaseMenu.tsx`, `web/app/components/BaseSetupDialog.tsx`, `web/app/components/DashboardTabs.tsx`, `web/app/components/theme-toggle.tsx`, `web/app/components/ui/dropzone.tsx` (all strings via `useTranslations`)
- Test: extend `web/tests/i18n.test.ts` (lib error spot-checks en-US/es-ES)

**Interfaces:**
- Consumes: Task 1 (`UiLocale`, `getLocale`, `tErr`, provider).
- Produces: locale-aware lib signatures used by Task 3: `validateGeminiKey(key, locale?: UiLocale)`, `chatJsonGemini(system, user, key, model?, locale?)`, `generateJson(system, user, key, models?, locale?)`, `extractCvTextFromFile(file, locale?)`, `quotaMessage(locale?): string`, `runTailorJob(jobText, lang, locale?)`, `retryStoredApp(id, locale?)`.

Lib error keys (new `Errors` entries, values below in all 3 locales): `tailFail: "As IAs falharam. Vaga salva como failed para retry. Detalhe: {msg}"`, `retryFailDetail: "Retry falhou. Detalhe: {msg}"`.
- en-US: `tailFail: "The AIs failed. Job saved as failed for retry. Detail: {msg}"`, `retryFailDetail: "Retry failed. Detail: {msg}"`.
- es-ES: `tailFail: "Las IAs fallaron. Vacante guardada como failed para reintentar. Detalle: {msg}"`, `retryFailDetail: "Reintento fallido. Detalle: {msg}"`.

New message namespaces (add to ALL THREE files; en-US/es-ES translations provided):

Page — pt-BR: `{ "tagline": "Currículos sob medida com IA", "baseLine": "Base: {nome} — {titulo}", "noBaseCta": "Envie seu currículo em PDF para começar. A IA vai catalogar seus dados e criar o JSON base.", "sendBase": "Enviar currículo base", "catalogDesc": "A IA vai catalogar seus dados e criar o JSON base." }`
Page — en-US: `{ "tagline": "Tailored resumes with AI", "baseLine": "Base: {nome} — {titulo}", "noBaseCta": "Upload your base resume PDF to start. The AI will catalog your data and create the base JSON.", "sendBase": "Upload base resume", "catalogDesc": "The AI will catalog your data and create the base JSON." }`
Page — es-ES: `{ "tagline": "Currículums a medida con IA", "baseLine": "Base: {nome} — {titulo}", "noBaseCta": "Sube tu CV base en PDF para empezar. La IA catalogará tus datos y creará el JSON base.", "sendBase": "Subir CV base", "catalogDesc": "La IA catalogará tus datos y creará el JSON base." }`

Onboarding — pt-BR: `{ "stage1": "Extraindo texto do PDF…", "stage2": "IA catalogando experiências…", "stage3": "Validando e salvando base…", "welcomeTitle": "Bem-vindo ao Personalize My CV", "howItWorks": "Como funciona", "stepOf": "Passo {n} de 3", "b1": "1. Você cadastra seu currículo base em PDF — a IA cataloga tudo em JSON.", "b2": "2. Para cada vaga, geramos um CV sob medida com match, pontos fortes/fracos, email e mensagem.", "b3": "3. Tudo fica no seu browser (localStorage) com sua própria chave Gemini.", "start": "Começar", "connectTitle": "Conectar Gemini", "connectDesc": "Crie sua chave e cole abaixo", "createKeyLink": "Criar chave em aistudio.google.com/apikey", "keyPlaceholder": "Cole a GEMINI_API_KEY", "validate": "Validar e continuar", "validating": "Validando…", "createTitle": "Criar base", "createDesc": "Envie seu currículo em PDF para a IA catalogar", "cvLang": "Idioma do currículo", "createBtn": "Criar currículo base", "baseCreated": "Currículo base criado!", "storageFull": "Armazenamento cheio" }`
Onboarding — en-US: `{ "stage1": "Extracting PDF text…", "stage2": "AI cataloging experience…", "stage3": "Validating and saving base…", "welcomeTitle": "Welcome to Personalize My CV", "howItWorks": "How it works", "stepOf": "Step {n} of 3", "b1": "1. You register your base resume PDF — the AI catalogs everything into JSON.", "b2": "2. For each job, we generate a tailored CV with match, strengths/weaknesses, email and message.", "b3": "3. Everything stays in your browser (localStorage) with your own Gemini key.", "start": "Get started", "connectTitle": "Connect Gemini", "connectDesc": "Create your key and paste it below", "createKeyLink": "Create a key at aistudio.google.com/apikey", "keyPlaceholder": "Paste the GEMINI_API_KEY", "validate": "Validate and continue", "validating": "Validating…", "createTitle": "Create base", "createDesc": "Upload your resume PDF for the AI to catalog", "cvLang": "Resume language", "createBtn": "Create base resume", "baseCreated": "Base resume created!", "storageFull": "Storage full" }`
Onboarding — es-ES: `{ "stage1": "Extrayendo texto del PDF…", "stage2": "IA catalogando experiencia…", "stage3": "Validando y guardando base…", "welcomeTitle": "Bienvenido a Personalize My CV", "howItWorks": "Cómo funciona", "stepOf": "Paso {n} de 3", "b1": "1. Registras tu CV base en PDF — la IA lo cataloga todo en JSON.", "b2": "2. Para cada vacante, generamos un CV a medida con match, fortalezas/debilidades, email y mensaje.", "b3": "3. Todo queda en tu navegador (localStorage) con tu propia clave de Gemini.", "start": "Empezar", "connectTitle": "Conectar Gemini", "connectDesc": "Crea tu clave y pégala abajo", "createKeyLink": "Crear una clave en aistudio.google.com/apikey", "keyPlaceholder": "Pega la GEMINI_API_KEY", "validate": "Validar y continuar", "validating": "Validando…", "createTitle": "Crear base", "createDesc": "Sube tu CV en PDF para que la IA lo catalogue", "cvLang": "Idioma del currículum", "createBtn": "Crear CV base", "baseCreated": "¡CV base creado!", "storageFull": "Almacenamiento lleno" }`

Base — pt-BR: `{ "title": "Criar currículo base", "desc": "Envie seu currículo em PDF. A IA vai catalogar seus dados e criar o JSON base.", "cvLang": "Idioma do currículo", "submit": "Criar currículo base", "stage1": "Extraindo texto do PDF…", "stage2": "IA catalogando experiências…", "stage3": "Validando e salvando base…", "failTitle": "Falha ao criar base", "options": "Opções do currículo base", "print": "Imprimir currículo base", "update": "Atualizar currículo", "updateTitle": "Atualizar currículo", "updateDesc": "A IA vai recatalogar seus dados a partir do novo PDF." }`
Base — en-US: `{ "title": "Create base resume", "desc": "Upload your resume PDF. The AI will catalog your data and create the base JSON.", "cvLang": "Resume language", "submit": "Create base resume", "stage1": "Extracting PDF text…", "stage2": "AI cataloging experience…", "stage3": "Validating and saving base…", "failTitle": "Failed to create base", "options": "Base resume options", "print": "Print base resume", "update": "Update resume", "updateTitle": "Update resume", "updateDesc": "The AI will re-catalog your data from the new PDF." }`
Base — es-ES: `{ "title": "Crear CV base", "desc": "Sube tu CV en PDF. La IA catalogará tus datos y creará el JSON base.", "cvLang": "Idioma del currículum", "submit": "Crear CV base", "stage1": "Extrayendo texto del PDF…", "stage2": "IA catalogando experiencia…", "stage3": "Validando y guardando base…", "failTitle": "No se pudo crear la base", "options": "Opciones del CV base", "print": "Imprimir CV base", "update": "Actualizar currículum", "updateTitle": "Actualizar currículum", "updateDesc": "La IA recatalogará tus datos desde el nuevo PDF." }`

Dashboard — pt-BR: `{ "resumes": "Currículos", "reports": "Relatórios" }`; en-US: `{ "resumes": "Resumes", "reports": "Reports" }`; es-ES: `{ "resumes": "Currículums", "reports": "Informes" }`.
Theme — pt-BR: `{ "toggle": "Alternar tema" }`; en-US: `{ "toggle": "Toggle theme" }`; es-ES: `{ "toggle": "Cambiar tema" }`.
Dropzone — pt-BR: `{ "cta": "Arraste o PDF aqui ou clique para selecionar", "onlyPdf": "Apenas arquivos .pdf", "remove": "Remover arquivo" }`; en-US: `{ "cta": "Drag the PDF here or click to select", "onlyPdf": "Only .pdf files", "remove": "Remove file" }`; es-ES: `{ "cta": "Arrastra el PDF aquí o haz clic para seleccionar", "onlyPdf": "Solo archivos .pdf", "remove": "Quitar archivo" }`.

CV-language option labels stay as-is (`Português (BR)/English/Español`) in all locales — they name the CV content language, not the UI.

- [ ] **Step 1: Write the failing test** — extend `web/tests/i18n.test.ts`:

```ts
it("lib errors resolve per locale", async () => {
  const { validateGeminiKey } = await import("@/lib/llm/chain");
  const en = await validateGeminiKey("", "en-US");
  expect(en.ok).toBe(false);
  if (!en.ok) expect(en.error).toMatch(/Paste a key/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/i18n.test.ts` (em `web/`)
Expected: FAIL (validateGeminiKey takes 1 arg; returns PT "Cole uma chave.")

- [ ] **Step 3: Write minimal implementation** — locale params in the 4 lib files (pattern per function):

```ts
import { getLocale, tErr, type UiLocale } from "@/lib/i18n/locale"; // path-adjusted per file
export async function validateGeminiKey(key: string, locale: UiLocale = getLocale()) {
  if (!key.trim()) return { ok: false, error: tErr(locale, "Errors.pasteKey") };
  // ... 401/403 → tErr(locale, "Errors.invalidKey"); other → tErr(locale, "Errors.validateFailed", { status: res.status })
}
```

`chatJsonGemini(..., locale: UiLocale = getLocale())`: no-key → `Errors.noKey`, 401/403 → `Errors.invalidKey`, empty → `Errors.emptyResponse`. `generateJson(..., locale?)` forwards to chatJsonGemini. `extractCvTextFromFile(file, locale?)`: `Errors.invalidPdf/emptyPdf/unscannedPdf`. `tailor-client.ts`: `runTailorJob(jobText, lang, locale = getLocale())` — jobShort/noBase/unknownFail/tailFail via tErr; `retryStoredApp(id, locale?)` — notFound/retryFailDetail via tErr; `quotaMessage(locale?)` in store.ts with `QUOTA_MESSAGE` kept as `quotaMessage("pt-BR")`. Components: replace every hardcoded string with `useTranslations("<Ns>")`; stages via `t("stage1")` etc; `STAGES` consts become `const stages = [t("stage1"), t("stage2"), t("stage3")]`. Update old tests to pass `"pt-BR"`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run` (em `web/`)
Expected: PASS full suite

- [ ] **Step 5: Commit**

```bash
git add web/lib web/messages web/app tests
git commit -m "feat: i18n nucleo UI + erros lib localizados"
```

### Task 3: Tradução dos fluxos + HelpDialog + cluster do header + guarda offline

**Files:**
- Create: `web/app/components/HelpDialog.tsx`
- Modify: `web/messages/*.json` (add Generate, Vacancy, Detail, Reports, Settings, Help, Offline namespaces)
- Modify: `web/app/components/GenerateModal.tsx`, `web/app/components/VacancyTable.tsx`, `web/app/components/DetailDrawer.tsx`, `web/app/components/ReportsSection.tsx`, `web/app/components/SettingsDialog.tsx` (all strings via `useTranslations`)
- Modify: `web/app/page.tsx` (header cluster `[LocaleSelector][HelpDialog][ThemeToggle]` in BOTH phases; remove `BaseSetupDialog` fallback block? No — keep `!base` dashboard-branch fallback as-is, only header changes)
- Modify: `web/lib/report.ts` — NO (keep pure); weekday labels translate in ReportsSection via locale map below
- Test: extend `web/tests/ui-contract.test.ts`

**Interfaces:**
- Consumes: Task 1-2 (provider, `tErr`, locale params).
- Produces: `<HelpDialog/>` (no props); header cluster pattern reused by Task 4 splash? No — splash replaces loading phase only.

Weekday labels per UI locale (component-side map in ReportsSection): `pt-BR: ["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"]`, `en-US: ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]`, `es-ES: ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"]` — replaces `WEEKDAY_LABELS` import (keep lib export for tests).

New namespaces (all 3 locales):

Generate — pt-BR: `{ "open": "Personalizar com IA", "title": "Nova vaga", "desc": "Cole o texto da vaga (requisitos, responsabilidades, empresa).", "cvLang": "Idioma do currículo", "placeholder": "Cole aqui a descrição da vaga...", "stage1": "Lendo a vaga…", "stage2": "Reescrevendo com keywords…", "stage3": "Gerando PDF e análise…", "loadingNote": "(pode levar 1–2 min)", "generating": "Gerando…", "submit": "Gerar currículo", "cancel": "Cancelar", "success": "Currículo personalizado gerado!", "refreshTable": "Atualizar tabela" }`
Generate — en-US: `{ "open": "Tailor with AI", "title": "New job", "desc": "Paste the job text (requirements, responsibilities, company).", "cvLang": "Resume language", "placeholder": "Paste the job description here...", "stage1": "Reading the job…", "stage2": "Rewriting with keywords…", "stage3": "Generating PDF and analysis…", "loadingNote": "(may take 1–2 min)", "generating": "Generating…", "submit": "Generate resume", "cancel": "Cancel", "success": "Tailored resume generated!", "refreshTable": "Refresh table" }`
Generate — es-ES: `{ "open": "Personalizar con IA", "title": "Nueva vacante", "desc": "Pega el texto de la vacante (requisitos, responsabilidades, empresa).", "cvLang": "Idioma del currículum", "placeholder": "Pega aquí la descripción de la vacante...", "stage1": "Leyendo la vacante…", "stage2": "Reescribiendo con keywords…", "stage3": "Generando PDF y análisis…", "loadingNote": "(puede tardar 1–2 min)", "generating": "Generando…", "submit": "Generar currículum", "cancel": "Cancelar", "success": "¡Currículum personalizado generado!", "refreshTable": "Actualizar tabla" }`

Vacancy — pt-BR: `{ "empty": "Nenhum currículo gerado ainda. Clique em “Personalizar com IA”.", "colRole": "Cargo", "colCompany": "Empresa", "colMatch": "Match", "colStatus": "Status", "colDate": "Data", "colActions": "Ações", "done": "Pronto", "failed": "Falhou", "view": "Ver", "download": "Baixar", "print": "Imprimir", "retry": "Tentar novamente", "delete": "Excluir", "confirmDelete": "Excluir este currículo? O PDF também será apagado.", "deleted": "Currículo excluído!", "deleteFail": "Falha ao excluir", "regenerated": "Currículo regenerado!", "retryFail": "Retry falhou", "showing": "Mostrando {start}–{end} de {total}", "prev": "Anterior", "next": "Próxima", "page": "Página {current} de {count}", "perPage": "por página" }`
Vacancy — en-US: `{ "empty": "No resumes yet. Click “Tailor with AI”.", "colRole": "Role", "colCompany": "Company", "colMatch": "Match", "colStatus": "Status", "colDate": "Date", "colActions": "Actions", "done": "Ready", "failed": "Failed", "view": "View", "download": "Download", "print": "Print", "retry": "Try again", "delete": "Delete", "confirmDelete": "Delete this resume? The PDF will also be removed.", "deleted": "Resume deleted!", "deleteFail": "Failed to delete", "regenerated": "Resume regenerated!", "retryFail": "Retry failed", "showing": "Showing {start}–{end} of {total}", "prev": "Previous", "next": "Next", "page": "Page {current} of {count}", "perPage": "per page" }`
Vacancy — es-ES: `{ "empty": "Aún no hay currículums. Haz clic en “Personalizar con IA”.", "colRole": "Puesto", "colCompany": "Empresa", "colMatch": "Match", "colStatus": "Estado", "colDate": "Fecha", "colActions": "Acciones", "done": "Listo", "failed": "Falló", "view": "Ver", "download": "Descargar", "print": "Imprimir", "retry": "Reintentar", "delete": "Eliminar", "confirmDelete": "¿Eliminar este currículum? El PDF también se borrará.", "deleted": "¡Currículum eliminado!", "deleteFail": "No se pudo eliminar", "regenerated": "¡Currículum regenerado!", "retryFail": "Reintento fallido", "showing": "Mostrando {start}–{end} de {total}", "prev": "Anterior", "next": "Siguiente", "page": "Página {current} de {count}", "perPage": "por página" }`

Detail — pt-BR: `{ "generatedAt": "Gerado em {date} • {file}", "download": "Baixar PDF", "print": "Imprimir", "noPdf": "PDF não gerado. Erro: {error}", "affinity": "Afinidade com a vaga: {n}%", "strengths": "Pontos fortes", "weaknesses": "Pontos fracos", "email": "Email de apresentação", "chat": "Mensagem instantânea", "copied": "{label} copiado!", "viewJob": "Ver texto original da vaga" }`
Detail — en-US: `{ "generatedAt": "Generated on {date} • {file}", "download": "Download PDF", "print": "Print", "noPdf": "PDF not generated. Error: {error}", "affinity": "Job match: {n}%", "strengths": "Strengths", "weaknesses": "Weaknesses", "email": "Cover email", "chat": "Instant message", "copied": "{label} copied!", "viewJob": "View original job text" }`
Detail — es-ES: `{ "generatedAt": "Generado el {date} • {file}", "download": "Descargar PDF", "print": "Imprimir", "noPdf": "PDF no generado. Error: {error}", "affinity": "Afinidad con la vacante: {n}%", "strengths": "Fortalezas", "weaknesses": "Debilidades", "email": "Email de presentación", "chat": "Mensaje instantáneo", "copied": "¡{label} copiado!", "viewJob": "Ver texto original de la vacante" }`

Reports — pt-BR: `{ "prevWeek": "Semana anterior", "nextWeek": "Próxima semana", "empty": "Sem currículos gerados nesta semana.", "totalWeek": "Total na semana", "avgDay": "Média por dia", "bestDay": "Melhor dia", "chartTitle": "Currículos por dia da semana" }`
Reports — en-US: `{ "prevWeek": "Previous week", "nextWeek": "Next week", "empty": "No resumes generated this week.", "totalWeek": "Week total", "avgDay": "Daily average", "bestDay": "Best day", "chartTitle": "Resumes per weekday" }`
Reports — es-ES: `{ "prevWeek": "Semana anterior", "nextWeek": "Próxima semana", "empty": "Sin currículums generados esta semana.", "totalWeek": "Total de la semana", "avgDay": "Media por día", "bestDay": "Mejor día", "chartTitle": "Currículums por día de la semana" }`

Settings — pt-BR: `{ "open": "Configurações", "title": "Configurações", "desc": "Gerencie sua chave Gemini (armazenada no browser).", "createKeyLink": "Criar chave em aistudio.google.com/apikey", "keyPlaceholder": "GEMINI_API_KEY", "modelsLegend": "Models (ordem de tentativa)", "customPlaceholder": "Outros models, separados por vírgula", "minOneModel": "Selecione ao menos um model.", "cancel": "Cancelar", "clearKey": "Remover chave", "confirmClear": "Remover a chave Gemini e voltar ao onboarding? Seus dados locais são mantidos.", "save": "Salvar", "validating": "Validando…", "updated": "Configurações atualizadas!", "backup": "Backup", "export": "Exportar backup", "import": "Importar backup", "exported": "Backup exportado!", "imported": "Backup importado!", "invalidBackup": "Backup inválido" }`
Settings — en-US: `{ "open": "Settings", "title": "Settings", "desc": "Manage your Gemini key (stored in the browser).", "createKeyLink": "Create a key at aistudio.google.com/apikey", "keyPlaceholder": "GEMINI_API_KEY", "modelsLegend": "Models (attempt order)", "customPlaceholder": "Other models, comma separated", "minOneModel": "Select at least one model.", "cancel": "Cancel", "clearKey": "Remove key", "confirmClear": "Remove the Gemini key and go back to onboarding? Your local data is kept.", "save": "Save", "validating": "Validating…", "updated": "Settings updated!", "backup": "Backup", "export": "Export backup", "import": "Import backup", "exported": "Backup exported!", "imported": "Backup imported!", "invalidBackup": "Invalid backup" }`
Settings — es-ES: `{ "open": "Ajustes", "title": "Ajustes", "desc": "Gestiona tu clave de Gemini (guardada en el navegador).", "createKeyLink": "Crear una clave en aistudio.google.com/apikey", "keyPlaceholder": "GEMINI_API_KEY", "modelsLegend": "Modelos (orden de intento)", "customPlaceholder": "Otros modelos, separados por comas", "minOneModel": "Selecciona al menos un modelo.", "cancel": "Cancelar", "clearKey": "Quitar clave", "confirmClear": "¿Quitar la clave de Gemini y volver al onboarding? Tus datos locales se conservan.", "save": "Guardar", "validating": "Validando…", "updated": "¡Ajustes actualizados!", "backup": "Copia", "export": "Exportar copia", "import": "Importar copia", "exported": "¡Copia exportada!", "imported": "¡Copia importada!", "invalidBackup": "Copia inválida" }`

Help — pt-BR: `{ "open": "Como usar o app", "title": "Como usar", "desc": "Do zero ao CV sob medida em 4 passos.", "s1t": "1. Conecte sua chave Gemini", "s1d": "Crie uma chave gratuita em aistudio.google.com/apikey e cole no onboarding ou em Configurações. Ela fica só no seu browser.", "s2t": "2. Cadastre o currículo base", "s2d": "Envie seu CV em PDF com texto selecionável. A IA cataloga tudo em JSON.", "s3t": "3. Gere por vaga", "s3d": "Cole o texto da vaga e gere: match, pontos fortes/fracos, email e mensagem. Falhou? Use o retry.", "s4t": "4. Backup e idioma", "s4d": "Exporte o backup em Configurações. Troque o idioma da interface no seletor do topo — o idioma do CV é escolhido a cada geração." }`
Help — en-US: `{ "open": "How to use the app", "title": "How to use", "desc": "From zero to tailored CV in 4 steps.", "s1t": "1. Connect your Gemini key", "s1d": "Create a free key at aistudio.google.com/apikey and paste it in onboarding or Settings. It stays in your browser only.", "s2t": "2. Register the base resume", "s2d": "Upload your PDF resume with selectable text. The AI catalogs everything into JSON.", "s3t": "3. Generate per job", "s3d": "Paste the job text and generate: match, strengths/weaknesses, email and message. Failed? Use retry.", "s4t": "4. Backup and language", "s4d": "Export a backup in Settings. Switch the UI language in the top selector — the CV language is chosen per generation." }`
Help — es-ES: `{ "open": "Cómo usar la app", "title": "Cómo usar", "desc": "De cero al CV a medida en 4 pasos.", "s1t": "1. Conecta tu clave de Gemini", "s1d": "Crea una clave gratuita en aistudio.google.com/apikey y pégala en el onboarding o en Ajustes. Queda solo en tu navegador.", "s2t": "2. Registra el CV base", "s2d": "Sube tu CV en PDF con texto seleccionable. La IA lo cataloga todo en JSON.", "s3t": "3. Genera por vacante", "s3d": "Pega el texto de la vacante y genera: match, fortalezas/debilidades, email y mensaje. ¿Falló? Usa reintentar.", "s4t": "4. Copia e idioma", "s4d": "Exporta una copia en Ajustes. Cambia el idioma de la interfaz en el selector superior — el idioma del CV se elige en cada generación." }`

```tsx
// web/app/components/HelpDialog.tsx
"use client";
import { useState } from "react";
import { LuCircleHelp } from "react-icons/lu";
import { useTranslations } from "next-intl";
import { Button } from "./ui/button";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";

export function HelpDialog() {
  const [open, setOpen] = useState(false);
  const t = useTranslations("Help");
  return (
    <>
      <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label={t("open")}>
        <LuCircleHelp />
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("desc")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-4 text-sm">
          {["s1", "s2", "s3", "s4"].map((s) => (
            <div key={s}>
              <p className="font-bold">{t(`${s}t`)}</p>
              <p className="text-muted-foreground">{t(`${s}d`)}</p>
            </div>
          ))}
        </div>
      </Dialog>
    </>
  );
}
```

Header cluster (both phases in `page.tsx`): replace `<ThemeToggle />` with `<div className="flex items-center gap-1"><LocaleSelector /><HelpDialog /><ThemeToggle /></div>` (+ imports).

Offline guard (GenerateModal `onGenerate`, VacancyTable `onRetry`, Onboarding `onCreateBase`): first line `if (!navigator.onLine) { toast.error(tErr(getLocale(), "Errors.offline")); return; }` — import `getLocale, tErr` from `@/lib/i18n/locale` (component already inside provider; `tErr` avoids extra hook wiring for the toast path).

- [ ] **Step 1: Write the failing test** — extend `web/tests/ui-contract.test.ts`:

```ts
it("header has locale selector, help and theme", () => {
  const s = readFileSync("app/page.tsx", "utf8");
  expect(s).toContain("LocaleSelector");
  expect(s).toContain("HelpDialog");
  expect(s).toContain("ThemeToggle");
});
it("no hardcoded PT UI strings remain in flows", () => {
  for (const f of ["app/components/GenerateModal.tsx", "app/components/VacancyTable.tsx", "app/components/DetailDrawer.tsx", "app/components/ReportsSection.tsx", "app/components/SettingsDialog.tsx"]) {
    const s = readFileSync(f, "utf8");
    expect(s).not.toMatch(/Currículos|Relatórios|Personalizar com IA|Baixar|Excluir|Configurações/);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/ui-contract.test.ts` (em `web/`)
Expected: FAIL (page.tsx has no LocaleSelector yet)

- [ ] **Step 3: Write minimal implementation** — dicts + `useTranslations` in the 5 components + HelpDialog + header + offline guards (toast strings for success/fail use `t("...")` from component scope; lib-returned errors pass through).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run` (em `web/`)
Expected: PASS full suite (keyset parity test guards the 3 JSONs)

- [ ] **Step 5: Commit**

```bash
git add web/messages web/app tests
git commit -m "feat: i18n fluxos + ajuda + header + offline guard"
```

### Task 4: Splash + ícones claro/escuro

**Files:**
- Create: `web/app/components/SplashScreen.tsx`
- Create: `web/app/icon.svg`
- Create: `web/scripts/gen-icons.mjs`
- Create: `web/public/icon-192.png`, `web/public/icon-512.png`, `web/public/maskable-512.png`, `web/public/apple-touch-icon.png` (generated, committed)
- Modify: `web/app/page.tsx` (loading phase → `<SplashScreen/>`)
- Modify: `web/app/layout.tsx` (icons metadata)
- Modify: `web/package.json` (sharp devDep + `icons` script)
- Test: extend `web/tests/ui-contract.test.ts`

**Interfaces:**
- Consumes: Task 1 (`useTranslations`; Splash namespace added here to all 3 JSONs).
- Produces: `<SplashScreen/>`; icon files at `public/*`.

Splash namespace — pt-BR: `{ "loading": "Carregando seus dados…" }`; en-US: `{ "loading": "Loading your data…" }`; es-ES: `{ "loading": "Cargando tus datos…" }`.

```tsx
// web/app/components/SplashScreen.tsx
"use client";
import { useTranslations } from "next-intl";
import { LuLoaderCircle } from "react-icons/lu";

export function SplashScreen() {
  const t = useTranslations("Splash");
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center gap-4 p-6 text-center" aria-busy="true" aria-label={t("loading")}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon-192.png" alt="" width={96} height={96} className="rounded-3xl" />
      <h1 className="text-2xl font-bold tracking-tight">Personalize My CV</h1>
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <LuLoaderCircle className="animate-spin" /> {t("loading")}
      </p>
    </main>
  );
}
```

```svg
<!-- web/app/icon.svg — served as /icon.svg; adaptive via prefers-color-scheme -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <style>
    .bg { fill: #ffffff; }
    .fg { fill: #09090b; }
    .accent { fill: #2563eb; }
    @media (prefers-color-scheme: dark) {
      .bg { fill: #09090b; }
      .fg { fill: #fafafa; }
    }
  </style>
  <rect class="bg" width="512" height="512" rx="112"/>
  <text class="fg" x="256" y="270" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="800" font-size="150">PC</text>
  <rect class="accent" x="156" y="320" width="200" height="24" rx="12"/>
  <rect class="fg" x="186" y="360" width="140" height="14" rx="7" opacity="0.55"/>
</svg>
```

```js
// web/scripts/gen-icons.mjs — node scripts/gen-icons.mjs (requires sharp)
import sharp from "sharp";
const jobs = [
  ["app/icon.svg", "public/icon-192.png", 192, 0],
  ["app/icon.svg", "public/icon-512.png", 512, 0],
  ["app/icon.svg", "public/maskable-512.png", 512, 64],
  ["app/icon.svg", "public/apple-touch-icon.png", 180, 0],
];
for (const [src, dest, size, pad] of jobs) {
  const inner = size - pad * 2;
  const png = await sharp(src).resize(inner, inner).png().toBuffer();
  if (!pad) await sharp(png).toFile(dest);
  else {
    await sharp({ create: { width: size, height: size, channels: 4, background: { r: 9, g: 9, b: 11, alpha: 1 } } })
      .composite([{ input: png, left: pad, top: pad }]).png().toFile(dest);
  }
  console.log("wrote", dest);
}
```

`package.json`: add `"icons": "node scripts/gen-icons.mjs"` script + `sharp` devDependency (`npm i -D sharp`); run once and commit PNGs. `layout.tsx` icons: `icons: { icon: [{ url: "/icon-192.png", sizes: "192x192" }, { url: "/icon.svg", type: "image/svg+xml" }], apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }] }`. `page.tsx`: `if (phase === "loading") return <SplashScreen />;` (keep `loading.tsx` file for route transitions).

- [ ] **Step 1: Write the failing test**

```ts
it("splash + icons wired", () => {
  expect(readFileSync("app/page.tsx", "utf8")).toContain("SplashScreen");
  for (const f of ["public/icon-192.png", "public/icon-512.png", "public/maskable-512.png", "public/apple-touch-icon.png", "app/icon.svg"]) {
    expect(existsSync(f), f).toBe(true);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/ui-contract.test.ts` (em `web/`)
Expected: FAIL (no SplashScreen yet)

- [ ] **Step 3: Write minimal implementation** — files above; min display: Splash resolves with store read (synchronous) — add 400ms minimum via `await new Promise((r) => setTimeout(r, 400))` alongside `document.fonts.ready` in the gate effect to avoid flash (documented standard practice; state it in code comment).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run` (em `web/`)
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/app web/public web/scripts web/package.json web/tests
git commit -m "feat: splash + icones claro escuro"
```

### Task 5: PWA (Serwist + manifest + offline)

**Files:**
- Create: `web/app/sw.ts`
- Create: `web/app/offline/page.tsx`
- Create: `web/app/components/SwRegister.tsx`
- Create: `web/public/manifest.webmanifest`
- Create: `web/tests/pwa.test.ts`
- Modify: `web/next.config.ts` (withSerwist wrap)
- Modify: `web/app/layout.tsx` (manifest link via metadata + `<SwRegister/>`, Offline namespace not needed — offline page uses static PT? No: use `useTranslations("Offline")`, namespace added here)
- Modify: `web/package.json` (@serwist/next + serwist deps)

**Interfaces:**
- Consumes: Task 1 (provider covers `/offline` route too).
- Produces: `/sw.js` at build output; offline fallback at `/offline`.

Offline namespace — pt-BR: `{ "title": "Você está offline", "desc": "O app abre sem internet, mas gerar currículos precisa de conexão com a API Gemini.", "retry": "Tentar de novo" }`; en-US: `{ "title": "You're offline", "desc": "The app opens without internet, but generating resumes needs a Gemini API connection.", "retry": "Try again" }`; es-ES: `{ "title": "Sin conexión", "desc": "La app abre sin internet, pero generar currículums necesita conexión con la API de Gemini.", "retry": "Reintentar" }`.

```ts
// web/next.config.ts
import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";
const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  cacheOnNavigation: true,
  additionalPrecacheEntries: [{ url: "/offline", revision: "v1" }],
});
const nextConfig: NextConfig = { output: "export" };
export default withSerwist(nextConfig);
```

```ts
// web/app/sw.ts
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { NetworkOnly, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}
declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      matcher: ({ url }) => url.hostname === "generativelanguage.googleapis.com",
      handler: new NetworkOnly(),
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [{ url: "/offline", matcher: ({ request }) => request.destination === "document" }],
  },
});
serwist.addEventListeners();
```

```json
// web/public/manifest.webmanifest
{
  "name": "Personalize My CV",
  "short_name": "PMCV",
  "description": "Currículos sob medida com IA, no seu browser.",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "background_color": "#09090b",
  "theme_color": "#ffffff",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

```tsx
// web/app/components/SwRegister.tsx
"use client";
import { useEffect } from "react";
export function SwRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
```

```tsx
// web/app/offline/page.tsx
"use client";
import { useTranslations } from "next-intl";
import { Button } from "../components/ui/button";
export default function Offline() {
  const t = useTranslations("Offline");
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-xl font-bold">{t("title")}</h1>
      <p className="text-sm text-muted-foreground">{t("desc")}</p>
      <Button onClick={() => window.location.reload()}>{t("retry")}</Button>
    </main>
  );
}
```

If `withSerwist` proves incompatible with `output: export` (build error), STOP and report BLOCKED with the build log — controller rules (fallback: hand-written SW). Do not silently ship without `out/sw.js`.

- [ ] **Step 1: Write the failing test**

```ts
// web/tests/pwa.test.ts
import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
describe("pwa", () => {
  it("manifest is valid with required icons", () => {
    const m = JSON.parse(readFileSync("public/manifest.webmanifest", "utf8"));
    expect(m.display).toBe("standalone");
    expect(m.start_url).toBe("/");
    const sizes = m.icons.flatMap((i: { sizes: string }) => i.sizes.split(" "));
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
    expect(m.icons.some((i: { purpose?: string }) => i.purpose === "maskable")).toBe(true);
    for (const i of m.icons) expect(existsSync(`public/${i.src.replace(/^\//, "")}`), i.src).toBe(true);
  });
  it("gemini api is never cached", () => {
    const sw = readFileSync("app/sw.ts", "utf8");
    const gIdx = sw.indexOf("generativelanguage.googleapis.com");
    const dIdx = sw.indexOf("defaultCache");
    expect(gIdx).toBeGreaterThanOrEqual(0);
    expect(gIdx).toBeLessThan(dIdx);
    expect(sw).toContain("NetworkOnly");
  });
  it("offline fallback route exists", () => {
    expect(existsSync("app/offline/page.tsx")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/pwa.test.ts` (em `web/`)
Expected: FAIL (no manifest yet)

- [ ] **Step 3: Write minimal implementation** — files above; `npm i @serwist/next serwist`; layout metadata gets `manifest: "/manifest.webmanifest"` (full metadata in Task 6; only manifest key here); mount `<SwRegister />` inside provider.

- [ ] **Step 4: Run tests + build to verify**

Run: `npm test -- --run tests/pwa.test.ts tests/i18n.test.ts` (em `web/`), then `npm run build`
Expected: PASS + `out/sw.js` exists

- [ ] **Step 5: Commit**

```bash
git add web/app web/public web/tests web/next.config.ts web/package.json
git commit -m "feat: PWA serwist + manifest + offline"
```

### Task 6: SEO + assets do usuário + README + build final

**Files:**
- Modify: `web/app/layout.tsx` (full metadata + JSON-LD)
- Create: `web/app/sitemap.ts`, `web/app/robots.ts`
- Modify: `web/scripts/gen-icons.mjs` (also emit `public/opengraph-image.png` placeholder 1200×630)
- Modify: `web/README.md` (assets table for user-created favicon/banner)
- Test: extend `web/tests/pwa.test.ts` (SEO assertions)

**Interfaces:**
- Consumes: Tasks 1-5 (icons, manifest, offline route excluded from sitemap).
- Produces: green Lighthouse-ready static export.

```ts
// web/app/layout.tsx metadata (replace existing export):
export const metadata: Metadata = {
  title: { default: "Personalize My CV", template: "%s — Personalize My CV" },
  description: "Gerador de currículos sob medida com IA: cadastre o CV base, gere versões por vaga com match, email e mensagem. Seus dados ficam no browser.",
  keywords: ["currículo", "CV", "vagas", "emprego", "IA", "Gemini", "resume", "currículum"],
  authors: [{ name: "filipeleonelbatista", url: "https://linkedin.com/in/filipeleonelbatista" }],
  creator: "filipeleonelbatista",
  robots: { index: true, follow: true },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
  openGraph: {
    type: "website",
    locale: "pt_BR",
    alternateLocale: ["en_US", "es_ES"],
    siteName: "Personalize My CV",
    title: "Personalize My CV",
    description: "Currículos sob medida com IA, no seu browser.",
    images: [{ url: "/opengraph-image.png", width: 1200, height: 630, alt: "Personalize My CV" }],
  },
  twitter: { card: "summary_large_image", title: "Personalize My CV", description: "Currículos sob medida com IA, no seu browser.", images: ["/opengraph-image.png"] },
};
```

JSON-LD in layout body (verbatim):

```tsx
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{
    __html: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Personalize My CV",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      inLanguage: ["pt-BR", "en-US", "es-ES"],
      offers: { "@type": "Offer", price: "0" },
      description: "Gerador de currículos sob medida com IA. Seus dados ficam no browser.",
    }),
  }}
/>
```

```ts
// web/app/sitemap.ts
import type { MetadataRoute } from "next";
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: "/", lastModified: new Date(), changeFrequency: "weekly", priority: 1 }];
}
```

```ts
// web/app/robots.ts
import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/" }, sitemap: "/sitemap.xml" };
}
```

Note: with `output: export`, `sitemap.ts`/`robots.ts` emit static `sitemap.xml`/`robots.txt` — verify in `out/` at build. Canonical: omit `metadataBase`/canonical (deploy domain unknown — README notes to add it).

gen-icons addition (append og banner job using sharp SVG composite):

```js
await sharp({ create: { width: 1200, height: 630, channels: 4, background: { r: 9, g: 9, b: 11, alpha: 1 } } })
  .composite([{ input: await sharp("app/icon.svg").resize(256, 256).png().toBuffer(), left: 120, top: 187 }])
  .png().toFile("public/opengraph-image.png");
```

Text on the banner is intentionally skipped (needs a font file) — README tells the user to replace with the real designed banner.

README assets table (append under setup):

```md
## Assets visuais (para criar/substituir)

| Arquivo | Tamanho | Uso |
|---|---|---|
| `public/favicon.ico` | 48px | Fallback navegadores antigos (opcional; SVG já cobre modernos) |
| `public/opengraph-image.png` | 1200×630, <300KB | Banner de compartilhamento (placeholder gerado via `npm run icons`; substitua pelo banner desenhado) |
| `public/icon-192.png` / `icon-512.png` | 192 / 512 | PWA + favicon (gerados de `app/icon.svg` via `npm run icons`) |
| `public/maskable-512.png` | 512 com safe-zone | Ícone maskable Android |
| `public/apple-touch-icon.png` | 180 | iOS home screen |

Regenerar: `npm run icons` (usa sharp).
```

- [ ] **Step 1: Write the failing test** — append to `web/tests/pwa.test.ts`:

```ts
it("seo essentials present", () => {
  const layout = readFileSync("app/layout.tsx", "utf8");
  for (const needle of ["openGraph", "twitter", "robots", "manifest", "application/ld+json", "themeColor"]) {
    expect(layout, needle).toContain(needle);
  }
  expect(existsSync("app/sitemap.ts")).toBe(true);
  expect(existsSync("app/robots.ts")).toBe(true);
  expect(existsSync("public/opengraph-image.png")).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/pwa.test.ts` (em `web/`)
Expected: FAIL (no openGraph yet)

- [ ] **Step 3: Write minimal implementation** — files above.

- [ ] **Step 4: Run full suite + build to verify**

Run: `npm test -- --run` then `npm run build` (em `web/`)
Expected: PASS + `out/` contains `index.html`, `sw.js`, `manifest.webmanifest`, `sitemap.xml`, `robots.txt`, `opengraph-image.png`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: SEO + assets + build final polish"
```



