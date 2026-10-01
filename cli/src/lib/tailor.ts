import { ResumeSchema, TailorEnvelopeSchema, type Resume, type TailorEnvelope } from "./schemas.js";
import { MISSING_JOB, type PdfLang } from "./pdf-labels.js";
import { loadApps, loadBase, loadConfig, saveApps, type StoredApp } from "./store.js";
import { generateJson } from "./chain.js";
import { t, type UiLocale } from "./i18n.js";
import { buildRepairUser, buildTailorSystem, buildTailorUser, type BaseLang } from "./prompts.js";
import { buildFailedFileName, buildFileName } from "./filename.js";

const TIPO_MAP: Record<string, string> = {
  email: "email", "e-mail": "email", "e mail": "email", mail: "email",
  telefone: "telefone", tel: "telefone", fone: "telefone", phone: "telefone",
  celular: "telefone", whatsapp: "telefone", mobile: "telefone",
  linkedin: "linkedin",
  github: "github",
  portfolio: "portfolio", "portfólio": "portfolio", site: "portfolio", website: "portfolio",
  localizacao: "localizacao", "localização": "localizacao", local: "localizacao",
  endereco: "localizacao", "endereço": "localizacao", cidade: "localizacao",
  location: "localizacao", address: "localizacao",
};

export function mapContatoTipo(v: unknown): string | null {
  if (typeof v !== "string") return null;
  return TIPO_MAP[v.trim().toLowerCase()] ?? null;
}

function normalizeContatos(root: Record<string, unknown>): void {
  const resume = (root.resume ?? root) as { cabecalho?: { contatos?: unknown } };
  const contatos = resume?.cabecalho?.contatos;
  if (!Array.isArray(contatos)) return;
  resume.cabecalho!.contatos = contatos
    .map((c) =>
      typeof c === "object" && c !== null
        ? { ...(c as Record<string, unknown>), tipo: mapContatoTipo((c as { tipo?: unknown }).tipo) }
        : c,
    )
    .filter((c) => typeof c === "object" && c !== null && (c as { tipo?: unknown }).tipo !== null);
}

function deepCopy(data: unknown): Record<string, unknown> {
  return JSON.parse(JSON.stringify(data)) as Record<string, unknown>;
}

const ITENS_KEYS = ["itens", "items", "skills", "tecnologias", "conhecimentos", "lista"];
const NOME_KEYS = ["nome", "name", "grupo", "categoria", "category", "titulo", "title", "area"];

function pick(obj: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null) return obj[k];
  }
  return undefined;
}

function toStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof v === "string") return v.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
  return [];
}

function normalizeGrupo(g: unknown): { nome: string; itens: string[] } {
  if (typeof g === "string") {
    const itens = toStringArray(g);
    return { nome: itens.length > 1 ? "Habilidades" : g.trim().slice(0, 60), itens };
  }
  if (typeof g === "object" && g !== null) {
    const obj = g as Record<string, unknown>;
    return { nome: String(pick(obj, NOME_KEYS) ?? "Habilidades"), itens: toStringArray(pick(obj, ITENS_KEYS)) };
  }
  return { nome: "Habilidades", itens: [] };
}

function normalizeHabilidades(root: Record<string, unknown>): void {
  const secoes = (root.resume ?? root) as { secoes?: { habilidades?: unknown } };
  const habs = secoes?.secoes?.habilidades;
  if (!Array.isArray(habs)) return;
  secoes.secoes!.habilidades = habs.map(normalizeGrupo);
}

const MESES_BR: Record<string, string> = {
  jan: "01", fev: "02", mar: "03", abr: "04", mai: "05", jun: "06",
  jul: "07", ago: "08", set: "09", out: "10", nov: "11", dez: "12",
};

