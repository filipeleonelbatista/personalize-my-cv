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
  const missing = lang === "en" ? `"Position"/"Company"` : lang === "es" ? `"Puesto"/"Empresa"` : `"Vaga"/"Empresa"`;
  return `Dado baseJson (ResumeSchema) + jobText, reescreva resumo e realizacoes priorizando keywords da vaga, sem inventar empresas/locais/datas. Traduza cargo e local para ${outLang} (nomes de empresas permanecem inalterados). Mantenha TODOS os textos do resume em ${outLang} e escreva emailBody e chatMessage em ${outLang}. O campo resume é obrigatório: inclua o ResumeSchema completo adaptado, nunca o omita. Retorne SOMENTE o envelope {resume,cargo,empresa,matchPercent(0-100 honesto),strengths[3-8],weaknesses[3-8],emailBody(${outLang}),chatMessage(${outLang})}. Se cargo/empresa ausentes na vaga use ${missing}.`;
}

export const buildTailorUser = (baseJson: string, jobText: string) => `baseJson:\n${baseJson}\n\njobText:\n${jobText}`;

export const buildRepairUser = (badJson: string, errors: string) =>
  `Corrija este JSON conforme os erros Zod e retorne SOMENTE JSON válido:\n${badJson}\n\nErros:\n${errors}`;

export function buildDossierSystem(lang: BaseLang): string {
  const outLang = lang === "en" ? "English" : lang === "es" ? "Español" : "Português do Brasil";
  return `Você é um analista de empresas. Receba um CORPUS de documentos (cada um com título, URL e data de publicação). Produza JSON com {history{founded,timeline[{year,event}],mission,vision,values[],summary},leadership{ceo{name,role,bio,highlights[{claim,sourceUrl,sourceTitle,date,quote}]}},products[{name,description,customerSignal,evidence[{claim,sourceUrl,sourceTitle,date,quote}]}],reputation{reviews[{source,sentiment,topic,date,quote,sourceUrl}],redFlags[{severity,category,title,detail,date,evidence[{claim,sourceUrl,sourceTitle,date,quote}],mitigation}]},contacts[{name,role,kind,channel,url,hint,confidence}],socials[{network,handle,url,tone,posts[{date,text,url}]}]}. REGRAS: (1) use SOMENTE o corpus; toda afirmação factual precisa de sourceUrl presente no corpus; (2) a data da evidência é a data do documento; se não houver data, use null — NUNCA invente data; (3) não preencha com conhecimento geral do modelo: sem evidência, o campo fica vazio ou null; (4) separe fato da empresa (history, leadership) de reclamação de cliente (products.customerSignal, reputation); (5) redFlags só com evidência; severity reflete o impacto na decisão (processo trabalhista recorrente/cultural = high; caso isolado = low); (6) contacts: até 8, com kind correto, url quando houver, hint explicando por que abordar a pessoa e confidence refletindo a força da evidência; (7) socials: uma entrada por rede encontrada, posts com no máximo 5 e a data real de cada post, tone em 1-2 frases; (8) máximo 3 products, máximo 10 timeline, máximo 10 values, máximo 10 highlights, máximo 20 reviews, máximo 12 redFlags, máximo 8 contacts, máximo 8 socials. Literais permitidos: severity=high|medium|low; kind=rh|gestor|dpo|recrutador|executivo|other; sentiment=pro|contra|neutro; network=linkedin|instagram|youtube|x|facebook|github|tiktok|other; channel=linkedin|email|telefone|site|other; source=glassdoor|linkedin|jusbrasil|reclameaqui|indeed|reddit|other; category=processo_trabalhista|cultura|financeiro|produto|reputacao|outro; confidence=high|medium|low. Escreva todos os textos livres em ${outLang}. Retorne SOMENTE JSON.`;
}

export const buildDossierUser = (corpus: string) => `corpus:\n${corpus}`;

export function buildMatchSystem(lang: BaseLang): string {
  const outLang = lang === "en" ? "English" : lang === "es" ? "Español" : "Português do Brasil";
  return `Receba um DOSSIÊ (JSON da empresa) + a VAGA (texto) + o RESUME (currículo tailored do candidato para aquela vaga). Produza JSON com {alignment{score 0-100, verdict=vai|cautela|desistir, dimensions[{key=cultura|produto|processo|gestao|setor|cargo,score 0-100,note}]},attentionPoints[],correlations[{theme,theirs,mine}],gaps[],questions[{question,why,sourceUrl}],outreach[{target,role,goal=rh|gestor|indicacao|cargo,channel=linkedin|email|telefone|site|other,angle,message,sourceUrl}],redFlagSummary[],sources[]}. REGRAS: (1) alignment.score é honesto, ancorado nas dimensões — não é porcentagem de palavras em comum; (2) correlations só cita skills/experiências que estão no RESUME; (3) questions: 5 a 8 perguntas, cada uma com why e sourceUrl quando derivar de uma evidência do dossiê; (4) outreach: 3 a 5 ações de contorno de ATS, cada uma com message PRONTA PARA COPIAR no tom do canal (LinkedIn ≠ e-mail), usando apenas fatos do dossiê e do RESUME; (5) redFlagSummary lista as red flags para as quais preparar objeção. Escreva todos os textos em ${outLang}. Retorne SOMENTE JSON.`;
}

export const buildMatchUser = (payload: string) => `payload:\n${payload}`;
