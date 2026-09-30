# Mobile Expo + README raiz + APK Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `mobile/` (Expo + NativeWind, same features as `web/`), root `README.md`, and an installable Android APK via EAS cloud.

**Architecture:** Expo Router file-based navigation; NativeWind v4 styling; self-contained `mobile/lib` (equivalent logic, zero imports from `web/`); AsyncStorage + expo-secure-store; PDF in via WebView+pdf.js, PDF out via expo-print HTML; i18n reuses the same JSON shape via `use-intl`.

**Tech Stack:** Expo SDK latest stable at build time (spec said 53 — superseded, see ruling), React Native, TypeScript strict, NativeWind v4 + Tailwind v3, expo-router, use-intl, Zod, Vitest, EAS CLI.

**Spec:** `web/docs/superpowers/specs/2026-09-30-mobile-expo-design.md`

**Plan ruling (supersedes spec §2/§4 versions):** use the latest stable Expo SDK at implementation time (`npx create-expo-app@latest` blank TS template) and matching NativeWind v4 line — not pinned to SDK 53. Cost if wrong: none; versions recorded in `mobile/package.json` at scaffold.

## Global Constraints

- `mobile/` totalmente autocontido: nenhum import de `web/`; duplicação consciente documentada no README raiz.
- TypeScript strict + `npx tsc --noEmit` limpo; TDD com teste failing primeiro; commit por tarefa.
- Chave Gemini em `expo-secure-store` (cofre do SO); nunca em AsyncStorage.
- Idioma do CV (`BaseLang`) independente do locale da UI, como no web.
- SW nunca faz cache de `generativelanguage.googleapis.com` — N/A mobile (sem SW); chamadas LLM sempre `fetch` direto com `NetworkOnly` efetivo (sem cache).
- EAS login é interativo e intransferível: a Task 6 para e pede o login/token antes do build.

## Review Focus

- PDF escaneado/sem texto no mobile deve dar erro legível, nunca travar a WebView — pinned in Task 4 (unscanned-PDF test + WebView timeout).
- `expo-secure-store` pode retornar null (sem biometria/dispositivo) — espera-se fallback guiado para re-onboarding, não crash — pinned in Task 1 (null-key test).
- Build EAS sem login deve parar com instrução clara, nunca vazar credencial em log — pinned in Task 6 (login-gate step).
- Chave de mensagem ausente num locale deve usar fallback pt-BR — pinned in Task 1 (keyset parity test, same as web).
- HTML do CV com resumo/experiência longos não pode estourar a página do PDF — pinned in Task 4 (overflow CSS rules + long-content test).

---

### Task 1: Scaffold + theme + i18n + store/segredo

**Files:**
- Create: `mobile/` via `npx create-expo-app@latest mobile --template blank-typescript` (run once; commit result), then add: `mobile/tailwind.config.js`, `mobile/metro.config.js` (withNativeWind), `mobile/babel.config.js`, `mobile/global.css`, `mobile/app/_layout.tsx`
- Create: `mobile/lib/theme.tsx`, `mobile/lib/i18n-config.ts`, `mobile/lib/i18n-locale.ts`, `mobile/lib/messages/pt-BR.json`, `mobile/lib/messages/en-US.json`, `mobile/lib/messages/es-ES.json` (same shape as web; Common/Locale/Errors/Help/Splash/Offline + screen namespaces grow in Tasks 2-3)
- Create: `mobile/lib/store.ts` (AsyncStorage `pmcv:*` + Zod; settings key via SecureStore), `mobile/lib/secure-key.ts`
- Create: `mobile/vitest.config.ts`, `mobile/tests/store.test.ts`, `mobile/tests/i18n-contract.test.ts`
- Modify: `mobile/package.json` (deps below), `mobile/tsconfig.json` (`resolveJsonModule: true`, strict)

