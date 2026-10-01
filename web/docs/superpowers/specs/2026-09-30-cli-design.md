# CLI `personalize-cv` — Design Spec (2026-09-30)

## 1. Outcome & success criteria

Terminal command `personalize-cv` (Powershell / CMD / Bash, Win + Linux) with
feature parity to `web/` core flow:

- Onboarding: prompt Gemini API key (validate) + base PDF path → extract →
  catalog to JSON base.
- Generate: re-run `personalize-cv` → paste job text → tailored resume +
  terminal analysis (match%, strengths, weaknesses, email, chat) + PDF file.
- History: `--list` table + select item → view analysis / download PDF /
  retry / delete. `--show <id>` direct view.
- `--report [--week N]` weekly progress report like web `ReportsSection`.
- `--help` trilingual command list.
- UI locale pt-BR / en-US / es-ES, same shape as `web/messages/*.json`;
  CV content language (`--cv-lang pt-BR|en|es`) independent from UI locale.

Success: `cd cli && npm i && npm link` → `personalize-cv`, `--list`,
`--report`, `--help` work offline-capable (AI needs net) on Win + Linux;
`vitest` + `tsc --noEmit` green.

## 2. Non-goals

- No GUI / TUI dashboard, no charts lib (ASCII bars only).
- No theme (light/dark is web/mobile only).
- No PWA / SEO / service worker.
- No backup import/export in v1 (future: `--export/--import` reusing
  `exportBackup` shape `{base, apps, exportedAt}`).
- No server, no DB, no shared imports with `web/` or `mobile/`
  (total separation per `PROJECT.md` — reimplement ~10 small pure files).

## 3. Architecture

```
cli/
  package.json          # name personalize-my-cv-cli, bin { personalize-cv: dist/index.js }
  tsconfig.json
  messages/pt-BR.json, en-US.json, es-ES.json
  src/index.ts          # commander (or manual parse) + dispatch
  src/commands/onboard.ts | generate.ts | list.ts | show.ts | report.ts
  src/lib/
    config.ts           # HOME_DIR ~/.personalize-cv, paths, chmod
    store.ts            # config.json/base.json/apps.json, Zod, discard-invalid
    i18n.ts             # UiLocale, t(locale,key,vars), locale resolve+paridade
    gemini.ts           # chatJsonGemini (60s timeout, 3-model fallback)
    chain.ts            # generateJson + validateGeminiKey
    prompts.ts          # buildBaseExtractSystem / buildTailorSystem/User/Repair
    tailor.ts           # normalizeResume/Envelope + contato/habilidade/periodo
    schemas.ts          # ResumeSchema + TailorEnvelopeSchema (copy of web contracts)
    filename.ts         # sanitizePart/buildFileName/buildFailedFileName
    pdf-extract.ts      # pdfjs-dist/legacy getDocument from file bytes
    pdf.ts              # @react-pdf/renderer CVDocument reimpl → toFile()
    report.ts           # weekRange/bucketByWeekday/weekLabel (copy of web)
  tests/*.test.ts
```

Runtime: Node 20+, TS, ESM. Deps: `commander`, `@inquirer/prompts`,
`zod`, `react`, `@react-pdf/renderer`, `pdfjs-dist`.
PDF text slice `text.slice(0,12000)` like web onboarding (token guard).

## 4. Commands / UX

| Invocation | Behaviour |
|---|---|
| `personalize-cv` | Interactive. No key → prompt key (password) → `validateGeminiKey`. No base → prompt PDF path → extract → prompt `--cv-lang` → `generateJson` → `normalizeResume` → save `base.json`. Else prompt job text (multiline paste, min 20 chars; `$EDITOR` fallback) → spinner stages (lendo vaga / reescrevendo / gerando PDF) → print analysis → save `apps.json` entry + PDF to cwd. |
| `personalize-cv --list` | ASCII table: `# cargo │ empresa │ match │ data │ status`. Numeric select → submenu: `[v]er análise [b]aixar PDF [r]etry [d]eletar [q]uit`. Download copies stored PDF (regenerate via `pdf.ts` from stored resume) to `--out <path>` or cwd. |
| `personalize-cv --show <id>` | Print analysis + `fileName`. `--out` copies PDF. |
| `personalize-cv --report [--week -1]` | `weekRange(now, offset)` + `bucketByWeekday`: total, avg/day, best day, ASCII bars `Seg..Dom` labels per locale. `offset<=0` only. |
| `personalize-cv --help` | Localized command list (locale from `--locale` / config / `LANG` / fallback pt-BR). |
| Global flags | `--locale pt-BR\|en-US\|es-ES`, `--cv-lang pt-BR\|en\|es`, `--out <path>`, `--json` (machine output for show/list/report, future-proof). |

Exit codes: `0` ok, `1` validation/AI fail (failed app still saved + `errorLog`), `2` usage error.

## 5. Data flow

- `config.json`: `{ geminiKey, models: string[], locale: UiLocale }` chmod 600.
- `base.json`: `{ resume: Resume, lang: BaseLang, updatedAt: ISO }`.
- `apps.json`: `StoredApp[]` = envelope + `{id, jobText, fileName, status done|failed, errorLog, lang, createdAt}`.
- Generate flow: `loadBase` → `buildTailorSystem/User` → `generateJson` (fallback chain) → `normalizeEnvelope` → repair retry on Zod fail → `buildFileName` → `pdf.ts toFile()` → `saveApps([app,...])`. Catch → `failedApp` placeholder (`strengths ["—"]`, match 0) + localized `tailFail`.
- Retry: `retryStoredApp(id)` regenerates new id, replaces old entry.
- Locale resolve: `--locale` > `config.locale` > `LANG`/`LC_ALL` parse (`pt_BR`→`pt-BR`, `en*`→`en-US`, `es*`→`es-ES`) > `pt-BR`.

## 6. i18n

- `cli/messages/*.json` mirrors web key namespaces: `Common, Errors, Onboarding, Generate, Vacancy, Reports, Help, Cli` (new: prompt labels, table headers, ascii report strings). Keyset parity test across 3 files (like web contract test).
- Lib errors via `t(locale, key, vars)` static tables, never hardcoded PT strings (contract test greps `src/` for hardcoded PT outside messages).
- PDF labels via copied `pdf/i18n.ts` (`pdfLabels`, `MISSING_JOB`, `MONTHS`).

## 7. Error handling

Localized: `noKey, invalidKey(401/403), emptyResponse, pasteKey, noBase, jobShort, notFound, invalidPdf, emptyPdf, unscannedPdf, quota(ENOSPC→export+clean hint), offline(fetch fail), tailFail, retryFailDetail, validateFailed`. Offline pre-check: `fetch` to models endpoint with short timeout → warn, still allow `--list/--show/--report` (local-only commands never need net).

## 8. Testing

Vitest (node env): `tailor.normalize*`, `filename.buildFileName`, `report.weekRange/bucketByWeekday`, `i18n` parity (3 locales same keys), `store` round-trip with temp `HOME` override + invalid-item discard, `prompts` contains `responseMimeType`-independent system strings. `npx tsc --noEmit` clean. No network in tests (mock `fetch`).

## 9. Rollout

1. Scaffold `cli/` + implement lib (schemas→store→i18n→gemini/chain/prompts→tailor→pdf).
2. Commands + `--help` trilingual.
3. Tests + README (`npm link` usage for PS/CMD/Bash).
4. Manual verify Win (PS) + Linux (bash): onboard → generate → list/show/report.
