# personalize-my-cv CLI

Comando `personalize-cv` para Powershell, CMD e Bash (Windows + Linux) —
mesmo fluxo do `web/`: onboarding (chave Gemini + PDF base), gerar por vaga,
histórico (`--list`/`--show`), relatório semanal (`--report`) e ajuda
trilíngue (`--help`). UI em pt-BR/en-US/es-ES; idioma do CV (`--cv-lang`)
independente.

> Separação total (`PROJECT.md`): `cli/` não importa nada de `web/` ou
> `mobile/` — lógica pura reimplementada (mesmos contratos, mesmos testes).

## Setup

```bash
cd cli
npm i
npm run build
npm link          # expõe `personalize-cv` no PATH (PS/CMD/Bash)
```

## Uso

```bash
personalize-cv                        # interativo: onboarding → colar vaga → análise + PDF
personalize-cv --list                 # tabela + selecionar: ver análise / baixar PDF / retry / excluir
personalize-cv --show <id> [--out f.pdf]
personalize-cv --report [--week -1]   # progresso semanal (total, média/dia, melhor dia, barras)
personalize-cv --help
personalize-cv --version
personalize-cv --locale en-US --cv-lang en --out ./cv.pdf
```

Dados em `~/.personalize-cv/{config.json,base.json,apps.json}`
(`PMCV_HOME` sobrescreve — útil em testes). `config.json` com chmod 600.

## Test/build

```bash
npm test -- --run   # vitest
npx tsc --noEmit
npm run build       # gera dist/ (bin: ./dist/src/index.js)
```

## Avisos

- Chave Gemini em texto simples com chmod 600 — ofuscação, não cofre
  (como `secure-ls` no web). Use chave com limites e revogue se necessário.
- Gerar currículos precisa de internet (API Gemini); `--list`/`--show`/`--report` funcionam offline.