**Interfaces:**
- Consumes: nothing (foundation).
- Produces: `UiLocale`, `LOCALES`, `DEFAULT_LOCALE`, `LOCALE_LABELS`; `getLocale(): UiLocale`, `tErr(locale,key,vars?)`; `<ThemeProvider useTheme()>` with `setColorScheme('light'|'dark'|'system')` semantics; `loadBase/saveBase/loadApps/saveApps/loadSettings/saveSettings/clearSettings/isOnboarded/setOnboarded/loadLocale/saveLocale/exportBackup/importBackup` (AsyncStorage-backed, same key names as web); `getApiKey/setApiKey/clearApiKey` (SecureStore `pmcv:gemini-key`); `I18nProvider/useUiLocale/useTranslations(ns)` via `use-intl`.

- [ ] **Step 1: Scaffold + install deps**

```bash
npx create-expo-app@latest mobile --template blank-typescript
cd mobile
npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar
npm i nativewind tailwindcss@^3 react-native-reanimated use-intl zod @react-native-async-storage/async-storage expo-secure-store
npx expo install --fix
```

NativeWind v4 wiring (stable line):

```js
// mobile/babel.config.js
module.exports = function (api) {
  api.cache(true);
  return { presets: ["babel-preset-expo", "nativewind/babel"] };
};
```

```js
// mobile/metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
const { withNativewind } = require("nativewind/metro");
const config = getDefaultConfig(__dirname);
module.exports = withNativewind(config, { input: "./global.css" });
```

```js
// mobile/tailwind.config.js
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
};
```

```css
/* mobile/global.css */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

```tsx
// mobile/app/_layout.tsx
import "../global.css";
import { Stack } from "expo-router";
import { ThemeProvider } from "../lib/theme";
import { I18nProvider } from "../lib/i18n-provider";
export default function RootLayout() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </I18nProvider>
    </ThemeProvider>
  );
}
```

- [ ] **Step 2: Write the failing tests**

```ts
// mobile/tests/store.test.ts (vitest, node env; mock AsyncStorage + SecureStore)
import { describe, expect, it, beforeEach, vi } from "vitest";
vi.mock("@react-native-async-storage/async-storage", () => {
  const mem = new Map<string, string>();
  return { default: { getItem: async (k: string) => mem.get(k) ?? null, setItem: async (k: string, v: string) => { mem.set(k, v); }, removeItem: async (k: string) => { mem.delete(k); }, __clear: () => mem.clear() } };
});
vi.mock("expo-secure-store", () => {
  const mem = new Map<string, string>();
  return { getItemAsync: async (k: string) => mem.get(k) ?? null, setItemAsync: async (k: string, v: string) => { mem.set(k, v); }, deleteItemAsync: async (k: string) => { mem.delete(k); } };
});
import { saveBase, loadBase } from "../lib/store";
import { setApiKey, getApiKey } from "../lib/secure-key";

