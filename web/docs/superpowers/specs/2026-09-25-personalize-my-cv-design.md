# Personalize My CV — Design (MVP)

Data: 2026-09-25
Status: aprovado em brainstorming (5 seções)
Path: architectural → abordagem A (Server Actions síncrono)

## 1. Entendimento

**Objetivo:** tela única Next.js que (1) cria um `default` JSON a partir do PDF do currículo via LLM, (2) gera currículos otimizados por vaga (PDF + análise + mensagens), (3) lista histórico com download/retry.

**Sucesso:** upload PDF → default salvo; colar vaga → linha na tabela com PDF `<Nome>_<Cargo>_<Empresa>_<timestamp>.pdf`, match%, fortes/fracos, email + mensagem copiáveis; fallback 3 LLMs com retry manual.

**Constraints do parceiro:**
- SQLite via Prisma (não filesystem puro, não localStorage).
- Fallback LLM: Zen → Gemini → OpenRouter.
- PDF via `@react-pdf/renderer` (Tailwind só na UI).
- Schema Zod canônico: estrutura 2.
- Falha total: salva `failed` + botão retry.
- MVP local, sem auth, uma tela.

## 2. Arquitetura (Abordagem A)

Next.js App Router (TS) + Tailwind (UI) + Prisma SQLite + Zod + `pdfjs-dist` + `@react-pdf/renderer`. Tudo em Server Actions síncronas (`app/actions.ts`) com timeout estendido; sem fila/worker no MVP.

```
app/page.tsx (Server Component, single screen)
 ├─ <BaseSetup/> se !base else <Dashboard/>
 ├─ <VacancyTable/> + <GenerateModal/> + <DetailDrawer/>
app/actions.ts: uploadBase(), tailorResume(), retryTailor()
lib/resume-schema.ts (Zod v2)
lib/llm/chain.ts → zen.ts, gemini.ts, openrouter.ts, prompts.ts
lib/pdf/CVDocument.tsx + lib/filename.ts
prisma/schema.prisma (BaseResume, TailoredApplication)
public/generated/*.pdf
```

## 3. Dados

### 3.1 Prisma

```prisma
model BaseResume {
  id        Int      @id @default(1)
  json      String   // ResumeSchema JSON stringificado
  updatedAt DateTime @updatedAt
}
model TailoredApplication {
  id           Int      @id @default(autoincrement())
  jobText      String
  cargo        String   @default("Vaga")
  empresa      String   @default("Empresa")
  fileName     String   @unique
  pdfPath      String   // /generated/<file>
  matchPercent Int      @default(0)
  strengths    String   // JSON string[]
  weaknesses   String   // JSON string[]
  emailBody    String   @default("")
  chatMessage  String   @default("")
  status       String   @default("done") // done | failed
  errorLog     String   @default("")
  createdAt    DateTime @default(now())
}
```

### 3.2 Zod (estrutura 2, limpa)

```ts
Contato = { tipo: enum[email,telefone,linkedin,github,portfolio,localizacao], valor: string, link: string|null }
Cabecalho = { nome: string, titulo_profissional: string, contatos: Contato[] }
Experiencia = { cargo, empresa, local: string|null, periodo: {inicio: YYYY-MM, fim: YYYY-MM|null, atual: bool}, descricao: string, realizacoes: string[], tecnologias: string[] }
Formacao = { curso, instituicao, local: string|null, periodo: {...}, descricao: string|null }
ResumeSchema = { cabecalho: Cabecalho, secoes: { resumo: string, experiencia: Experiencia[], formacao: Formacao[], habilidades: {nome, itens[]}[], certificacoes: {nome, emissor, ano, link?}[], idiomas: {idioma, nivel}[], projetos: {nome, descricao, link?, tecnologias[]}[] } }
TailorEnvelope = { resume: ResumeSchema, cargo: string, empresa: string, matchPercent: 0-100, strengths: string[3-8], weaknesses: string[3-8], emailBody: string, chatMessage: string }
```

