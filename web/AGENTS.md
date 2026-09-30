This is a 100% static Next.js web application (`output: "export"` in `next.config.ts`). There is no server: no Server Actions, no Route Handlers used for data, no middleware, no database — persistence is `localStorage` in the browser.

## Commands (run inside `web/`)

```bash
npm i
npm run dev        # http://localhost:3000
npm test -- --run  # vitest suite
npx tsc --noEmit
npm run build      # generates web/out/
```

## Architecture

- App Router with a single client-driven page (`app/page.tsx`): boot gate (splash → onboarding wizard → dashboard tabs). `app/loading.tsx` skeletons are kept for route transitions.
- `lib/store.ts` is the source of truth (`pmcv:*` keys, Zod-validated, invalid items discarded). Gemini key is per-user (BYOK), obfuscated with `secure-ls` — explicitly NOT a vault (see web `README.md` security notice).
- LLM calls go straight from the browser to `generativelanguage.googleapis.com` (`lib/llm/`, 60s timeout, 3-model fallback). CV content language (`BaseLang`) is independent from UI locale.
- PDFs are generated on demand in the browser (`@react-pdf/renderer` → blob URL) and never persisted. PDF text extraction uses `pdfjs-dist` with a vendored local worker (`public/pdf.worker.min.mjs`, no CDN).
- Reports are computed client-side from `pmcv:apps` (`lib/report.ts` + `weekRange`/`bucketByWeekday`).

## i18n

- `next-intl` provider-only (no routing/middleware — middleware would break the static export). Messages in `messages/{pt-BR,en-US,es-ES}.json`; locale in React state + `pmcv:locale` with `pt-BR` fallback; `<html lang>` set dynamically.
- UI locale translates ONLY the interface. CV generation language stays per-generation via its own selector (`lib/pdf/i18n.ts` untouched).
- Lib code (no React) uses `tErr(locale, key)` static tables (`lib/i18n/`), never the provider hook. New UI strings require keys in all 3 locales — the keyset parity test fails otherwise.

## PWA & SEO

- PWA via `@serwist/next` (`app/sw.ts`): Gemini API is explicitly `NetworkOnly` and must stay before `...defaultCache`; navigation falls back to `/offline`. Generated `public/sw.js` is gitignored (rebuilt every build).
- SEO: full `metadata` in `app/layout.tsx`, `sitemap.ts`/`robots.ts` (both need `export const dynamic = "force-static"` under `output: export`), JSON-LD block. No `metadataBase`/canonical until the deploy domain exists.

## Tests

- Vitest (`tests/*.test.ts`): lib unit tests with mocked `fetch`, plus contract tests that read source files (routes exist, header cluster `[LocaleSelector][HelpDialog][ThemeToggle]`, no hardcoded PT UI strings outside `messages/`).
- `tests/setup.ts` polyfills `localStorage` from jsdom — test files that touch storage need the `// @vitest-environment jsdom` pragma.
- Keep the suite green and `tsc` clean; both are required before any build.

## Rules

- Never reintroduce server persistence (Prisma/SQLite) or secrets in client-accessible code — static deploy is a core constraint (see root `PROJECT.md`).
- Never share code with `mobile/` — this project is self-contained by decision. Equivalent logic may be reimplemented, never imported.
- New user-visible strings go in all 3 message files; lib errors go through `tErr` with an optional locale param defaulting to `getLocale()`.