describe("mobile store", () => {
  it("round-trips base", async () => {
    const base = { resume: { cabecalho: { nome: "Ana", titulo_profissional: "Dev", contatos: [{ tipo: "email", valor: "a@a.com", link: null }] }, secoes: { resumo: "X", experiencia: [], formacao: [], habilidades: [], certificacoes: [], idiomas: [], projetos: [] } }, lang: "pt-BR" as const, updatedAt: new Date().toISOString() };
    await saveBase(base);
    expect((await loadBase())?.resume.cabecalho.nome).toBe("Ana");
  });
  it("api key lives in SecureStore, never returns null silently", async () => {
    expect(await getApiKey()).toBeNull();
    await setApiKey("K");
    expect(await getApiKey()).toBe("K");
  });
});
```

```ts
// mobile/tests/i18n-contract.test.ts
import { describe, expect, it } from "vitest";
import ptBR from "../lib/messages/pt-BR.json";
import enUS from "../lib/messages/en-US.json";
import esES from "../lib/messages/es-ES.json";
function keys(o: unknown, p = ""): string[] {
  if (typeof o !== "object" || o === null) return [p];
  return Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => (typeof v === "object" && v !== null ? keys(v, p ? `${p}.${k}` : k) : [p ? `${p}.${k}` : k]));
}
describe("mobile i18n", () => {
  it("3 locales share the same keyset", () => {
    expect(keys(enUS).sort()).toEqual(keys(ptBR).sort());
    expect(keys(esES).sort()).toEqual(keys(ptBR).sort());
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- --run tests/store.test.ts` (em `mobile/`)
Expected: FAIL with "Cannot find module '../lib/store'"

- [ ] **Step 4: Write minimal implementation**

```ts
// mobile/lib/store.ts — AsyncStorage-backed mirror of the web store contract:
// same pmcv:* keys, same Zod schemas (reimplemented, not imported), all
// functions async: loadBase/saveBase/loadApps/saveApps/loadSettings
// (settings WITHOUT key)/saveSettings/clearSettings/isOnboarded/
// setOnboarded/loadLocale/saveLocale/exportBackup/importBackup,
// QUOTA_MESSAGE per locale via tErr. Settings type: { models: string[] }.
```

```ts
// mobile/lib/secure-key.ts
import * as SecureStore from "expo-secure-store";
const KEY = "pmcv:gemini-key";
export async function getApiKey(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(KEY);
  } catch {
    return null;
  }
}
export async function setApiKey(key: string): Promise<void> {
  await SecureStore.setItemAsync(KEY, key);
}
export async function clearApiKey(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch { /* already gone */ }
}
```

```tsx
// mobile/lib/theme.tsx — ThemeContext { scheme: "light"|"dark"|"system", resolved: "light"|"dark", setScheme }
// resolved via useColorScheme() from "nativewind" + override state; wraps children in View className="flex-1 bg-white dark:bg-black".
```

```tsx
// mobile/lib/i18n-provider.tsx — mirrors web provider: loads pmcv:locale,
// IntlProvider (from "use-intl") with static message imports, locale context
// with setLocale persisting to AsyncStorage. NOTE: use-intl's IntlProvider
// (not next-intl's NextIntlClientProvider) — same message format.
```

Messages Task 1 scope: copy web's Common/Locale/Errors/Help/Splash/Offline namespaces verbatim in structure (values identical — same product copy).

`mobile/vitest.config.ts`: `defineConfig({ resolve: { alias: { "@": path.resolve(__dirname, ".") } }, test: { include: ["tests/**/*.test.ts"], environment: "node" } })` + `"test": "vitest run"` script.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- --run` (em `mobile/`)
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add mobile
git commit -m "feat(mobile): scaffold expo + theme + i18n + store"
```

### Task 2: Pure-logic port (schemas, tailor, LLM, report, labels)

**Files:**
- Create: `mobile/lib/resume-schema.ts`, `mobile/lib/tailor.ts` (normalize fns), `mobile/lib/tailor-client.ts`, `mobile/lib/report.ts`, `mobile/lib/filename.ts`, `mobile/lib/json-text.ts`, `mobile/lib/cv-labels.ts`
- Create: `mobile/lib/llm/prompts.ts`, `mobile/lib/llm/gemini.ts`, `mobile/lib/llm/chain.ts`
- Create: `mobile/tests/resume-schema.test.ts`, `mobile/tests/tailor.test.ts`, `mobile/tests/llm-chain.test.ts`, `mobile/tests/report.test.ts`, `mobile/tests/filename.test.ts`

**Interfaces:**
- Consumes: Task 1 store (`loadBase/saveBase/loadApps/loadSettings`), `getApiKey`, `getLocale/tErr`.
- Produces: `parseResume/normalizeResume/normalizeEnvelope`, `runTailorJob(jobText, lang, locale?)/retryStoredApp(id, locale?)` (same semantics as web, AsyncStorage persistence, `newId()` with `expo-crypto` fallback chain: `Crypto.getRandomUUID()` → `getRandomBytes` UUIDv4 → counter), `generateJson(system,user,key,models?,locale?)/validateGeminiKey(key,locale?)`, `weekRange/bucketByWeekday/weekLabel`, `buildFileName/buildFailedFileName`, `cvSectionTitles(lang): { resumo, experiencia, formacao, habilidades, certificacoes, idiomas, projetos }` per CV lang (same values as web PDF i18n).

- [ ] **Step 1: Write the failing tests** — port the web equivalents:
  - `tailor.test.ts`: `runTailorJob("curto", "pt-BR")` rejects `/20 caracteres/`; `normalizeResume` minimal-valid parse.
  - `llm-chain.test.ts`: mocked global fetch — first-model success provider string; 3-model fallback; empty candidates reject; `validateGeminiKey("", "en-US")` → `/Paste a key/`.

```ts
it("rejects short job text in UI locale", async () => {
  await expect(runTailorJob("curto", "pt-BR", "en-US")).rejects.toThrow(/20 characters/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run tests/tailor.test.ts` (em `mobile/`)
Expected: FAIL with "Cannot find module '../lib/tailor-client'"

- [ ] **Step 3: Write minimal implementation** — equivalent logic to web (same Zod shapes, same normalize maps, same chain fallback/60s AbortController, same report math). RN adaptations only:
  - `fetch` is global in RN — no change.
  - No `Buffer`/`node:fs` — none of these files use them (web versions don't either).
  - Key sourcing: `runTailorJob`/`retryStoredApp` read the key via `await getApiKey()` (Task 1 SecureStore) and throw `tErr(locale, "noKey")` when null — never from AsyncStorage settings.
  - `newId()`: `import * as Crypto from "expo-crypto"` → `Crypto.getRandomUUID?.()` else manual UUIDv4 from `Crypto.getRandomBytes(new Uint8Array(16))` else counter fallback. Install: `npx expo install expo-crypto`.
  - `cvSectionTitles`: pt-BR `{ resumo: "Resumo", experiencia: "Experiência", formacao: "Formação", habilidades: "Habilidades", certificacoes: "Certificações", idiomas: "Idiomas", projetos: "Projetos" }`; en `{ resumo: "Summary", experiencia: "Experience", formacao: "Education", habilidades: "Skills", certificacoes: "Certifications", idiomas: "Languages", projetos: "Projects" }`; es `{ resumo: "Resumen", experiencia: "Experiencia", formacion: "Formación", habilidades: "Habilidades", certificaciones: "Certificaciones", idiomas: "Idiomas", proyectos: "Proyectos" }` (key `formacao` kept for shape parity).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run` (em `mobile/`)
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mobile/lib mobile/tests
git commit -m "feat(mobile): pure logic port + unit tests"
```

### Task 3: Screens (splash/gate, onboarding, dashboard, settings, help)

**Files:**
- Create: `mobile/app/index.tsx` (gate+splash), `mobile/app/onboarding.tsx`, `mobile/app/(tabs)/_layout.tsx`, `mobile/app/(tabs)/curriculos.tsx`, `mobile/app/(tabs)/relatorios.tsx`, `mobile/app/settings.tsx`
- Create: `mobile/components/SplashScreen.tsx`, `mobile/components/OnboardingWizard.tsx`, `mobile/components/Header.tsx` (title + `[LocaleSelector][HelpDialog][ThemeToggle]`), `mobile/components/LocaleSelector.tsx`, `mobile/components/HelpDialog.tsx` (modal), `mobile/components/ThemeToggle.tsx`, `mobile/components/VacancyCard.tsx`, `mobile/components/GenerateSheet.tsx` (modal), `mobile/components/DetailSheet.tsx` (modal), `mobile/components/ReportsView.tsx`, `mobile/components/SettingsSheet.tsx`, `mobile/components/EmptyState.tsx`
- Create: `mobile/lib/messages/*` screen namespaces (Page, Onboarding, Base, Dashboard, Generate, Vacancy, Detail, Reports, Settings, Theme, Dropzone→Picker) — same keys as web where flows match, verified by the parity test
- Test: `mobile/tests/screens-contract.test.ts`

**Interfaces:**
- Consumes: Tasks 1-2 (store, lib, i18n, theme).
- Produces: navigable app (Expo Go testable); Header cluster pattern; modal sheets.

Screen specs (wiring that must hold; styling via NativeWind `className`, `dark:` variants):

```tsx
// mobile/app/index.tsx — gate: loads store+key, min 400ms splash, then
// router.replace("/onboarding") or router.replace("/(tabs)/curriculos")
import { useEffect, useState } from "react";
import { router } from "expo-router";
import { isOnboarded } from "../lib/store";
import { SplashScreen } from "../components/SplashScreen";
export default function Index() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await new Promise((r) => setTimeout(r, 400));
      if (!cancelled) {
        router.replace((await isOnboarded()) ? "/(tabs)/curriculos" : "/onboarding");
        setReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);
  return <SplashScreen />;
}
```

- `OnboardingWizard`: 3 steps mirroring web (welcome → key with `Linking.openURL("https://aistudio.google.com/apikey")` + validate → PDF pick + CV-lang + create). Uses `validateGeminiKey`, `setApiKey`, `extractCvText` (Task 4 provides; until then step 3 disabled with note — NO: Task 4 is separate; OnboardingWizard step 3 calls `../lib/pdf-extract` which Task 4 creates. To keep tasks independent: Task 3's wizard calls a `createBaseFromFile(file: PdfFile): Promise<void>` function defined in Task 4's module; Task 3 test asserts the import exists. If Task 4 changes the signature, Task 4 updates callers — ledger the coupling here: Task 3 → Task 4 interface `createBaseFromFile(file: { uri: string; name: string }, lang: BaseLang, locale?: UiLocale): Promise<void>`.)
- `GenerateSheet`: modal with job textarea + CV-lang select + offline guard (`Network.getNetworkStateAsync()`; `npx expo install expo-network`) + staged status text + `runTailorJob`.
- `VacancyCard` list with `FlatList`, pull-to-refresh from store; detail modal with download (Task 4 `shareResumePdf(app)`) / retry / delete / copy-to-clipboard (`expo-clipboard`).
- `ReportsView`: week pager + 3 stat cards + custom bar chart (7 Views with heights from counts, max-normalized).
- `SettingsSheet`: key field + models multi-select + clear + backup export/import via `expo-file-system` + `expo-sharing` (Task 4 provides `exportBackupToFile()/importBackupFromFile()`; same coupling note as above).
- `Header`: app title + base line + cluster; rendered on every screen (tabs layout header + onboarding header).

Offline guard pattern (all AI entries):

```ts
import * as Network from "expo-network";
const net = await Network.getNetworkStateAsync();
if (!net.isConnected) { toast(tErr(locale, "offline")); return; }
```

- [ ] **Step 1: Write the failing test**

```ts
// mobile/tests/screens-contract.test.ts
import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
const APP = "app", CMP = "components";
describe("screens contract", () => {
  it("routes and screens exist", () => {
    for (const f of ["app/index.tsx", "app/onboarding.tsx", "app/(tabs)/_layout.tsx", "app/(tabs)/curriculos.tsx", "app/(tabs)/relatorios.tsx", "app/settings.tsx"]) {
      expect(existsSync(f), f).toBe(true);
    }
  });
  it("header cluster on every screen", () => {
    for (const f of ["app/onboarding.tsx", "app/(tabs)/curriculos.tsx", "app/(tabs)/relatorios.tsx", "app/settings.tsx"]) {
      const s = readFileSync(f, "utf8");
      expect(s, f).toMatch(/LocaleSelector/);
      expect(s, f).toMatch(/HelpDialog/);
      expect(s, f).toMatch(/ThemeToggle/);
    }
  });
  it("no hardcoded UI strings outside messages", () => {
    for (const f of ["components/GenerateSheet.tsx", "components/VacancyCard.tsx", "components/DetailSheet.tsx", "components/ReportsView.tsx", "components/SettingsSheet.tsx"]) {
      const s = readFileSync(f, "utf8");
      expect(s, f).not.toMatch(/Currículos|Relatórios|Personalizar com IA|Baixar|Excluir|Configurações/);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/screens-contract.test.ts` (em `mobile/`)
Expected: FAIL (routes don't exist)

- [ ] **Step 3: Write minimal implementation** — screens per specs above; all copy via `useTranslations(ns)`; toasts via `toast()` helper in `mobile/lib/toast.ts` (thin wrapper over the chosen toast lib — create it here: `export function toast(msg: string)` + `toastError(msg)`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run` (em `mobile/`)
Expected: PASS (keyset parity covers the new namespaces)

- [ ] **Step 5: Commit**

```bash
git add mobile
git commit -m "feat(mobile): screens + navigation + header"
```

### Task 4: PDF pipeline (pick → extract → print/share → backup files)

**Files:**
- Create: `mobile/lib/pdf-extract.ts` (+ `mobile/assets/pdfjs/pdf.min.mjs`, `mobile/assets/pdfjs/pdf.worker.min.mjs` vendored from `pdfjs-dist` npm package, `mobile/assets/pdfjs/extract.html` harness)
- Create: `mobile/lib/cv-html.ts`, `mobile/lib/pdf-share.ts`, `mobile/lib/backup-files.ts`
- Create: `mobile/tests/pdf-pipeline.test.ts`
- Modify: `mobile/package.json` (`expo-document-picker`, `expo-print`, `expo-sharing`, `expo-file-system`, `expo-clipboard`, `expo-crypto`, `expo-network`, `react-native-webview` via `npx expo install`)

**Interfaces:**
- Consumes: Tasks 1-3 (`StoredApp`, `cvSectionTitles`, `tErr`, store save/load).
- Produces (fulfills Task 3 coupling): `createBaseFromFile(file: { uri: string; name: string }, lang: BaseLang, locale?: UiLocale): Promise<void>`; `shareResumePdf(app: StoredApp, locale?: UiLocale): Promise<void>`; `exportBackupToFile()/importBackupFromFile(uri: string)`.

- [ ] **Step 1: Write the failing tests**

```ts
// mobile/tests/pdf-pipeline.test.ts
import { describe, expect, it } from "vitest";
import { cvHtml } from "../lib/cv-html";
import { readFileSync, existsSync } from "node:fs";
const resume: any = { cabecalho: { nome: "Ana", titulo_profissional: "Dev", contatos: [{ tipo: "email", valor: "a@a.com", link: null }] }, secoes: { resumo: "X", experiencia: [{ cargo: "Dev", empresa: "Acme", local: null, periodo: { inicio: "2023-01", fim: null, atual: true }, descricao: "d", realizacoes: ["r1"], tecnologias: ["TS"] }], formacao: [], habilidades: [], certificacoes: [], idiomas: [], projetos: [] } };
describe("pdf pipeline", () => {
  it("cv html mirrors CV sections with localized titles", () => {
    const html = cvHtml(resume, "pt-BR");
    expect(html).toContain("Ana");
    expect(html).toContain("Experiência");
    expect(cvHtml(resume, "en")).toContain("Experience");
  });
  it("long content cannot overflow the page", () => {
    const big = { ...resume, secoes: { ...resume.secoes, resumo: "x".repeat(5000) } };
    const html = cvHtml(big, "pt-BR");
    expect(html).toMatch(/overflow-wrap: ?break-word|word-break: ?break-word/);
    expect(html).toMatch(/@page/);
  });
  it("pdf.js harness vendored", () => {
    for (const f of ["assets/pdfjs/pdf.min.mjs", "assets/pdfjs/pdf.worker.min.mjs", "assets/pdfjs/extract.html"]) {
      expect(existsSync(f), f).toBe(true);
    }
  });
  it("pipeline modules expose Task 3 contract", async () => {
    const ex = await import("../lib/pdf-extract");
    const sh = await import("../lib/pdf-share");
    const bk = await import("../lib/backup-files");
    expect(typeof ex.createBaseFromFile).toBe("function");
    expect(typeof sh.shareResumePdf).toBe("function");
    expect(typeof bk.exportBackupToFile).toBe("function");
    expect(typeof bk.importBackupFromFile).toBe("function");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run tests/pdf-pipeline.test.ts` (em `mobile/`)
Expected: FAIL with "Cannot find module '../lib/cv-html'"

- [ ] **Step 3: Write minimal implementation**

```ts
// mobile/lib/cv-html.ts — full HTML doc, inline CSS, A4 @page, break-word
// rules; sections in CV order with cvSectionTitles(lang); contacts line;
// experience blocks with period "YYYY-MM – present/YYYY-MM". Escape all
// interpolated strings (escapeHtml helper in-file).
export function cvHtml(resume: Resume, lang: BaseLang): string { /* ... */ }
```

```ts
// mobile/lib/pdf-extract.ts
import * as DocumentPicker from "expo-document-picker";
import { extractCvTextFromWebView } from "./webview-extract"; // WebView harness below
export type PdfFile = { uri: string; name: string };
export async function pickPdf(): Promise<PdfFile | null> {
  const r = await DocumentPicker.getDocumentAsync({ type: "application/pdf", copyToCacheDirectory: true });
  if (r.canceled || !r.assets?.[0]) return null;
  return { uri: r.assets[0].uri, name: r.assets[0].name ?? "cv.pdf" };
}
export async function createBaseFromFile(file: PdfFile, lang: BaseLang, locale: UiLocale = getLocale()): Promise<void> {
  const text = await extractCvTextFromWebView(file.uri, locale); // 60s timeout, unscanned-PDF error
  const settings = loadSettings();
  const key = await getApiKey();
  if (!key) throw new Error(tErr(locale, "noKey"));
  const system = buildBaseExtractSystem(lang);
  const { data } = await generateJson(system, text.slice(0, 12000), key, settings.models, locale);
  let resume;
  try { resume = normalizeResume(data); }
  catch (zerr) {
    const { data: fixed } = await generateJson(system, buildRepairUser(JSON.stringify(data), String(zerr)), key, settings.models, locale);
    resume = normalizeResume(fixed);
  }
  await saveBase({ resume, lang, updatedAt: new Date().toISOString() });
  await setOnboarded(true);
}
```

WebView harness (`mobile/lib/webview-extract.ts` + `assets/pdfjs/extract.html`): hidden `<WebView source={{ uri: Asset.fromModule(require("../assets/pdfjs/extract.html")).localUri }}` with `allowFileAccess`, `injectedJavaScriptBeforeContentLoaded` setting `window.__PDF_URI__`; extract.html loads vendored `pdf.min.mjs`, fetches the file uri, extracts all pages' text, `postMessage(JSON.stringify({ ok, text }))`; RN side resolves/rejects with 60s timeout; empty text → `tErr(locale, "unscannedPdf")`. Vendor step: `cp node_modules/pdfjs-dist/build/pdf.min.mjs mobile/assets/pdfjs/` (+ worker). Highest-risk unit — acceptance: extract text from a real sample PDF in Expo Go before Task 6.

```ts
// mobile/lib/pdf-share.ts
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";
export async function shareResumePdf(app: StoredApp, locale: UiLocale = getLocale()): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html: cvHtml(app.resume, app.lang) });
  const dest = `${FileSystem.documentDirectory}${app.fileName}`;
  await FileSystem.copyAsync({ from: uri, to: dest });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(dest);
  else throw new Error(tErr(locale, "shareUnavailable")); // add Errors.shareUnavailable ×3 locales
}
```

```ts
// mobile/lib/backup-files.ts — exportBackupToFile(): writes exportBackup()
// JSON to documentDirectory pmcv-backup-<date>.json + shareAsync; 
// importBackupFromFile(uri): FileSystem.readAsStringAsync + importBackup.
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run` (em `mobile/`)
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mobile
git commit -m "feat(mobile): pdf pipeline print share backup"
```

### Task 5: README raiz + app config + assets + verificação total

**Files:**
- Create: `README.md` (repo root)
- Create: `mobile/app.json`, `mobile/eas.json`
- Create: `mobile/assets/icon.png`, `mobile/assets/adaptive-icon.png`, `mobile/assets/splash.png` (from `web/app/icon.svg` via sharp, same generator pattern)
- Test: `mobile/tests/app-config.test.ts`

**Interfaces:**
- Consumes: Tasks 1-4 (everything to verify).
- Produces: configured project ready for `eas build`; root README.

```json
// mobile/app.json (Expo SDK latest; router plugin required)
{
  "expo": {
    "name": "Personalize My CV",
    "slug": "personalize-my-cv",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "automatic",
    "splash": { "image": "./assets/splash.png", "resizeMode": "contain", "backgroundColor": "#09090b" },
    "assetBundlePatterns": ["**/*"],
    "ios": { "supportsTablet": true },
    "android": { "package": "com.pmcv.app", "versionCode": 1, "adaptiveIcon": { "foregroundImage": "./assets/adaptive-icon.png", "backgroundColor": "#09090b" } },
    "plugins": ["expo-router", "expo-secure-store"]
  }
}
```

```json
// mobile/eas.json
{
  "cli": { "version": ">= 16.0.0" },
  "build": {
    "preview": { "distribution": "internal", "android": { "buildType": "apk" } },
    "production": { "android": { "buildType": "app-bundle" } }
  },
  "submit": { "production": {} }
}
```

Root `README.md` sections: visão (`web/` + `mobile/`), separação total (sem imports cruzados), pré-requisitos (Node 20+, Expo CLI via npx, conta Expo p/ APK), `web/` setup/dev/test/build (4 linhas), `mobile/` setup/dev (`npx expo start`, Expo Go)/test/build, APK passo a passo (login → build → download), tabela de assets (icon/adaptive/splash + quem gera), paridade web×mobile (tabela de funcionalidades), avisos (BYOK, secure-store vs secure-ls, preview APK ≠ loja).

- [ ] **Step 1: Write the failing test**

```ts
// mobile/tests/app-config.test.ts
import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
describe("app config", () => {
  it("android package, version and icons configured", () => {
    const app = JSON.parse(readFileSync("app.json", "utf8")).expo;
    expect(app.android.package).toBe("com.pmcv.app");
    expect(app.version).toBe("1.0.0");
    for (const f of ["assets/icon.png", "assets/adaptive-icon.png", "assets/splash.png"]) {
      expect(existsSync(f), f).toBe(true);
    }
  });
  it("eas preview builds apk", () => {
    const eas = JSON.parse(readFileSync("eas.json", "utf8"));
    expect(eas.build.preview.android.buildType).toBe("apk");
  });
  it("root README documents both projects and the APK flow", () => {
    const r = readFileSync("../README.md", "utf8");
    for (const needle of ["web/", "mobile/", "eas build", "eas login", "APK"]) {
      expect(r, needle).toContain(needle);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/app-config.test.ts` (em `mobile/`)
Expected: FAIL (no app.json yet)

- [ ] **Step 3: Write minimal implementation** — files above; generate PNGs from `../web/app/icon.svg` with sharp (`npm i -D sharp` in mobile, one-off script `mobile/scripts/gen-assets.mjs`: icon 1024, adaptive 1024 with padding on dark bg, splash 1284×2778 centered icon on dark bg); run once, commit PNGs.

- [ ] **Step 4: Run full verification**

Run: `npm test -- --run` then `npx tsc --noEmit` then `npx expo export --platform android` smoke (optional; if the exporter needs network/config beyond scope, `tsc` + tests suffice — record outcome) (em `mobile/`)
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add README.md mobile
git commit -m "docs: readme raiz + mobile config assets apk"
```

### Task 6: APK via EAS cloud (login gate + build)

**Files:** none (EAS dashboard artifact + `mobile/README-apk.md` build log note if needed).

**Interfaces:**
- Consumes: Task 5 (configured, verified project).
- Produces: installable APK link.

- [ ] **Step 1: Login gate — STOP, do not proceed without credentials**

Run: `npx eas-cli whoami` (em `mobile/`). If it prints a username → logged in, continue. If it errors → **STOP and ask the human partner**: either (a) they run `npx eas login` in their own terminal and tell you when done, or (b) they set an `EXPO_TOKEN` env var themselves (never paste the token in chat, never echo it in logs) and tell you to proceed with the env passthrough. Never invent, store, or print credentials.

- [ ] **Step 2: First build (preview APK)**

Run: `npx eas-cli build --platform android --profile preview --non-interactive --wait` (em `mobile/`)
Expected: build succeeds; output contains the artifact download URL + EAS dashboard link. First run may create the EAS project (auto with `--non-interactive`); if it fails on project linkage, report BLOCKED with the log tail.

- [ ] **Step 3: Record artifact**

Append to the ledger: APK URL, build ID, version. Report to the human partner: install link + `scan the QR in Expo dashboard` note + reminder that preview APK ≠ store release.

- [ ] **Step 4: Commit (only if files changed, e.g. projectId in app.json)**

```bash
git add mobile/app.json 2>/dev/null; git commit -m "chore(mobile): link eas project" 2>/dev/null || true
```