Nota: o exemplo original colado tinha duas estruturas concatenadas e HTML escapado no fim de `educacao/competencias` — descartar a cauda corrompida; normalizar datas para `YYYY-MM`; `local: null` permitido.

## 4. Fluxos + UI

- **Sem base:** hero upload PDF → `uploadBase` (pdfjs extrai texto; se vazio → erro "PDF sem texto selecionável") → `BASE_EXTRACT` via chain → parse+Zod → 1x `REPAIR` se inválido → salva `BaseResume` → preview + libera dashboard. Botão "Re-enviar base" sempre visível depois.
- **Com base:** tabela (cargo | empresa | match% bar | status badge | data | Ver/Baixar/Retry/Copiar) orderBy createdAt desc, sem paginação. "Gerar outro currículo" → modal textarea jobText → `tailorResume`: (1) extrai cargo/empresa, (2) gera envelope, (3) `renderToFile(CVDocument)` → `public/generated/`, (4) salva `done`. Drawer da linha: download PDF, match bar, fortes/fracos, email/chat com Copiar, jobText colapsado, data geração.
- Filename: `sanitize(nome)_sanitize(cargo)_sanitize(empresa)_YYYYMMDD-HHmmss.pdf`, sanitize remove `\/|:*?"<>` e troca espaços por `_`.

## 5. LLM chain + prompts

`generateJson(system, user): {data, provider}` com timeout 60s cada, ordem Zen → Gemini → OpenRouter. Env: `OPENCODE_ZEN_API_KEY/MODEL (glm-4.6)`, `GEMINI_API_KEY/MODEL (gemini-2.5-flash)`, `OPENROUTER_API_KEY/MODEL (openai/gpt-oss-20b:free)`. `response_format=json_object` onde suportado. Log por tentativa; `errorLog` guarda os 3 erros.
- `BASE_EXTRACT`: texto CV → ResumeSchema, sem inventar, só JSON.
- `TAILOR(baseJson, jobText)`: reescreve resumo/realizacoes com keywords, preserva cargos/empresas/datas; retorna `TailorEnvelope` com match honesto 0-100, email + chat pt-BR.
- `REPAIR(jsonRuim, errosZod)`: corrige e retorna só JSON.
- Falha total: salva `failed` + toast + badge + `retryTailor(id)` re-executa chain sem duplicar linha.

## 6. PDF (fidelidade visual)

`CVDocument` com `StyleSheet.create` (não Tailwind no PDF): A4, padding ~56pt, Helvetica 10pt/1.4 #000; header centrado nome 20-22pt bold, contatos 9pt #0056b3 underline; cargo 14pt bold + subtítulo itálico + resumo justify; seções 14pt bold; habilidades 2 col flex; experiência row space-between (título 11pt bold / período), org+local itálico, descrição justify, atividades bullets, `Competências:` bold; sem fundos/bordas; `wrap={false}` por bloco de cargo.

## 7. Erros + testes

Erros: PDF sem texto, Zod inválido (repair 1x), timeout por provider (avança), falha total (failed+retry), render PDF fail (failed+log). Avisos via toast + badge na tabela.
Testes (vitest): schema aceita/rejeita; `sanitizeFilename`; chain order/fallback com mocks; smoke `renderToBuffer(CVDocument)`.

## 8. Fora do MVP

Auth/multi-user, deploy serverless, OCR de PDF escaneado, edição manual JSON, paginação/busca, fila automática/cron, i18n.

## 9. Scaffolding

`app/page.tsx`, `app/actions.ts`, `lib/resume-schema.ts`, `lib/llm/*`, `lib/pdf/CVDocument.tsx`, `lib/filename.ts`, `prisma/schema.prisma`, `.env.example`, `public/generated/.gitkeep`. `npm run dev` local.