function parseMesAnoBr(s: string): string | null {
  const trimmed = s.trim().toLowerCase();
  if (/^(atual|presente|present|atualmente|hoje|o momento)$/.test(trimmed)) return null;
  let m = trimmed.match(/^(\d{4})-(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}`;
  m = trimmed.match(/^(\d{2})\/(\d{4})$/);
  if (m) return `${m[2]}-${m[1]}`;
  m = trimmed.match(/^([a-zç]{3,9})\.?\s+(\d{4})$/);
  if (m && MESES_BR[m[1].slice(0, 3)]) return `${m[2]}-${MESES_BR[m[1].slice(0, 3)]}`;
  return null;
}

function normalizePeriodo(v: unknown): unknown {
  if (typeof v !== "string") return v;
  const parts = v.split(/\s*[–—-]\s*/).filter(Boolean);
  if (!parts.length) return v;
  const ini = parseMesAnoBr(parts[0]);
  if (!ini) return v;
  if (parts.length === 1) return { inicio: ini, fim: null, atual: false };
  const fim = parseMesAnoBr(parts[1]);
  if (fim) return { inicio: ini, fim, atual: false };
  if (parts[1].trim()) return { inicio: ini, fim: null, atual: true };
  return v;
}

const EXP_KEYS: Record<string, string[]> = {
  cargo: ["cargo", "role", "titulo", "title", "position", "funcao", "função"],
  empresa: ["empresa", "company", "organizacao", "organização", "organization", "empregador"],
  local: ["local", "location", "cidade", "city", "lugar", "place"],
  periodo: ["periodo", "period", "datas", "data", "duration", "quando"],
  descricao: ["descricao", "description", "contexto", "context", "sobre", "about", "summary"],
  realizacoes: ["realizacoes", "atividades", "activities", "responsabilidades", "responsibilities", "tarefas", "tasks"],
  tecnologias: ["tecnologias", "competencias", "competências", "competencies", "stack", "technologies", "skills", "ferramentas"],
};

function pickKey(o: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    if (o[k] !== undefined && o[k] !== null) return o[k];
  }
  return undefined;
}

function normalizeExperienciaJob(e: unknown): unknown {
  if (typeof e !== "object" || e === null) return e;
  const o = e as Record<string, unknown>;
  const desc = pickKey(o, EXP_KEYS.descricao) ?? o.descricao;
  return {
    ...o,
    cargo: pickKey(o, EXP_KEYS.cargo) ?? o.cargo,
    empresa: pickKey(o, EXP_KEYS.empresa) ?? o.empresa,
    local: pickKey(o, EXP_KEYS.local) ?? o.local ?? null,
    periodo: normalizePeriodo(pickKey(o, EXP_KEYS.periodo) ?? o.periodo),
    descricao: typeof desc === "string" ? desc : "",
    realizacoes: toStringArray(pickKey(o, EXP_KEYS.realizacoes) ?? o.realizacoes),
    tecnologias: toStringArray(pickKey(o, EXP_KEYS.tecnologias) ?? o.tecnologias),
  };
}

function normalizeExperiencias(root: Record<string, unknown>): void {
  const secoes = (root.resume ?? root) as { secoes?: { experiencia?: unknown } };
  const exps = secoes?.secoes?.experiencia;
  if (!Array.isArray(exps)) return;
  secoes.secoes!.experiencia = exps.map(normalizeExperienciaJob);
}

export function normalizeResume(data: unknown): Resume {
  if (typeof data !== "object" || data === null) throw new Error("Currículo da IA inválido.");
  const copy = deepCopy(data);
  normalizeContatos(copy);
  normalizeHabilidades(copy);
  normalizeExperiencias(copy);
  return ResumeSchema.parse(copy);
}

function defaulted(v: unknown, fallback: string): string {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

export function normalizeEnvelope(data: unknown, lang: PdfLang = "pt-BR", fallbackResume?: Resume): TailorEnvelope {
  if (typeof data !== "object" || data === null) throw new Error("Envelope da IA inválido.");
  const copy = deepCopy(data);
  const r = (copy as Record<string, unknown>).resume;
  if (fallbackResume && (r === undefined || r === null || typeof r !== "object" || Array.isArray(r))) {
    (copy as Record<string, unknown>).resume = JSON.parse(JSON.stringify(fallbackResume));
  }
  normalizeContatos(copy);
  normalizeHabilidades(copy);
  normalizeExperiencias(copy);
  const missing = MISSING_JOB[lang] ?? MISSING_JOB["pt-BR"];
  return TailorEnvelopeSchema.parse({
    ...copy,
    cargo: defaulted(copy.cargo, missing.cargo),
    empresa: defaulted(copy.empresa, missing.empresa),
  });
}

export type { BaseLang } from "./prompts.js";

export type TailorResult = { ok: true; app: StoredApp } | { ok: false; error: string; app: StoredApp };

let fallbackSeq = 0;
export function newId(): string {
  try {
    const c = globalThis.crypto as Crypto | undefined;
    if (c && typeof c.randomUUID === "function") return c.randomUUID();
    if (c && typeof c.getRandomValues === "function") {
      const b = c.getRandomValues(new Uint8Array(16));
      b[6] = (b[6] & 0x0f) | 0x40;
      b[8] = (b[8] & 0x3f) | 0x80;
      const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
      return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
    }
  } catch {}
  fallbackSeq += 1;
  return `pmcv-${Date.now().toString(36)}-${fallbackSeq.toString(36)}-${Math.floor(Math.random() * 0xffffffff).toString(36)}`;
}

async function generateEnvelope(jobText: string, lang: BaseLang, locale: UiLocale): Promise<TailorEnvelope> {
  const base = loadBase();
  if (!base) throw new Error(t(locale, "Errors.noBase"));
  const settings = loadConfig();
  const system = buildTailorSystem(lang);
  const { data } = await generateJson(system, buildTailorUser(JSON.stringify(base.resume), jobText), settings.geminiKey, settings.models, locale);
  try {
    return normalizeEnvelope(data, lang, base.resume);
  } catch (zerr) {
    const { data: fixed } = await generateJson(system, buildRepairUser(JSON.stringify(data), String(zerr)), settings.geminiKey, settings.models, locale);
    return normalizeEnvelope(fixed, lang, base.resume);
  }
}

function failedApp(jobText: string, lang: BaseLang, msg: string): StoredApp {
  const base = loadBase()!;
  const missing = MISSING_JOB[lang] ?? MISSING_JOB["pt-BR"];
  return {
    resume: base.resume,
    cargo: missing.cargo,
    empresa: missing.empresa,
    matchPercent: 0,
    strengths: ["—"],
    weaknesses: ["—"],
    emailBody: "—",
    chatMessage: "—",
    id: newId(),
    jobText,
    fileName: buildFailedFileName(),
    status: "failed",
    errorLog: msg,
    lang,
    createdAt: new Date().toISOString(),
  };
}

export async function runTailorJob(jobText: string, lang: BaseLang, locale: UiLocale = "pt-BR"): Promise<TailorResult> {
  if (!jobText || jobText.trim().length < 20) {
    throw new Error(t(locale, "Errors.jobShort"));
  }
  try {
    const env = await generateEnvelope(jobText, lang, locale);
    const app: StoredApp = {
      ...env,
      id: newId(),
      jobText,
      fileName: buildFileName(env.resume.cabecalho.nome, env.cargo, env.empresa),
      status: "done",
      errorLog: "",
      lang,
      createdAt: new Date().toISOString(),
    };
    saveApps([app, ...loadApps()]);
    return { ok: true, app };
  } catch (e) {
    if (!loadBase()) throw e;
    const msg = ((e instanceof Error ? e.message : String(e)) || t(locale, "Errors.unknownFail")).slice(0, 1000);
    const app = failedApp(jobText, lang, msg);
    saveApps([app, ...loadApps()]);
    return { ok: false, error: t(locale, "Errors.tailFail", { msg }), app };
  }
}

export async function retryStoredApp(id: string, locale: UiLocale = "pt-BR"): Promise<{ ok: true; app: StoredApp } | { ok: false; error: string }> {
  const current = loadApps().find((a) => a.id === id);
  if (!current) return { ok: false, error: t(locale, "Errors.notFound") };
  try {
    const env = await generateEnvelope(current.jobText, current.lang, locale);
    const app: StoredApp = {
      ...env,
      id: newId(),
      jobText: current.jobText,
      fileName: buildFileName(env.resume.cabecalho.nome, env.cargo, env.empresa),
      status: "done",
      errorLog: "",
      lang: current.lang,
      createdAt: new Date().toISOString(),
    };
    saveApps([app, ...loadApps().filter((a) => a.id !== id)]);
    return { ok: true, app };
  } catch (e) {
    const msg = ((e instanceof Error ? e.message : String(e)) || t(locale, "Errors.unknownFail")).slice(0, 1000);
    saveApps(loadApps().map((a) => (a.id === id ? { ...a, status: "failed" as const, errorLog: msg } : a)));
    return { ok: false, error: t(locale, "Errors.retryFailDetail", { msg }) };
  }
}
