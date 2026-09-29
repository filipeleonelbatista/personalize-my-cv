# Personalize My CV — Migração para localStorage BYOK (100% cliente)

Data: 2026-09-29
Status: aprovado em brainstorming (5 seções)
Path: architectural → abordagem BYOK 100% cliente (deploy estático)

## 1. Entendimento

**Objetivo:** remover SQLite/Prisma e rodar o app sem servidor, para permitir deploy 100% estático (`output: export`). O browser vira o source of truth via `localStorage`.

**Sucesso:** sem `prisma migrate` e sem `dev.db`; upload do PDF base, geração por vaga, retry, relatórios e download de PDF funcionam só com arquivos estáticos + chave Gemini do próprio usuário; `npm run build` gera site estático.

**Constraints do parceiro (aprovadas):**
- Deploy estático; DB no browser.
- Servidor stateless foi descartado em favor de BYOK 100% cliente.
- PDF sob demanda no browser, sem salvar arquivo em `public/generated/`.
- Chave `GEMINI_API_KEY` por usuário em tela de settings, guardada em `localStorage` como conveniência single-user — sem promessa de cofre seguro.

**Nota de segurança (explícita):** nenhuma lib ("secure storage", criptografia local, base64) torna a chave segura num app estático que chama a Gemini direto do browser — a chave de decriptação também fica no browser. BYOK muda a propriedade (cada um usa a sua), não cria cofre. O spec registra isso para não vender segurança falsa.

## 2. Arquitetura

App Next.js App Router exportável, sem Server Actions, sem Route Handlers, sem Prisma.

```
app/page.tsx ("use client", single screen)
 ├─ <SettingsDialog/> (chave + models)
 ├─ <BaseSetup/> se !base else <Dashboard/>
 ├─ <VacancyTable/> + <GenerateModal/> + <DetailDrawer/>
lib/store.ts: pmcv:base, pmcv:apps[], pmcv:settings (Zod + hook useLocalStore)
lib/llm/chain.ts + gemini.ts (client-safe, recebem key por parâmetro)
lib/cv-text-client.ts (pdfjs-dist no browser)
lib/pdf/client.ts (pdf().toBlob() + object URL)
```

Sem `lib/db.ts`, sem `prisma/`, sem `app/actions.ts`, sem `app/api/**/route.ts`, sem `public/generated/*.pdf`, sem `@prisma/client`/`prisma`, sem `prisma generate` no build. `.env.example` deixa de ser requisito (substituído por settings).

## 3. Componentes (arquivos)

**Novos:**
- `web/lib/store.ts` — load/save, hook `useLocalStore`, chaves `pmcv:base` (`{resume, lang, updatedAt}`), `pmcv:apps[]` (`{id, jobText, cargo, empresa, resumeTailored, matchPercent, strengths, weaknesses, emailBody, chatMessage, status, errorLog, lang, createdAt}`), `pmcv:settings` (`{geminiKey, models}`), validação Zod, import/export JSON.
- `web/lib/pdf/client.ts` — helper `toBlob`/`openPdf` com `URL.createObjectURL` + revoke.
- `web/app/components/SettingsDialog.tsx` — colar/limpar chave, seletor de models.

**Alterados:**
- `web/app/page.tsx` vira `"use client"` (lê store, sem `getBase`/`listApplications`).
- `DashboardTabs`, `GenerateModal`, `VacancyTable`, `ReportsSection`, `BaseSetupDialog`, `BaseMenu`, `DetailDrawer` leem/escrevem no store.
- `lib/llm/chain.ts` + `gemini.ts` recebem `key` por parâmetro, sem `process.env`.
- Extração de texto do PDF base sai de `lib/cv-text.ts` (server) para cliente com `pdfjs-dist`.

**Removidos:**
- `lib/db.ts`, `prisma/` inteiro, `app/actions.ts`, `app/api/**/route.ts`, `public/generated/*.pdf`, deps `@prisma/client` + `prisma`, scripts `db:migrate` e `prisma generate`, `.gitignore` entries de `prisma/dev.db*`.

## 4. Fluxo de dados

- **Base:** PDF → texto (pdfjs no browser) → `fetch` direto à Gemini com chave do settings → `normalizeResume` → `pmcv:base`. Sem chave → bloqueia com guia para Settings.
- **Tailor:** lê `pmcv:base` + `jobText` → chain cliente (fallback 3 models) → `normalizeEnvelope` → novo item `pmcv:apps[]` com `id: crypto.randomUUID()`, `createdAt: ISO`. Falha → item `status: failed` + `errorLog` (permite retry).
- **PDF:** nunca persistido; gerado on-demand via `pdf(resume).toBlob()` → object URL temporária para visualizar/baixar, revogada ao fechar/deletar.
- **Relatórios/lista/delete/retry:** derivados de `pmcv:apps[]` no cliente (reusa `weekRange`, `bucketByWeekday`); delete é splice; retry re-chama LLM e atualiza o item.
- **Backup:** export/import JSON de `base+apps` (+ settings sem chave por padrão).

## 5. Erros e limites

- Sem chave / 401-403 → bloqueia com guia para Settings, sem persistir lixo.
- Timeout (60s Abort) / rede / quota → item `failed` + `errorLog` truncado, retry preserva `jobText`.
- Zod inválido → 1 tentativa de repair via LLM (`buildRepairUser`), senão `failed` com detalhe.
- PDF sem texto selecionável / JSON corrompido / `QuotaExceededError` → mensagens guiadas + botões exportar/limpar/importar, nunca crash; load valida com Zod e descarta itens inválidos.
- Sem migração do `dev.db` antigo (começa zerado, documentado no README); evento `storage` sincroniza multi-aba.

## 6. Testes

- `smoke.test.ts` atualizado: sem Prisma; checa chaves `pmcv:*`, `output: export`, ausência de `lib/db.ts`/`prisma/`.
- Novo `store.test.ts`: round-trip base/apps/settings, rejeição Zod, JSON corrompido → fallback vazio, `QuotaExceededError` guiado.
- `llm-chain.test.ts` com `fetch` mockado: usa chave por parâmetro, fallback entre models, caminho repair.
- Mantidos (adaptados onde tocavam server): `tailor`, `resume-schema`, `filename`, `pagination`, `reports`, `pdf-i18n`, `json-text`, `ui-contract`; `cv-text` migra para extrator cliente.
- Manual: `npm run build` exportável, backup import/export, sincronia multi-aba.

## 7. Fora do escopo

Migração automática do `dev.db`, cofre real de chaves, multi-user/auth, OCR de PDF escaneado, fila/cron, i18n novo.
