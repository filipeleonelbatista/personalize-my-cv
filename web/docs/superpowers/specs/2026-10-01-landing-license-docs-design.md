# Landing page + licença + docs — design spec

Data: 2026-10-01. Status: design aprovado pelo dono, aguardando plano de implementação.

## Objetivo

Publicar uma landing page trilíngue com dark mode em `/docs` (GitHub Pages),
adotar licença copyleft AGPL-3.0-only ("tudo derivado permanece de graça"),
criar `CONTRIBUTORS.md` + `DONORS.md` (lista VIP começa vazia) e atualizar
`PROJECT.md` + AGENTS para refletirem os 4 entregáveis (web, mobile, cli, docs).

Repo: `github.com:filipeleonelbatista/personalize-my-cv` (branch `master`).
Deploy web: `https://personalize-my-cv.vercel.app/`.
APK: ficará em `personalize-my-cv.apk` na raiz do repo (ainda não existe).

## Decisões (aprovadas)

1. Licença: **AGPL-3.0-only** (não MIT: MIT permite forks fechados/pagos).
2. Landing **estática pura** (HTML+CSS+JS, zero build): GitHub Pages serve
   `/docs` direto; shadcn real (React) exigiria build + output commitado.
   Visual segue o design system shadcn (variáveis, botões, cards, badges).
3. Botão Android: Pages a partir de `/docs` **não serve a raiz do repo**;
   o href usa a URL raw do GitHub com constante `APK_URL` no topo de
   `app.js`. Enquanto o APK não existir, estado "Em breve" linkando pro repo.
4. Doadores VIP: sessão + `DONORS.md` começam vazios, com CTA de apoio.

## Escopo — arquivos novos

- `docs/.nojekyll`, `docs/index.html`, `docs/styles.css`, `docs/app.js`
- `docs/AGENTS.md` (regras: estático puro, sem build, 3 locales, teste abrindo o HTML)
- `LICENSE` (texto integral AGPL-3.0), `CONTRIBUTORS.md`, `DONORS.md`
- `cli/AGENTS.md` (não existe hoje; espelha o padrão web/mobile)

## Escopo — arquivos alterados

- `PROJECT.md`: 4 entregáveis + licença + links (Vercel, Pages, APK, repo).
- `web/AGENTS.md`, `mobile/AGENTS.md`: seção de links oficiais (web deploy,
  landing, repo, APK).
- `README.md` (raiz) + `web/README.md`, `mobile/README.md`, `cli/README.md`:
  nota curta de licença. `package.json` (web/mobile/cli): campo
  `"license": "AGPL-3.0-only"`.

## Landing — estrutura (`docs/index.html`, seções com ids)

1. Header sticky: logo, nav (Features, App, CLI, Colaborar, Doadores),
   seletor idioma (pt-BR/en-US/es-ES), toggle dark mode.
2. `#hero`: badge "100% estático · sem backend · BYOK", H1, subtítulo,
   CTAs "Usar o app web" (Vercel) + "Ver no GitHub", mockup do app em CSS puro.
3. `#features`: grid de 8 cards (base via IA, match por vaga, email+mensagem,
   relatórios semanais, backup export/import, offline/PWA, 3 idiomas, temas).
4. `#app`: botão Android (estado em-breve até `APK_URL` existir) + badge
   "iOS em breve" + nota do link EAS/preview.
5. `#cli`: cards de comandos (`personalize-cv`, `--list`, `--report`) +
   **terminal animado em loop** (typewriter JS: onboarding → gera base →
   cola vaga → baixa PDF → `--report` metas) + bloco "automatize com agentes
   de IA" (Claude Code, OpenCode, Codex).
6. `#colaborar`: link repo + 4 cards (issues, PRs, tradução, docs) + resumo AGPL.
7. `#doadores`: lista VIP (vazia, CTA) + link `DONORS.md`.
8. Footer: licença, autor (linkedin filipeleonelbatista), links web/mobile/cli/repo.

## i18n + tema + animação (`docs/app.js`, `docs/styles.css`)

- Dicionário `STRINGS = { "pt-BR": {...}, "en-US": {...}, "es-ES": {...} }`;
  `data-i18n` attributes; detecção `navigator.language` → fallback pt-BR;
  persistência `localStorage("docs:locale")`.
- Dark: `[data-theme="dark"]` + `prefers-color-scheme` + `localStorage("docs:theme")`.
- Animações: reveal-on-scroll (IntersectionObserver), gradiente/blob no hero,
  terminal typewriter em loop infinito, smooth scroll, contadores nas features.
- Sem dependências externas (funciona via `file://` e no Pages).

## Verificação

- Abrir `docs/index.html`: trocar os 3 idiomas (sem chave faltando no console),
  alternar tema, conferir loop do terminal, links (Vercel, GitHub, anchors).
- `node -e` checa paridade de chaves entre os 3 locales.
- `PROJECT.md`/`AGENTS.md` releitura: cada projeto citando os outros 3 + licença.

## Fora do escopo

- Gerar o APK / publicar Release; shadcn React real; backend; analytics;
  trocar `metadataBase`/domínio do web; nomes reais de doadores.
