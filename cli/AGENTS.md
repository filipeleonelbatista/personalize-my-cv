Comando `personalize-cv` (Node 20+ TS, commander, `@react-pdf/renderer`, `pdfjs-dist`, i18n pt-BR/en-US/es-ES).

## Commands (run inside `cli/`)

```bash
npm i
npm run build
npm link           # expõe `personalize-cv`
npm test -- --run  # vitest
npx tsc --noEmit
```

## Architecture

- `src/index.ts`: commander (`--list`, `--show`, `--report`, `--version`, `--locale`, `--cv-lang`, `--out`, `--json`); interativo via `@inquirer/prompts`.
- `src/lib/`: store em `~/.personalize-cv` (ou `PMCV_HOME`), mesma lógica do web reimplementada (nunca importar de `web/`).
- Mensagens em `src/lib/i18n.ts` + `messages/` nos 3 locales; mesma regra de paridade do web.

## Rules

- Lógica pura reimplementada, nunca importada de `web/`/`mobile/` (decisão em root `PROJECT.md`).
- `--version` lê `package.json` via `createRequire`.
- Licença AGPL-3.0-only. Links oficiais: ver root `PROJECT.md`.
