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
2. Clique em **Personalizar com IA**, escolha o idioma, cole o texto da vaga e
   (opcionalmente) a **URL da vaga** → gera:
   - PDF para download (gerado no navegador, na hora)
   - % de afinidade + pontos fortes/fracos
   - email de apresentação + mensagem instantânea (botões Copiar)
3. A tabela lista tudo com data de geração, download e retry.
4. Abra uma candidatura e escolha **Montar dossiê** para preparar a entrevista:
   pesquise automaticamente com Tavily, informe URLs ou cole material; depois,
   analise a vaga para gerar pontos de atenção, correlações e um plano de abordagem.
   O dossiê pode ficar parcial quando um site bloqueia a leitura e é exportado em
   Markdown (não há PDF do dossiê).
5. Ao abrir uma vaga, use **Abrir vaga** para voltar ao link do anúncio e
   **Conversar com a vaga** para perguntar à IA sobre aquela vaga (análise,
   currículo gerado e texto original). O chat é só de consulta: o histórico
   fica na memória da tela e some ao fechar.

## Dossiê de empresa

O dossiê combina informações públicas da empresa com uma análise específica da
candidatura e do currículo. As fontes podem ser pesquisa automática, URLs
informadas por você ou material colado. A pesquisa automática usa Tavily e a
leitura de páginas usa Jina; consultas de CNPJ, YouTube e GitHub usam BrasilAPI,
YouTube Data API e GitHub API quando aplicável. Essas chamadas saem diretamente
do navegador; não há servidor do Personalize My CV. As chaves de pesquisa
devem ser configuradas no ambiente de build; todas são obrigatórias, inclusive
nos modos de URL e material colado. Brave segue bloqueado por CORS, mas sua
variável também é exigida para habilitar o dossiê.

| Variável | Uso |
|---|---|
| `NEXT_PUBLIC_IS_DOSSIE_ENABLED` | Deve ser exatamente `true` |
| `NEXT_PUBLIC_TAVILY_API_KEY` | Busca automática |
| `NEXT_PUBLIC_BRAVE_API_KEY` | Exigida para habilitar; integração Brave continua desativada por CORS |
| `NEXT_PUBLIC_JINA_API_KEY` | Leitura de URLs |
| `NEXT_PUBLIC_YOUTUBE_API_KEY` | Credencial da API do YouTube |
| `NEXT_PUBLIC_GITHUB_TOKEN` | Credencial da API do GitHub |

Use `.env.example` como referência para `.env.local` ou defina as variáveis no
provedor de build/deploy. Como o app é um site estático, todas as variáveis
`NEXT_PUBLIC_*` são embutidas no JavaScript e visíveis a qualquer visitante.
Use somente credenciais com cotas e permissões apropriadas; para manter chaves
secretas seria necessário migrar as chamadas para um backend. A chave Gemini
continua sendo configurada pelo usuário em Configurações. Cotas e custos dos
provedores se aplicam.

O resultado pode ser parcial se fontes bloquearem a leitura. Confira as fontes,
datas e evidências antes de usar as informações em uma entrevista. É possível
exportar o dossiê como arquivo Markdown; exportação em PDF não está disponível.

## Backup import/export

A base e as vagas ficam nas chaves `pmcv:base` e `pmcv:apps` do
`localStorage`. Use `exportBackup()` (em `lib/store.ts`) para gerar um JSON
com tudo e `importBackup(json)` para restaurar — útil para trocar de
navegador ou limpar espaço.

## Assets visuais (para criar/substituir)

| Arquivo | Tamanho | Uso |
|---|---|---|
| `public/favicon.ico` | 48px | Fallback navegadores antigos (opcional; o SVG já cobre os modernos) |
| `public/opengraph-image.png` | 1200×630, <300KB | Banner de compartilhamento (placeholder gerado via `npm run icons`; substitua pelo banner desenhado) |
| `public/icon-192.png` / `public/icon-512.png` | 192 / 512 | PWA + favicon (gerados de `app/icon.svg` via `npm run icons`) |
| `public/maskable-512.png` | 512 com safe-zone | Ícone maskable Android |
| `public/apple-touch-icon.png` | 180 | iOS home screen |

Regenerar: `npm run icons` (usa sharp). Para SEO completo, adicione
`metadataBase` + canonical no `layout.tsx` quando o domínio final existir.

## Aviso de segurança

A chave Gemini fica guardada via `secure-ls` (ofuscação com AES + chave
embarcada no bundle). Isso **não** é um cofre seguro: qualquer pessoa com
acesso ao navegador consegue extrair a chave. Use uma chave com limites de
uso/cota e revogue se necessário. As chaves opcionais dos provedores de pesquisa
`NEXT_PUBLIC_*` são incluídas sem ofuscação no bundle estático e podem ser lidas
por qualquer visitante; configure apenas credenciais com cotas e permissões
apropriadas.

O dossiê pode conter dados pessoais públicos de terceiros, como nomes e cargos.
Ele fica no `localStorage` do navegador e não é publicado nem compartilhado pelo
app, mas seu conteúdo é enviado à API Gemini para estruturação. URLs públicas
pesquisadas também são consultadas pelos provedores descritos na política de
privacidade.

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

> Regras de trabalho neste projeto: ver [`AGENTS.md`](./AGENTS.md). Visão geral dos dois projetos: [`PROJECT.md`](../PROJECT.md).

## Licença

AGPL-3.0-only — ver [`LICENSE`](../LICENSE).
