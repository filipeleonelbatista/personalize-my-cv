# Mobile Expo — Port do App (NativeWind) + README raiz + APK

Data: 2026-09-30
Status: aprovado em brainstorming (4 seções)
Path: architectural → projeto novo autocontido, sem compartilhar código com `web/`

## 1. Entendimento

**Objetivo:** pasta `mobile/` com o mesmo app em Expo + NativeWind (mesmas funcionalidades e interação do `web/`), `README.md` na raiz documentando o monorepo e APK Android gerado via EAS cloud com as mesmas especificações (nome, versão, ícone).

**Sucesso:** `mobile/` roda com `npx expo start`, suite verde, `eas build -p android --profile preview` entrega APK instalável; README raiz cobre setup dos dois projetos + build.

**Constraints do parceiro (aprovadas):**
- Projetos separados no mesmo repositório, sem compartilhar nada (código duplicado como implementação própria, não importado).
- Build via EAS cloud; parceiro tem conta Expo e loga na hora.
- PDF via template HTML espelhando o layout do CV web (motor web não roda no RN).

## 2. Arquitetura mobile

- Expo SDK 53 + expo-router + NativeWind v4 + TypeScript strict, em `mobile/`.
- Rotas: `app/index.tsx` (gate/splash) → `app/onboarding.tsx` (3 passos) → `app/(tabs)/` (`curriculos.tsx`, `relatorios.tsx`) + `app/settings.tsx` (modal ou rota) — mesma interação do web.
- Estado próprio: `mobile/lib/store.ts` sobre AsyncStorage (chaves `pmcv:*`, schemas Zod equivalentes); chave Gemini em `expo-secure-store` (cofre do SO).
- Adapters RN: `expo-document-picker` (PDF) → extração de texto em WebView oculta com pdf.js (mesmo algoritmo do web) → chain Gemini direta (BYOK, `fetch`, fallback 3 models, 60s timeout) → `expo-print` (HTML espelhando `CVDocument`) → `expo-sharing`/`expo-file-system` (download, backup).
- Relatórios: gráfico de barras próprio com Views (sem dep de charts); i18n: mesmos JSONs via `use-intl` + seletor PT-BR/EN-US/ES-ES; tema: contexto próprio + classes `dark:`; toasts com `react-native-toast-message` (ou equivalente leve); offline: `expo-network` + aviso antes das chamadas de IA.

## 3. Paridade web → mobile (escopo fechado)

Inclui: splash no boot; onboarding 3 passos; gate chave+base; lista com ver/baixar-compartilhar/retry/excluir + paginação; gerar por vaga com idioma por geração; retry de failed; relatórios semanais (total, média, melhor dia, barras); settings (chave, models, backup export/import por arquivo); ajuda 4 passos; i18n total da UI (idioma do CV independente); tema claro/escuro; guarda offline.
Exclui (conceitos web): PWA/service worker, SEO/sitemap, `window.location.reload` (vira navegação por estado).

## 4. Build APK

- `mobile/app.json`: nome "Personalize My CV", slug `personalize-my-cv`, package `com.pmcv.app`, version `1.0.0`, ícone `assets/icon.png`, adaptive-icon, splash, plugin `expo-router`.
- Assets em `mobile/assets/` gerados de `web/app/icon.svg` (icon, adaptive-icon com safe-zone, splash, favicon não se aplica).
- `mobile/eas.json`: profile `preview` com `buildType: "apk"` (Android); fluxo: `cd mobile && eas login && eas build -p android --profile preview`.
- Profiles `development`/`production` documentados, fora do escopo de executar.

## 5. README raiz

`README.md` na raiz: visão do repo (`web/` + `mobile/`), decisão de separação total, pré-requisitos (Node, Expo/EAS, Android SDK p/ build local opcional), setup/dev/test/build por projeto, passo a passo do APK (inclui login), tabela de assets, paridade de funcionalidades web×mobile, avisos (chave BYOK, secure-store vs secure-ls).

## 6. Erros e limites

- Sem chave/401-403 → guia para settings/onboarding, sem persistir lixo; timeout/rede → item `failed` + retry preservando `jobText`; PDF sem texto → erro legível; storage corrompido → fallback vazio; quota → aviso + backup (limites do AsyncStorage documentados).
- Login EAS é interativo e intransferível: o build trava sem ele — o plano deve parar e pedir o login na hora.
- APK `preview` não é release assinada para loja (documentar; `production` fora do escopo).

## 7. Testes

- Vitest em `mobile/` para lógica pura (schemas, tailor/normalize, filename, pagination, reports, i18n keyset das 3 locales, store com mock de AsyncStorage, chain com `fetch` mockado).
- Contrato: rotas/telas existem; sem strings hardcoded de UI fora dos JSONs; manifest mobile (app.json) com package/versão/ícone.
- Gates: suite verde + `tsc --noEmit` limpo antes do `eas build`.

## 8. Fora do escopo

iOS/TestFlight, release de loja (AAB assinada), push notifications, sync entre web e mobile, OCR de PDF escaneado, monorepo compartilhado (`packages/core`).
