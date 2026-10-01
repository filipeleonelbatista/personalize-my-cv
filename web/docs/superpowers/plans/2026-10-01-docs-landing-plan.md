# Landing /docs (GitHub Pages) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Landing trilíngue com dark mode em `/docs`, servida pelo GitHub Pages sem build.

**Architecture:** 4 arquivos estáticos puros (`index.html`, `styles.css`, `app.js`, `.nojekyll`). Todo texto via `data-i18n` + dicionário `STRINGS` com os 3 locales; tema via `[data-theme]`; terminal com typewriter em loop; reveal-on-scroll via IntersectionObserver.

**Tech Stack:** HTML + CSS + JS puros, zero dependências, zero build. Funciona via `file://`.

**Spec:** `web/docs/superpowers/specs/2026-10-01-landing-license-docs-design.md`

## Global Constraints

- Nenhum build, nenhuma dependência externa (o Pages serve `/docs` direto).
- `APK_URL` no topo de `app.js` = `https://github.com/filipeleonelbatista/personalize-my-cv/raw/master/personalize-my-cv.apk`; botão Android em estado "em breve" (link pro repo) até o APK existir.
- Links: web `https://personalize-my-cv.vercel.app/`, repo `https://github.com/filipeleonelbatista/personalize-my-cv`.
- Copy exata abaixo (pt-BR/en-US/es-ES). Não inventar chaves; não deixar chave sem tradução.

## Review Focus

- Chave `data-i18n` sem entrada no dicionário deixa texto em branco: Task 5 testa que toda chave do HTML existe nos 3 locales.
- Terminal parado (erro no loop) mata a seção CLI: Task 4 testa o ciclo completo com timers mockados ou reduzidos.
- Botão Android apontando pra URL relativa quebraria (Pages não serve a raiz do repo): Task 3 testa o href absoluto raw.
- Tema/idioma não persistindo entre visitas: Task 2 testa `localStorage`.
- HTML inválido/acessibilidade básica (`lang`, `alt`, labels): Task 5 checa.

---

### Task 1: Esqueleto + CSS shadcn-style

**Files:**
- Create: `docs/.nojekyll` (vazio), `docs/index.html` (estrutura + todas as seções com `data-i18n`, textos pt-BR inline como fallback), `docs/styles.css`

**Interfaces:**
- Consumes: nada
- Produces: IDs de seção `features, app, cli, colaborar, doadores`; IDs `langSelect, themeToggle, terminal, androidBtn, year`; classes `.reveal`, variáveis `--background/--foreground/--primary/--muted/--border` + `[data-theme="dark"]`

**Copy (usar estes textos pt-BR inline no HTML; EN/ES vão no Task 2):**

Header nav: Recursos, App, CLI, Colaborar, Doadores. Hero badge: "100% estático · sem backend · sua chave Gemini". H1: "Currículos sob medida com IA". Sub: "Cadastre seu CV base em PDF e gere versões otimizadas por vaga — afinidade, email e mensagem. Grátis, sem conta: seus dados ficam no seu navegador." CTAs: "Usar o app web" / "Ver no GitHub".

- [ ] **Step 1: index.html com as 8 seções**

Estrutura: `header.site-header` (brand + nav + `select#langSelect` + `button#themeToggle`), `main` com `section#hero` (badge, h1, sub, CTAs, `.mockup` com 3 linhas fake: "CV base ✓", "Match 92%", "PDF pronto" — `aria-hidden="true"`), `section#features` (h2 + grid de 8 `.card`: cada um `h3[data-i18n=fN-t]` + `p[data-i18n=fN-d]`, N=1..8), `section#app` (`a#androidBtn`, badge iOS, `p[data-i18n=apkNote]`), `section#cli` (chips de comandos + `pre#terminal` + `p[data-i18n=agents]`), `section#colaborar` (4 cards + licença + botão repo), `section#doadores` (lista vazia + CTA), `footer` (licença, autor, links, `span#year`). Todos os textos com `data-i18n="chave"`. `<html lang="pt-BR">`, meta description pt-BR, `<title>Personalize My CV — Currículos sob medida com IA</title>`.

