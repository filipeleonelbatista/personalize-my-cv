# Personalize My CV — Project

Currículos sob medida com IA a partir do PDF base: a IA cataloga os dados,
gera versões por vaga (PDF + match + email + mensagem) e organiza o histórico
com relatórios. Sem backend: cada app guarda tudo localmente com a chave
Gemini do próprio usuário (BYOK).

## The two projects

| | `web/` | `mobile/` |
|---|---|---|
| Platform | Browsers (static site) | Android/iOS |
| Stack | Next.js 15 `output: export`, Tailwind, next-intl, Serwist PWA | Expo SDK 57, expo-router, NativeWind v4, `use-intl` |
| Storage | `localStorage` (`pmcv:*`) | AsyncStorage (`pmcv:*`) |
| API key | `secure-ls` obfuscation (not a vault) | `expo-secure-store` (OS keychain) |
| PDF in | `pdfjs-dist` in-page + vendored worker | Hidden WebView + vendored pdf.js, bytes as base64 |
| PDF out | `@react-pdf/renderer` → blob URL | `expo-print` HTML → share sheet or device library download |
| Charts | recharts | Custom bar Views |
| i18n | pt-BR / en-US / es-ES (UI only; CV language per generation) | Same JSON shape, same 3 locales |
| Theme | next-themes (system/light/dark) | Theme context + NativeWind `dark:` |
| Offline | Shell cached; AI warns before calling | `expo-network` guard before every AI call |

## Key decision: total separation

`web/` and `mobile/` share NO code — no cross-imports in either direction.
Pure logic was reimplemented in `mobile/lib` (same contracts, same tests).
This keeps each deploy independent at the cost of conscious duplication
(~10 small files). See each project's `AGENTS.md` for its own rules.

## Feature parity (and deliberate differences)

Same in both: onboarding 3 steps, gate, splash, vacancy list with
view/download/retry/delete, per-vacancy generation language, failed retry,
weekly reports, settings (key, models, backup), update-base flow, help
dialog, 3-locale UI, light/dark theme, offline warnings, localized errors.

Deliberate differences: mobile list is infinite-scroll (no page-size
control); mobile download saves into the device library (MediaLibrary,
permission first) while web downloads a blob; PWA/service worker and SEO
(sitemap/robots/JSON-LD) exist only on web; push/native share exist only
on mobile.

## Commands

```bash
# web
cd web && npm i && npm run dev        # http://localhost:3000
cd web && npm test -- --run && npx tsc --noEmit && npm run build  # → web/out/

# mobile
cd mobile && npm i && npm test -- --run && npx tsc --noEmit
cd mobile && npx expo start           # Expo Go QR
```

## APK

```bash
cd mobile
npx eas-cli@latest login              # interactive, once
npx eas-cli@latest build --platform android --profile preview --non-interactive --wait
```

Preview profile = installable APK (`distribution: internal`); `production`
= Play Store AAB. Preview APK is not a store release. EAS project:
`@filipeleonelbatista/personalize-my-cv`.

## Docs map

- `README.md` (root): setup/dev/test/build per project, APK flow, assets, warnings.
- `web/README.md`: web setup, backup, security notice, troubleshooting, visual assets.
- `web/AGENTS.md`, `mobile/AGENTS.md`: agent working rules per project.
- Specs/plans: `web/docs/superpowers/`.
