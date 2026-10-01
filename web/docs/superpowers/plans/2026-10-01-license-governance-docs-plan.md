# Licença + governança + docs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adotar AGPL-3.0-only no repo e atualizar PROJECT.md/AGENTS.md para os 4 entregáveis.

**Architecture:** Arquivos de texto na raiz + campos `license` nos 3 `package.json` + seções de links nos AGENTS existentes e 2 AGENTS novos (cli, docs).

**Tech Stack:** Markdown, `LICENSE` (texto oficial GNU), Node (checagem).

**Spec:** `web/docs/superpowers/specs/2026-10-01-landing-license-docs-design.md` (seções Licença, CONTRIBUTORS/DONORS, Docs).

## Global Constraints

- Licença exata: `AGPL-3.0-only` (aprovada; MIT foi rejeitada porque permite forks fechados).
- Repo: `github.com:filipeleonelbatista/personalize-my-cv`, branch `master`.
- Web deploy: `https://personalize-my-cv.vercel.app/`. APK futuro: `personalize-my-cv.apk` na raiz.
- Nunca compartilhar código entre `web/` ↔ `mobile/` (mantido; aqui só docs).
- Commits passam pelo hook `scripts/hooks/pre-commit` (auto-bump de versão) — comitar no fim de cada task.

## Review Focus

- Texto da AGPL truncado ou adulterado quebra a validade: executor confere o header `GNU AFFERO GENERAL PUBLIC LICENSE Version 3` e o rodapé `END OF TERMS AND CONDITIONS` (Task 1 o testa).
- `DONORS.md`/`CONTRIBUTORS.md` com nomes inventados seria constrangedor: lista VIP começa VAZIA (Task 2 o testa).
- AGENTS desatualizado confunde agentes futuros: cada AGENTS deve citar os outros 3 projetos + licença (Task 4 o testa).
- Nenhum outro input crítico: arquivos estáticos de texto, sem runtime.

---

### Task 1: LICENSE + package.json

**Files:**
- Create: `LICENSE`
- Modify: `web/package.json`, `mobile/package.json`, `cli/package.json` (campo `license`)
- Test: `node -e` inline (sem arquivo de teste; ver Step 2)

**Interfaces:**
- Consumes: texto oficial em https://www.gnu.org/licenses/agpl-3.0.txt
- Produces: `LICENSE` íntegro; `license: AGPL-3.0-only` nos 3 manifests

- [ ] **Step 1: Baixar o texto oficial**

Run: `curl -sL https://www.gnu.org/licenses/agpl-3.0.txt -o LICENSE && head -c 200 LICENSE && wc -c LICENSE`
Expected: começa com `GNU AFFERO GENERAL PUBLIC LICENSE`, `~34500` bytes

- [ ] **Step 2: Verificar integridade**

Run: `head -1 LICENSE && tail -1 LICENSE && grep -c "AGPL" LICENSE`
Expected: `GNU AFFERO GENERAL PUBLIC LICENSE`, `END OF TERMS AND CONDITIONS`, count > 5

- [ ] **Step 3: Campos license**

Em cada um dos 3 `package.json`, após a linha `"private": true,` (web) ou equivalente, adicionar `"license": "AGPL-3.0-only",`. Edição exata via edit tool, um arquivo por vez.
Verify: `grep '"license"' web/package.json mobile/package.json cli/package.json` → 3 linhas `AGPL-3.0-only`

- [ ] **Step 4: Commit**

```bash
git add LICENSE web/package.json mobile/package.json cli/package.json
git commit -m "chore: AGPL-3.0-only license"
```

### Task 2: CONTRIBUTORS.md + DONORS.md

**Files:**
- Create: `CONTRIBUTORS.md`, `DONORS.md`

**Interfaces:**
- Consumes: nada
- Produces: arquivos de governança linkáveis pela landing

- [ ] **Step 1: Escrever CONTRIBUTORS.md**

```markdown
# Contributors

- **filipeleonelbatista** — criador e mantenedor ([LinkedIn](https://linkedin.com/in/filipeleonelbatista))

## Como entrar pra lista

1. Abra uma issue ou PR em https://github.com/filipeleonelbatista/personalize-my-cv
2. Traduções, docs, testes e código valem igual
3. Todo PR mergeado adiciona seu nome aqui
```

- [ ] **Step 2: Escrever DONORS.md**

```markdown
# Doadores VIP

Quem mantém este projeto gratuito para sempre.

| Doador | Desde |
|---|---|
| *Ninguém ainda — seja a primeira pessoa* | — |

## Como apoiar

Abra uma issue com o título `doação` em https://github.com/filipeleonelbatista/personalize-my-cv
e combinamos a forma (Pix ou outra). Todo doador entra na lista VIP acima e na landing.
```

- [ ] **Step 3: Verificar + commit**

