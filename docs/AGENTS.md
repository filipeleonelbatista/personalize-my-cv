Landing estática em `/docs` publicada no GitHub Pages (serve `/docs` direto, sem build).

## Regras

- HTML+CSS+JS puros: `index.html`, `styles.css`, `app.js` (+ `.nojekyll`). Zero dependências, zero build.
- Visual segue o design system shadcn via variáveis CSS (`[data-theme="dark"]` + `prefers-color-scheme` + `localStorage`).
- 3 locales (pt-BR/en-US/es-ES) em dicionário `STRINGS` no `app.js`, chave `data-i18n`; fallback pt-BR.
- Botão Android usa a constante `APK_URL` (URL raw do GitHub; a raiz do repo não é servida pelo Pages).
- Teste: abrir `docs/index.html` (até via `file://`), trocar os 3 idiomas sem chave faltando no console, alternar tema, conferir o loop do terminal. Paridade de chaves: script node inline comparando `Object.keys`.
