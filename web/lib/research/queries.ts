// web/lib/research/queries.ts
// Plano de queries de descoberta (spec §5, F1). Nome da empresa SEMPRE entre
// aspas duplas para reduzir ruído. Dossiês en/es rodam as queries em PT
// primeiro e acrescentam (não substituem) até 6 queries no idioma do dossiê;
// a variante é fallback para seção que ficou vazia — o collector decide.
import { type DossierSection } from "@/lib/dossier-schema";
import type { BaseLang } from "@/lib/llm/prompts";

export type QueryItem = {
  section: DossierSection;
  query: string;
  /** Presente apenas nas variantes de idioma (en/es) — o collector só as roda quando a seção PT ficou vazia. */
  lang?: BaseLang;
  /** true nas 2 queries "base": não consomem a cota da seção — alimentam apenas o passe de site oficial. */
  base?: boolean;
};

export function buildQueryPlan(company: string, lang: BaseLang): QueryItem[] {
  const q = `"${company}"`;
  const plan: QueryItem[] = [
    // base — nome oficial/contato alimenta a prioridade de site oficial; a
    // segunda query prende o bloco "sobre nós" fora das cotas de seção.
    { section: "contatos", query: `${q} site oficial contato`, base: true },
    { section: "historia", query: `${q} sobre nós história fundada`, base: true },
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
            { section: "contatos", query: `${q} company official site contact`, lang },
            { section: "historia", query: `${q} company about history founded`, lang },
            { section: "lideranca", query: `${q} CEO founder owner director`, lang },
            { section: "reputacao", query: `${q} employee reviews glassdoor`, lang },
            { section: "contatos", query: `${q} recruiter "talent acquisition"`, lang },
            { section: "produtos", query: `${q} products services customers`, lang },
          ]
        : [
            { section: "contatos", query: `${q} empresa sitio oficial contacto`, lang },
            { section: "historia", query: `${q} sobre historia fundada empresa`, lang },
            { section: "lideranca", query: `${q} CEO fundador dueño director`, lang },
            { section: "reputacao", query: `${q} reseñas empleados glassdoor`, lang },
            { section: "contatos", query: `${q} reclutador "talent acquisition"`, lang },
            { section: "produtos", query: `${q} productos servicios clientes`, lang },
          ];
    plan.push(...extra);
  }

  return plan;
}
