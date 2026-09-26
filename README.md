# Personalize My CV (MVP)

Tela única Next.js que cria um currículo base (JSON via IA a partir do seu PDF)
e gera currículos otimizados por vaga (PDF + análise + mensagens).

## Setup

```bash
cp .env.example .env   # preencha ZEN / GEMINI / OPENROUTER
npm i
npx prisma migrate dev
npm run dev            # http://localhost:3000
```

## Uso

1. Envie o PDF do currículo → a IA cataloga os dados e salva o `default`.
2. Clique em **Gerar outro currículo**, cole o texto da vaga → gera:
   - PDF `public/generated/<Nome>_<Cargo>_<Empresa>_<timestamp>.pdf`
   - % de afinidade + pontos fortes/fracos
   - email de apresentação + mensagem instantânea (botões Copiar)
3. A tabela lista tudo com data de geração, download e retry.

## Fallback de IAs

Ordem (só Gemini, configurável via `GEMINI_MODELS`): **gemini-3-flash-preview → gemini-2.5-flash → gemini-2.5-flash-lite** (ver `lib/llm/chain.ts`).
Se as 3 falharem, a vaga é salva com status `failed` + `errorLog`, e a
tabela mostra **Tentar novamente**.

## Troubleshooting

- `PDF sem texto selecionável` → envie um PDF com texto (não escaneado/imagem).
- `As 3 IAs falharam` → confira as keys no `.env` e use o retry da tabela.
- Banco local: `prisma/dev.db` (SQLite). PDFs: `public/generated/`.

## Testes

```bash
npx vitest run   # 19 testes
npx tsc --noEmit
npm run build
```
