export type BaseLang = "pt-BR" | "en" | "es";

export function parseBaseLang(v: unknown): BaseLang {
  return v === "en" || v === "es" || v === "pt-BR" ? v : "pt-BR";
}

const BASE_EXTRACT_CORE = `Converta o texto do currículo para o ResumeSchema v2 (cabecalho{nome,titulo_profissional,contatos[]} + secoes{resumo,experiencia[],formacao[],habilidades[],certificacoes[],idiomas[],projetos[]}). Não invente dados. Use TODAS as informações do texto original: inclua todas as experiências, formações, habilidades, certificações, idiomas e projetos encontrados, sem resumir nem omitir itens; preserve detalhes, números e resultados. Para cada experiência use exatamente {cargo, empresa, local, periodo, descricao, realizacoes[], tecnologias[]}: descricao = parágrafo(s) introdutório(s) com texto integral; realizacoes = UMA string por bullet de "Principais atividades"/"Atividades", com texto integral sem resumir (nunca deixe vazio se o original lista atividades); tecnologias = TODOS os itens da linha "Competências"/"Skills", um por string. Normalize periodo.inicio/fim para YYYY-MM (ex. "Ago 2025"→"2025-08"); se "atual", fim=null e atual=true. O local de cada experiência/formação deve evidenciar cidade, estado e país mais o modo de trabalho quando indicado, no formato "Cidade, UF, País (Remoto|Presencial|Híbrido)" — ex. "São Paulo, SP, Brasil (Remoto)". Cada contato tem {tipo, valor, link}; tipo DEVE ser exatamente um destes valores minúsculos, sem acento: email, telefone, linkedin, github, portfolio, localizacao (ex. use "email" e nunca "E-mail"). Habilidades DEVE ser [{"nome": "Front-end", "itens": ["React", "Next.js"]}] — use exatamente as chaves "nome" e "itens". Retorne SOMENTE JSON.`;

const LANG_DIRECTIVE: Record<BaseLang, string> = {
  "pt-BR": `Escreva TODOS os campos de texto livre (resumo, descricao, realizacoes, descrições de formação e projetos) em Português do Brasil. Traduza cargo e local (cidade, estado, país, modo de trabalho) para Português do Brasil. Mantenha nomes de empresas, tecnologias e as datas em YYYY-MM.`,
  en: `Write ALL free-text fields (resumo, descricao, realizacoes, formacao and projeto descriptions) in English. Translate cargo (job title) and local (city, state, country, work mode — e.g. Brasil→Brazil, Remoto→Remote) to English. Keep company names (empresa), technology terms and YYYY-MM dates unchanged.`,
  es: `Escribe TODOS los campos de texto libre (resumo, descricao, realizacoes, descripciones de formación y proyectos) en Español. Traduce el cargo (puesto) y el local (ciudad, estado, país, modo de trabajo) al Español. Mantén nombres de empresas, tecnologías y las fechas en YYYY-MM.`,
};

export function buildBaseExtractSystem(lang: BaseLang): string {
  return `${BASE_EXTRACT_CORE} ${LANG_DIRECTIVE[lang]}`;
}

export const BASE_EXTRACT_SYSTEM = buildBaseExtractSystem("pt-BR");

export const TAILOR_SYSTEM = buildTailorSystem("pt-BR");

export function buildTailorSystem(lang: BaseLang): string {
  const outLang =
    lang === "en" ? "English" : lang === "es" ? "Español" : "Português do Brasil";
  return `Dado baseJson (ResumeSchema) + jobText, reescreva resumo e realizacoes priorizando keywords da vaga, sem inventar empresas/locais/datas. Traduza cargo e local para ${outLang} (nomes de empresas permanecem inalterados). Mantenha TODOS os textos do resume em ${outLang} e escreva emailBody e chatMessage em ${outLang}. Retorne SOMENTE o envelope {resume,cargo,empresa,matchPercent(0-100 honesto),strengths[3-8],weaknesses[3-8],emailBody(${outLang}),chatMessage(${outLang})}. Se cargo/empresa ausentes na vaga use "Vaga"/"Empresa".`;
}

export const buildTailorUser = (baseJson: string, jobText: string) => `baseJson:\n${baseJson}\n\njobText:\n${jobText}`;

export const buildRepairUser = (badJson: string, errors: string) =>
  `Corrija este JSON conforme os erros Zod e retorne SOMENTE JSON válido:\n${badJson}\n\nErros:\n${errors}`;
