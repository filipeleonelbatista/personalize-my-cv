export const BASE_EXTRACT_SYSTEM = `Converta o texto do currículo para o ResumeSchema v2 (cabecalho{nome,titulo_profissional,contatos[]} + secoes{resumo,experiencia[],formacao[],habilidades[],certificacoes[],idiomas[],projetos[]}). Não invente dados. Normalize periodo.inicio/fim para YYYY-MM (ex. "Ago 2025"→"2025-08"); se "atual", fim=null e atual=true. Retorne SOMENTE JSON.`;

export const TAILOR_SYSTEM = `Dado baseJson (ResumeSchema) + jobText, reescreva resumo e realizacoes priorizando keywords da vaga, sem inventar cargos/empresas/datas. Retorne SOMENTE o envelope {resume,cargo,empresa,matchPercent(0-100 honesto),strengths[3-8],weaknesses[3-8],emailBody(pt-BR),chatMessage(pt-BR)}. Se cargo/empresa ausentes na vaga use "Vaga"/"Empresa".`;

export const buildTailorUser = (baseJson: string, jobText: string) => `baseJson:\n${baseJson}\n\njobText:\n${jobText}`;

export const buildRepairUser = (badJson: string, errors: string) =>
  `Corrija este JSON conforme os erros Zod e retorne SOMENTE JSON válido:\n${badJson}\n\nErros:\n${errors}`;