Run: `grep -c "filipeleonelbatista" CONTRIBUTORS.md && grep -ci "ninguém ainda" DONORS.md`
Expected: `1` e `1` (lista VIP vazia, sem nomes inventados)

```bash
git add CONTRIBUTORS.md DONORS.md
git commit -m "docs: contributors and VIP donors"
```

### Task 3: Notas de licença nos READMEs

**Files:**
- Modify: `README.md` (raiz), `web/README.md`, `mobile/README.md`, `cli/README.md`

**Interfaces:**
- Consumes: `LICENSE`
- Produces: seção de licença consistente nos 4 READMEs

- [ ] **Step 1: Adicionar a seção (mesmo texto, adaptado o caminho do LICENSE)**

Raiz (`README.md`, após a seção de Avisos/paridade — ler o arquivo e anexar no fim):

```markdown
## Licença

AGPL-3.0-only — ver [`LICENSE`](./LICENSE). Você pode usar, estudar, modificar e
distribuir, desde que trabalhos derivados permaneçam livres e abertos sob a mesma licença.
```

Nos 3 READMEs de projeto, o link é `../LICENSE`:

```markdown
## Licença

AGPL-3.0-only — ver [`LICENSE`](../LICENSE).
```

- [ ] **Step 2: Verificar + commit**

Run: `grep -l "AGPL-3.0-only" README.md web/README.md mobile/README.md cli/README.md | wc -l`
Expected: `4`

```bash
git add README.md web/README.md mobile/README.md cli/README.md
git commit -m "docs: license notice in readmes"
```

### Task 4: PROJECT.md + AGENTS

**Files:**
- Modify: `PROJECT.md`, `web/AGENTS.md`, `mobile/AGENTS.md`
- Create: `cli/AGENTS.md`, `docs/AGENTS.md`

**Interfaces:**
- Consumes: spec (links oficiais), `docs/index.html` + `docs/app.js` (Task do outro plano — citar nomes, não conteúdo)
- Produces: docs de agente refletindo 4 entregáveis + licença

- [ ] **Step 1: PROJECT.md — tabela de 4 projetos + licença + links**

Ler `PROJECT.md` atual e: (a) adicionar linha `docs/` na tabela de projetos
(`Landing trilíngue estática | HTML+CSS+JS puro, GitHub Pages via /docs`);
(b) anexar seção:

```markdown
## Links oficiais

- Web: https://personalize-my-cv.vercel.app/
- Landing: https://filipeleonelbatista.github.io/personalize-my-cv/
- Repo: https://github.com/filipeleonelbatista/personalize-my-cv
- APK: `personalize-my-cv.apk` na raiz do repo (em breve, quando terminar de testar)

## Licença

AGPL-3.0-only (`LICENSE`). Derivados precisam continuar abertos e gratuitos.
Doadores VIP em `DONORS.md`, contribuidores em `CONTRIBUTORS.md`.
```

- [ ] **Step 2: AGENTS existentes — seção de links**

Anexar ao fim de `web/AGENTS.md` e `mobile/AGENTS.md`:

```markdown
## Links oficiais

- Web deploy: https://personalize-my-cv.vercel.app/ · Landing: https://filipeleonelbatista.github.io/personalize-my-cv/ · Repo: https://github.com/filipeleonelbatista/personalize-my-cv · Licença: AGPL-3.0-only.
```

- [ ] **Step 3: cli/AGENTS.md (novo, espelha o padrão)**

```markdown
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
```

- [ ] **Step 4: docs/AGENTS.md (novo)**

```markdown
Landing estática em `/docs` publicada no GitHub Pages (serve `/docs` direto, sem build).

## Regras

- HTML+CSS+JS puros: `index.html`, `styles.css`, `app.js` (+ `.nojekyll`). Zero dependências, zero build.
- Visual segue o design system shadcn via variáveis CSS (`[data-theme="dark"]` + `prefers-color-scheme` + `localStorage`).
- 3 locales (pt-BR/en-US/es-ES) em dicionário `STRINGS` no `app.js`, chave `data-i18n`; fallback pt-BR.
- Botão Android usa a constante `APK_URL` (URL raw do GitHub; a raiz do repo não é servida pelo Pages).
- Teste: abrir `docs/index.html` (até via `file://`), trocar os 3 idiomas sem chave faltando no console, alternar tema, conferir o loop do terminal. Paridade de chaves: script node inline comparando `Object.keys`.
```

- [ ] **Step 5: Verificar + commit**

Run: `grep -l "personalize-my-cv.vercel.app" PROJECT.md web/AGENTS.md mobile/AGENTS.md cli/AGENTS.md docs/AGENTS.md | wc -l`
Expected: `5`

```bash
git add PROJECT.md web/AGENTS.md mobile/AGENTS.md cli/AGENTS.md docs/AGENTS.md
git commit -m "docs: project map, links and per-project agent rules"
```
