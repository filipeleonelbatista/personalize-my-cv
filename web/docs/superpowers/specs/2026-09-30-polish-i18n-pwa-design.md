# Polish: Splash, Ícones, Ajuda, I18n, PWA, SEO

Data: 2026-09-30
Status: aprovado em brainstorming (4 seções)
Path: architectural → abordagem B libs (next-intl provider-only + @serwist/next)

## 1. Entendimento

**Objetivo:** pacote de acabamento do app: splash de boot, identidade visual claro/escuro, dialog de ajuda, UI em 3 idiomas com seletor, PWA instalável o mais completo possível e SEO.

**Sucesso:** boot mostra splash; header tem `[idioma][?][tema]`; ajuda explica o uso nos 3 idiomas; `next build` gera `out/` + `sw.js` + manifest; Lighthouse PWA/SEO verdes; usuário recebe a lista exata de assets a criar.

**Constraints do parceiro (aprovadas):**
- I18n traduz SÓ a UI; idioma de geração do CV (`BaseLang` + `lib/pdf/i18n`) independente.
- PWA sem offline total (Gemini exige rede): shell em cache + aviso offline nas ações de IA.
- Libs (escolha B): `next-intl` sem routing + `@serwist/next` (next-pwa descontinuado; middleware next-intl quebraria o export).

## 2. Arquitetura

- `next-intl` provider-only: `messages/pt-BR.json`, `messages/en-US.json`, `messages/es-ES.json`; `lib/i18n/config.ts` (`locales = ["pt-BR","en-US","es-ES"]`, default `pt-BR`); locale em estado React + `pmcv:locale` (Zod-validado no load, fallback `pt-BR`); sem middleware/redirect; `<html lang>` dinâmico.
- PWA via `@serwist/next`: `sw.js` gerado no build; runtime caching (cache-first `_next/static`, fontes, `pdf.worker.min.mjs`; NetworkFirst + fallback offline para navegação); `public/manifest.webmanifest` (nome curto/longo, `icons` 192/512 + maskable, `theme_color` `#ffffff`/`#09090b`, `background_color`, `display: standalone`, `start_url: "/"`).
- Tudo continua `output: export`; nenhuma Server Action nova.

## 3. Splash + ícones

- Novo `app/components/SplashScreen.tsx`: tela cheia com logo, nome e indicador de progresso; exibido na fase `loading` do gate em `page.tsx` (leitura do `localStorage`); `app/loading.tsx` (skeletons) mantido para transições de rota.
- Ícones SVG adaptativos (`prefers-color-scheme`): `app/icon.svg` (favicon), monograma "PC" + traço de currículo, fundo `#ffffff` claro / `#09090b` escuro; PNGs commitados `public/icon-192.png`, `public/icon-512.png`, `public/maskable-512.png`, `public/apple-touch-icon.png` (180); `layout.tsx` declara `icons: { icon, apple }`.

## 4. Header + ajuda + locale

- Header (page + onboarding): cluster à direita `[LocaleSelector] [HelpDialog ?] [ThemeToggle]`, mesmo padrão ghost icon.
- Novo `app/components/LocaleSelector.tsx`: Select `PT-BR/EN-US/ES-ES`, persiste `pmcv:locale`, troca instantânea sem reload (re-render via contexto next-intl).
- Novo `app/components/HelpDialog.tsx`: modal passo a passo (1 conectar chave com link `https://aistudio.google.com/apikey`, 2 criar base, 3 gerar por vaga + retry, 4 backup export/import), nota de chave local ofuscada; 100% via mensagens i18n.

## 5. SEO + assets do usuário

- `layout.tsx`: `metadata` completo (title template `%s — Personalize My CV`, description, keywords, authors, openGraph pt-BR com `images: [opengraph-image]`, twitter summary_large_image, robots index/follow, `themeColor` por esquema, canonical); `app/sitemap.ts` + `app/robots.ts`; JSON-LD `SoftwareApplication` (nome, descrição, idiomas, `offers: Free`).
- Assets para o usuário criar (placeholders + tabela no README): `public/favicon.ico` (48px), `public/opengraph-image.png` (1200×630, nome + tagline, <300KB); opcionais finais `icon-192/512.png` para substituir os gerados. Código referencia com fallback aos SVGs.
- Nota honesta: SEO de SPA estática sem rotas tem alcance limitado (single page); o feito aqui é o teto sem criar novas páginas.

## 6. Erros e limites

- Locale corrompido/ausente → fallback `pt-BR` sem crash; chave de mensagem ausente num locale → fallback para `pt-BR` + warn em dev (teste trava build se locales divergirem).
- SW: ações de IA offline → toast "sem conexão" antes de chamar a API (navigator.onLine + catch); shell/navegação servidos do cache.
- `crypto`/`localStorage` indisponíveis (webview antiga) → degradação com mensagem, nunca tela branca.

## 7. Testes

- Novo `tests/i18n.test.ts`: 3 locales carregam; mesma keyset nos 3 (falha se divergir); fallback `pt-BR` para chave ausente.
- Novo `tests/pwa.test.ts`: manifest parseável com `name/icons/start_url/display`; PNGs/SVGs referenciados existem; `sw.js` presente em `out/` pós-build (teste de build, não unit).
- `tests/ui-contract.test.ts` (estender): header contém seletor de idioma, botão `?` e toggle de tema; splash renderiza na fase loading.
- Manual: Lighthouse PWA + SEO; instalar o PWA; trocar os 3 idiomas sem reload; abrir `out/` via server estático e confirmar SW ativo.

## 8. Fora do escopo

Tradução do conteúdo gerado pela IA, novas páginas/rotas para SEO, push notifications, background sync, compartilhamento de chave entre dispositivos.