- [ ] **Step 2: styles.css**

Variáveis light em `:root` e dark em `[data-theme="dark"]` (`--background:#ffffff/--foreground:#09090b/--primary:#18181b/--muted:#f4f4f5/--border:#e4e4e7`; dark inverte: bg `#09090b`, fg `#fafafa`, muted `#27272a`, border `#27272a`). Layout: header sticky com blur, hero com gradiente radial, grid responsivo (`repeat(auto-fit,minmax(240px,1fr))`), cards com border + radius 12px, botões `.btn` (primary/outline), terminal dark sempre (`#0c0c0e` fundo, `#4ade80` texto), `.reveal` (opacity/translate + `.visible`), smooth scroll, `prefers-reduced-motion` desliga animações.

- [ ] **Step 3: Commit**

```bash
git add docs/.nojekyll docs/index.html docs/styles.css
git commit -m "feat(docs): landing skeleton and styles"
```

### Task 2: app.js — i18n + tema + interações

**Files:**
- Create: `docs/app.js`
- Test: `node -e` inline (paridade de chaves, Step 4)

**Interfaces:**
- Consumes: IDs e `data-i18n` do Task 1
- Produces: troca de idioma/tema persistida; `APK_URL` como const no topo

**Copy EN (chave: texto):** navFeatures "Features", navApp "App", navCli "CLI", navCollab "Contribute", navDonors "Donors", badge "100% static · no backend · your Gemini key", h1 "Tailored resumes with AI", sub "Register your base CV as PDF and generate optimized versions per job — match score, email and message. Free, no account: your data stays in your browser.", ctaWeb "Open the web app", ctaGh "View on GitHub", featTitle "Everything the app does", f1-t "AI base CV", f1-d "Upload the PDF and AI catalogs your data as JSON.", f2-t "Per-job match", f2-d "Affinity score with strengths and weaknesses.", f3-t "Email + message", f3-d "Cover email and instant message, ready to copy.", f4-t "Weekly reports", f4-d "History and charts of your applications.", f5-t "Backup export/import", f5-d "Take your data to any browser.", f6-t "Offline + PWA", f6-d "Installable shell with offline fallback.", f7-t "3 languages", f7-d "Full UI in PT, EN and ES.", f8-t "Light/dark theme", f8-d "Follows your system.", appTitle "Take it with you", appSub "Native app with the same features. Android first.", androidBtn "Download for Android", androidSoon "Coming soon: APK at the repo root", iosBadge "iOS soon", apkNote "Preview builds via EAS; the Play listing comes later.", cliTitle "Automate in the terminal", cliSub "`personalize-cv`: onboard once, generate per job, track goals — scriptable and agent-friendly.", agentsNote "Agent-friendly: automate it with Claude Code, OpenCode, Codex and others.", collabTitle "Contribute", collabSub "Collaborative project, free forever (AGPL-3.0).", cIssues-t "Issues", cIssues-d "Report bugs or suggest features.", cPRs-t "Pull requests", cPRs-d "Code, tests and fixes welcome.", cI18n-t "Translations", cI18n-d "Help with PT, EN and ES.", cDocs-t "Docs", cDocs-d "Guides and examples.", repoBtn "Open the repository", licNote "AGPL-3.0-only: derivatives stay free and open.", donorsTitle "VIP donors", donorsEmpty "Nobody yet — be the first.", donorsCta "Support", donorsDoc "See DONORS.md", footRights "Free forever under AGPL-3.0.", footBy "Built by filipeleonelbatista".

