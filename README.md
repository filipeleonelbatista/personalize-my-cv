# Personalize My CV — Web + Mobile

Currículos sob medida com IA a partir do seu PDF base: a IA cataloga seus
dados, gera versões por vaga (PDF + match + email + mensagem) e organiza o
histórico com relatórios. Sem backend: cada app guarda tudo localmente com
a sua própria chave Gemini (BYOK).

> Visão dos dois projetos, decisão de separação e paridade: ver [`PROJECT.md`](./PROJECT.md).

## Projetos

| Pasta | O quê | Tech |
|---|---|---|
| `web/` | Aplicação web 100% estática | Next.js 15 (`output: export`), Prisma removido, Tailwind, next-intl (pt-BR/en-US/es-ES), PWA Serwist |
| `mobile/` | Mesmo app no Android/iOS | Expo SDK 57, expo-router, NativeWind v4, `use-intl`, Zod |

**Decisão de separação total:** os projetos não compartilham código — nenhum
import cruza `web/` ↔ `mobile/`. A lógica pura foi reimplementada em
`mobile/lib` (mesmos contratos, mesmos testes). Isso mantém cada deploy
independente ao custo de duplicação consciente (~10 arquivos).

## Pré-requisitos

- Node 20+ e npm
- Para rodar o mobile: app **Expo Go** no celular (mesmo Wi-Fi)
- Para o APK: conta Expo + `npx eas-cli@latest login`

## Web — setup/dev/test/build

```bash
cd web
npm i
npm run dev        # http://localhost:3000
npm test -- --run  # vitest
npx tsc --noEmit
npm run build      # gera web/out/
```

## Mobile — setup/dev/test/build

```bash
cd mobile
npm i
npm test -- --run  # vitest
npx tsc --noEmit
npx expo start     # escaneie o QR com o Expo Go
```

## APK (EAS cloud)

```bash
cd mobile
npx eas-cli@latest login   # sua conta Expo (interativo, uma vez; equivale a `eas login`)
npx eas-cli@latest build --platform android --profile preview --non-interactive --wait
# (`eas build -p android --profile preview` na forma curta)

O link de download do APK aparece no final + no dashboard EAS
(`eas build:list`). O profile `preview` gera APK instalável direto
(`distribution: internal`); `production` gera AAB para a Play Store.
**Preview APK ≠ release de loja.**

## Assets e ícones

| Arquivo | Tamanho | Uso |
|---|---|---|
| `web/app/icon.svg` | vetor | Fonte de todos os ícones (claro/escuro via `prefers-color-scheme`) |
| `mobile/assets/icon.png` | 1024 | Ícone do app (gerado: `npm run assets` em `mobile/`) |
| `mobile/assets/adaptive-icon.png` | 1024 com safe-zone | Android adaptativo |
| `mobile/assets/splash.png` | 1284×2778 | Splash |
| `web/public/*-192/512.png` | 192/512 | PWA + favicon web |

## Paridade web × mobile

Onboarding 3 passos, gate chave+base, splash, lista com ver/baixar/retry/excluir, gerar por vaga com idioma próprio, atualizar base (menu da base no web, Configurações no mobile), relatórios semanais, settings (chave, models, backup), ajuda 4 passos, i18n total da UI (idioma do CV independente), tema claro/escuro, guarda offline. A lista mobile é contínua (sem paginação); o download mobile salva na biblioteca do aparelho (MediaLibrary). Conceitos web sem equivalente mobile: PWA/service worker, SEO/sitemap.

## Avisos

- Chave Gemini: no mobile fica em `expo-secure-store` (cofre do SO); no web, ofuscada via `secure-ls` (não é cofre). Use chave com limites e revogue se necessário.
- Sem migração entre aparelhos: use backup export/import em Configurações.
