// web/lib/vacancy-chat.ts
// Chat de consulta sobre UMA vaga: a IA responde usando o contexto salvo
// (análise de afinidade, currículo gerado e texto original da vaga).
// O histórico vive só na memória do componente — nada é persistido.
import { generateText } from "./llm/chain";
import { getLocale, type UiLocale } from "./i18n/locale";
import { loadSettings, type StoredApp } from "./store";

export type ChatTurn = { role: "user" | "assistant"; content: string };

const SYSTEM: Record<UiLocale, string> = {
  "pt-BR": `Você é um consultor de carreira que responde perguntas sobre UMA vaga específica.
Responda SEMPRE em Português do Brasil, mesmo que o contexto esteja em outro idioma (cite o termo original entre parênteses quando for útil).
Use exclusivamente o CONTEXTO fornecido (análise de compatibilidade, currículo gerado, email, mensagem e texto original da vaga). Não invente fatos, números ou experiências que não estejam no contexto: se a resposta não estiver lá, diga que não está no contexto.
Seja direto e prático: de 2 a 6 frases, ou uma lista curta de itens. Nunca responda em JSON e não use cabeçalhos markdown.`,
  "en-US": `You are a career consultant answering questions about ONE specific job vacancy.
Always answer in English, even if the context is written in another language (quote the original term in parentheses when useful).
Use ONLY the provided CONTEXT (match analysis, tailored resume, email, message and the original job text). Never invent facts, numbers or experiences that are not in the context: if the answer is not there, say so.
Be direct and practical: 2 to 6 sentences, or a short bullet list. Never answer with JSON and do not use markdown headings.`,
  "es-ES": `Eres un consultor de empleo que responde preguntas sobre UNA vacante concreta.
Responde SIEMPRE en Español, aunque el contexto esté en otro idioma (entrecomilla el término original entre paréntesis cuando sea útil).
Usa EXCLUSIVAMENTE el CONTEXTO proporcionado (análisis de afinidad, currículum generado, email, mensaje y texto original de la vacante). No inventes datos, cifras ni experiencias que no estén en el contexto: si la respuesta no está ahí, dilo.
Sé directo y práctico: de 2 a 6 frases, o una lista corta. Nunca respondas con JSON ni uses encabezados markdown.`,
};

export function buildVacancyChatSystem(locale: UiLocale = getLocale()): string {
  return SYSTEM[locale] ?? SYSTEM["pt-BR"];
}

/** Contexto da vaga em formato neutro (chaves em inglês) para o modelo ler. */
export function buildVacancyChatContext(app: StoredApp): string {
  return [
    `role: ${app.cargo}`,
    `company: ${app.empresa}`,
    `match_percent: ${app.matchPercent}`,
    `strengths: ${app.strengths.join(" | ")}`,
    `weaknesses: ${app.weaknesses.join(" | ")}`,
    `job_url: ${app.jobUrl || "-"}`,
    "job_text:",
    app.jobText,
    "tailored_resume:",
    JSON.stringify(app.resume),
    "email:",
    app.emailBody,
    "message:",
    app.chatMessage,
  ].join("\n");
}

export function buildVacancyChatUser(app: StoredApp, question: string, history: ChatTurn[] = []): string {
  const turns = history.map((h) => `${h.role === "user" ? "user" : "assistant"}: ${h.content}`).join("\n");
  return [`CONTEXT:`, buildVacancyChatContext(app), turns ? `CONVERSATION SO FAR:\n${turns}` : "", `QUESTION: ${question}`].filter(Boolean).join("\n\n");
}

export async function askVacancy(app: StoredApp, question: string, history: ChatTurn[] = [], locale: UiLocale = getLocale()): Promise<string> {
  const settings = loadSettings();
  const { text } = await generateText(buildVacancyChatSystem(locale), buildVacancyChatUser(app, question, history), settings.geminiKey, settings.models, locale);
  return text;
}