**Copy ES:** navFeatures "Recursos", navApp "App", navCli "CLI", navCollab "Colaborar", navDonors "Donantes", badge "100% estático · sin backend · tu clave de Gemini", h1 "Currículos a medida con IA", sub "Registra tu CV base en PDF y genera versiones optimizadas por vacante — afinidad, correo y mensaje. Gratis, sin cuenta: tus datos quedan en tu navegador.", ctaWeb "Usar la app web", ctaGh "Ver en GitHub", featTitle "Todo lo que hace la app", f1-t "CV base con IA", f1-d "Sube el PDF y la IA cataloga tus datos en JSON.", f2-t "Afinidad por vacante", f2-d "Puntaje con fortalezas y debilidades.", f3-t "Correo + mensaje", f3-d "Correo de presentación y mensaje, listos para copiar.", f4-t "Informes semanales", f4-d "Historial y gráficos de tus candidaturas.", f5-t "Respaldo export/import", f5-d "Lleva tus datos a cualquier navegador.", f6-t "Offline + PWA", f6-d "Instalable, con fallback sin conexión.", f7-t "3 idiomas", f7-d "UI completa en PT, EN y ES.", f8-t "Tema claro/oscuro", f8-d "Sigue tu sistema.", appTitle "Llévalo contigo", appSub "App nativa con las mismas funciones. Android primero.", androidBtn "Descargar para Android", androidSoon "Próximamente: APK en la raíz del repo", iosBadge "iOS pronto", apkNote "Builds preview vía EAS; el listado Play viene después.", cliTitle "Automatiza en la terminal", cliSub "`personalize-cv`: onboarding una vez, genera por vacante, sigue metas — scripteable y agent-friendly.", agentsNote "Agent-friendly: automatízalo con Claude Code, OpenCode, Codex y otros.", collabTitle "Colabora", collabSub "Proyecto colaborativo, gratis para siempre (AGPL-3.0).", cIssues-t "Issues", cIssues-d "Reporta bugs o sugiere funciones.", cPRs-t "Pull requests", cPRs-d "Código, tests y fixes bienvenidos.", cI18n-t "Traducciones", cI18n-d "Ayuda con PT, EN y ES.", cDocs-t "Docs", cDocs-d "Guías y ejemplos.", repoBtn "Abrir el repositorio", licNote "AGPL-3.0-only: los derivados siguen libres y abiertos.", donorsTitle "Donantes VIP", donorsEmpty "Nadie aún — sé la primera persona.", donorsCta "Apoyar", donorsDoc "Ver DONORS.md", footRights "Gratis para siempre bajo AGPL-3.0.", footBy "Hecho por filipeleonelbatista".

**Copy PT das mesmas chaves** (para o dicionário; o HTML já tem o pt-BR inline): navFeatures "Recursos", navApp "App", navCli "CLI", navCollab "Colaborar", navDonors "Doadores", badge "100% estático · sem backend · sua chave Gemini", h1 "Currículos sob medida com IA", sub "Cadastre seu CV base em PDF e gere versões otimizadas por vaga — afinidade, email e mensagem. Grátis, sem conta: seus dados ficam no seu navegador.", ctaWeb "Usar o app web", ctaGh "Ver no GitHub", featTitle "Tudo que o app faz", f1-t "CV base via IA", f1-d "Envie o PDF e a IA cataloga seus dados em JSON.", f2-t "Match por vaga", f2-d "Índice de afinidade com pontos fortes e fracos.", f3-t "Email + mensagem", f3-d "Email de apresentação e mensagem prontos pra copiar.", f4-t "Relatórios semanais", f4-d "Histórico e gráficos das candidaturas.", f5-t "Backup export/import", f5-d "Leve seus dados pra qualquer navegador.", f6-t "Offline + PWA", f6-d "Instalável, com fallback offline.", f7-t "3 idiomas", f7-d "UI completa em PT, EN e ES.", f8-t "Tema claro/escuro", f8-d "Segue seu sistema.", appTitle "Leve no bolso", appSub "App nativo com as mesmas funções. Android primeiro.", androidBtn "Baixar para Android", androidSoon "Em breve: APK na raiz do repo", iosBadge "iOS em breve", apkNote "Builds preview via EAS; a listagem Play vem depois.", cliTitle "Automatize no terminal", cliSub "`personalize-cv`: onboarding uma vez, gere por vaga, acompanhe metas — scripteável e agent-friendly.", agentsNote "Agent-friendly: automatize com Claude Code, OpenCode, Codex e outros.", collabTitle "Colabore", collabSub "Projeto colaborativo, gratuito para sempre (AGPL-3.0).", cIssues-t "Issues", cIssues-d "Reporte bugs ou sugira funções.", cPRs-t "Pull requests", cPRs-d "Código, testes e correções bem-vindos.", cI18n-t "Traduções", cI18n-d "Ajude com PT, EN e ES.", cDocs-t "Docs", cDocs-d "Guias e exemplos.", repoBtn "Abrir o repositório", licNote "AGPL-3.0-only: derivados ficam livres e abertos.", donorsTitle "Doadores VIP", donorsEmpty "Ninguém ainda — seja a primeira pessoa.", donorsCta "Apoiar", donorsDoc "Ver DONORS.md", footRights "Grátis para sempre sob AGPL-3.0.", footBy "Feito por filipeleonelbatista".

