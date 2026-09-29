# Personalize My CV

Site 100% estático (Next.js `output: "export"`) que cria um currículo base
(JSON via IA a partir do seu PDF) e gera currículos otimizados por vaga
(PDF + análise + mensagens). Sem backend, sem banco: tudo fica no
`localStorage` do navegador com a sua própria chave Gemini (BYOK).

## Setup

```bash
npm i
npm run dev            # http://localhost:3000
```

Depois complete o onboarding no navegador: informe sua chave Gemini
(obtenha em https://aistudio.google.com/apikey), escolha os modelos e
envie o PDF do currículo base.

## Uso

1. Envie o PDF do currículo → a IA cataloga os dados e salva a base no navegador.
2. Clique em **Personalizar com IA**, escolha o idioma, cole o texto da vaga → gera:
   - PDF para download (gerado no navegador, na hora)
   - % de afinidade + pontos fortes/fracos
   - email de apresentação + mensagem instantânea (botões Copiar)
3. A tabela lista tudo com data de geração, download e retry.

## Backup import/export

A base e as vagas ficam nas chaves `pmcv:base` e `pmcv:apps` do
`localStorage`. Use `exportBackup()` (em `lib/store.ts`) para gerar um JSON
com tudo e `importBackup(json)` para restaurar — útil para trocar de
navegador ou limpar espaço.

## Aviso de segurança

A chave Gemini fica guardada via `secure-ls` (ofuscação com AES + chave
embarcada no bundle). Isso **não** é um cofre seguro: qualquer pessoa com
acesso ao navegador consegue extrair a chave. Use uma chave com limites de
uso/cota e revogue se necessário.

## Troubleshooting

- `PDF sem texto selecionável` → envie um PDF com texto (não escaneado/imagem).
- `As IAs falharam` → confira a chave no onboarding e use o retry da tabela.
- `Armazenamento cheio` → exporte o backup e apague vagas antigas.

## Testes

```bash
npm test -- --run
npx tsc --noEmit
npm run build        # gera web/out/
```
