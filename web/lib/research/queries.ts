// web/lib/research/queries.ts
// Plano de queries de descoberta (spec §5, F1). Nome da empresa SEMPRE entre
// aspas duplas para reduzir ruído. dossiês en/es rodam as queries em PT
// primeiro e acrescentam (não substituem) até 6 queries no idioma do dossiê.
import { type DossierSection } from "@/lib/dossier-schema";
import type { BaseLang } from "@/lib/llm/prompts";

export type QueryItem = { section: DossierSection; query: string };

export function buildQueryPlan(company: string, lang: BaseLang): QueryItem[] {
  const q = `"${company}"`;
  const plan: QueryItem[] = [
    // base — nome oficial/contato alimenta a prioridade de site oficial; a
    // segunda query prende o bloco "sobre nós" na seção história.
    { section: "contatos", query: `${q} site oficial contato` },
    { section: "historia", query: `${q} sobre nós história fundada` },
    { section: "historia", query: `${q} missão visão valores` },
    { section: "historia", query: `${q} "fundada em" história` },
    { section: "lideranca", query: `${q} CEO fundador presidente proprietário` },
    { section: "lideranca", query: `${q} "diretor" OR "CEO" entrevista` },
    { section: "produtos", query: `${q} produtos serviços clientes` },
    { section: "produtos", query: `${q} reclamação OR avaliação cliente` },
    { section: "reputacao", query: `${q} glassdoor avaliações` },
    { section: "reputacao", query: `${q} jusbrasil processo` },
    { section: "reputacao", query: `${q} reclamação funcionário` },
    { section: "reputacao", query: `${q} "corte de pessoal" OR demissão` },
    { section: "contatos", query: `site:linkedin.com/in ${q}` },
    { section: "contatos", query: `${q} recruiter OR "talent acquisition"` },
    { section: "contatos", query: `${q} "head of" OR "gerente" OR "coordenador"` },
    { section: "contatos", query: `${q} rh OR "recursos humanos" contato` },
    { section: "redes", query: `${q} instagram` },
    { section: "redes", query: `${q} youtube` },
    { section: "redes", query: `${q} github` },
    { section: "redes", query: `${q} twitter OR x.com` },
    { section: "cnpj", query: `${q} cnpj` },
  ];

  if (lang === "en" || lang === "es") {
    const extra: QueryItem[] =
      lang === "en"
        ? [
            { section: "contatos", query: `${q} company official site contact` },
            { section: "historia", query: `${q} company about history founded` },
            { section: "lideranca", query: `${q} CEO founder owner director` },
            { section: "reputacao", query: `${q} employee reviews glassdoor` },
            { section: "contatos", query: `${q} recruiter "talent acquisition"` },
            { section: "produtos", query: `${q} products services customers` },
          ]
        : [
            { section: "contatos", query: `${q} empresa sitio oficial contacto` },
            { section: "historia", query: `${q} sobre historia fundada empresa` },
            { section: "lideranca", query: `${q} CEO fundador dueño director` },
            { section: "reputacao", query: `${q} reseñas empleados glassdoor` },
            { section: "contatos", query: `${q} reclutador "talent acquisition"` },
            { section: "produtos", query: `${q} productos servicios clientes` },
          ];
    plan.push(...extra);
  }

  return plan;
}