- [ ] **Step 1: STRINGS + setLocale**

```js
const APK_URL = "https://github.com/filipeleonelbatista/personalize-my-cv/raw/master/personalize-my-cv.apk";
const REPO_URL = "https://github.com/filipeleonelbatista/personalize-my-cv";
const STRINGS = { "pt-BR": { /* copy PT acima */ }, "en-US": { /* copy EN */ }, "es-ES": { /* copy ES */ } };
function setLocale(l) {
  const d = STRINGS[l] || STRINGS["pt-BR"];
  document.documentElement.lang = l;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const k = el.getAttribute("data-i18n");
    if (d[k] !== undefined) el.textContent = d[k];
    else console.warn("[docs] missing key:", l, k);
  });
  try { localStorage.setItem("docs:locale", l); } catch {}
}
```

Detectar inicial: `localStorage docs:locale` → `navigator.language` (prefixo `en`→en-US, `es`→es-ES, senão pt-BR). `langSelect.onchange` → setLocale.

- [ ] **Step 2: Tema + ano + reveal**

Tema: inicial `localStorage docs:theme` → `matchMedia("(prefers-color-scheme: dark)")` → light; toggle alterna `documentElement.dataset.theme` e persiste; botão mostra sol/lua (texto ☀/☾). `year` = `new Date().getFullYear()`. Reveal: IntersectionObserver adiciona `.visible` a `.reveal`.

- [ ] **Step 3: Botão Android em-breve**

`androidBtn.href = REPO_URL; androidBtn.dataset.soon = "1"` + insere badge `androidSoon` (o flip pra `APK_URL` quando o arquivo existir é trocar 2 linhas, documentado em comentário no código).

- [ ] **Step 4: Paridade de chaves (teste)**

Run: `node -e "const fs=require('fs');const s=fs.readFileSync('docs/app.js','utf8');const m=s.match(/const STRINGS = (\{.*?\n\};)/s);const STRINGS=eval('('+m[1]+')');const k=o=>Object.keys(o).sort().join();const pt=k(STRINGS['pt-BR']);if(k(STRINGS['en-US'])!==pt||k(STRINGS['es-ES'])!==pt){console.error('DIVERGE');process.exit(1)}console.log('parity ok:',pt.split(',').length,'keys');const html=fs.readFileSync('docs/index.html','utf8');const used=[...html.matchAll(/data-i18n=\"([^\"]+)\"/g)].map(x=>x[1]);const miss=used.filter(u=>!(u in STRINGS['pt-BR']));if(miss.length){console.error('MISSING:',miss);process.exit(1)}console.log('html keys ok:',used.length)"`
Expected: `parity ok: N keys` e `html keys ok: M` (N≥60, M≥60)

- [ ] **Step 5: Commit**

```bash
git add docs/app.js
git commit -m "feat(docs): i18n, theme and interactions"
```

### Task 3: Terminal animado em loop

**Files:**
- Modify: `docs/app.js` (append), `docs/index.html` (garantir `pre#terminal > code#termBody` + `span.term-cursor`)

**Interfaces:**
- Consumes: `setLocale` (re-renderiza o script ao trocar idioma)
- Produces: loop infinito de digitação

**Scripts do terminal (array de linhas por locale; `✓` verde via classe, `$` prompt):**

pt-BR:
```
$ personalize-cv
? Sua chave Gemini ********
? PDF do CV ./meu-cv.pdf
✓ Base criada: Ana — Dev (pt-BR)
$ personalize-cv
? Cole o texto da vaga…
✓ Match 92% · PDF em ./cv-vaga-acme.pdf
$ personalize-cv --report
Semana: 3 candidaturas · média 87%
```

en-US: `$ personalize-cv` / `? Your Gemini key ********` / `? CV PDF ./my-cv.pdf` / `✓ Base ready: Ana — Dev (en)` / `$ personalize-cv` / `? Paste the job posting…` / `✓ Match 92% · PDF at ./cv-acme-job.pdf` / `$ personalize-cv --report` / `Week: 3 applications · avg 87%`

es-ES: `$ personalize-cv` / `? Tu clave de Gemini ********` / `? PDF del CV ./mi-cv.pdf` / `✓ Base lista: Ana — Dev (es)` / `$ personalize-cv` / `? Pega el texto de la vacante…` / `✓ Afinidad 92% · PDF en ./cv-vacante-acme.pdf` / `$ personalize-cv --report` / `Semana: 3 candidaturas · media 87%`

- [ ] **Step 1: Typewriter com respeito a reduced-motion**

```js
const TERMINAL = { "pt-BR": [/* linhas acima */], "en-US": [...], "es-ES": [...] };
let termTimer = null;
function playTerminal(locale) {
  const body = document.getElementById("termBody");
  if (!body) return;
  clearTimeout(termTimer);
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    body.textContent = TERMINAL[locale].join("\n");
    return;
  }
  const lines = TERMINAL[locale];
  let li = 0, ci = 0;
  body.textContent = "";
  (function tick() {
    if (li >= lines.length) { termTimer = setTimeout(() => playTerminal(locale), 3500); return; }
    const line = lines[li];
    body.textContent += line[ci] || "";
    ci++;
    if (ci > line.length) { body.textContent += "\n"; li++; ci = 0; termTimer = setTimeout(tick, line.startsWith("$") ? 500 : 260); }
    else termTimer = setTimeout(tick, line.startsWith("$") ? 60 : 14);
  })();
}
```

Chamar `playTerminal(locale)` dentro de `setLocale` e no boot. Linhas com `✓` ganham cor via CSS (`.term-ok`)? Simplificação honesta: colorir via CSS `pre#terminal { color:#4ade80 }` e prompts `$` em bold — sem parsing por linha (YAGNI).

- [ ] **Step 2: Smoke test do loop**

Run: `node -e "/* simula timers acelerados */const lines=['\$ x','✓ y'];let out='';let li=0,ci=0;let guard=0;while(li<lines.length&&guard++<500){out+=lines[li][ci]||'';ci++;if(ci>lines[li].length){out+='\n';li++;ci=0}}console.log(JSON.stringify(out))"`
Expected: `"$ x\n✓ y\n"` (lógica do tick validada)

- [ ] **Step 3: Commit**

```bash
git add docs/app.js docs/index.html
git commit -m "feat(docs): animated CLI terminal loop"
```

### Task 4: Verificação final + commit

- [ ] **Step 1: Abrir e inspecionar**

Run: `python3 -m http.server 8123 -d docs & sleep 1; curl -s http://localhost:8123/ | grep -c "data-i18n"; kill %1`
Expected: número ≥ 60 (todas as chaves presentes no HTML servido)

- [ ] **Step 2: Releitura da spec contra o implementado**

Conferir cada item da spec: hero web ✓, features ✓, download android + iOS breve ✓, CLI + terminal loop + agentes ✓, colaborar + repo ✓, licença gratuita ✓, contributors ✓, doadores VIP ✓, PROJECT/AGENTS ✓ (outro plano). Faltando algo: voltar à task dona.

- [ ] **Step 3: Commit final (se houver ajuste)**

```bash
git add -A && git commit -m "feat(docs): landing page for github pages"  # só se houver mudança pendente
```
