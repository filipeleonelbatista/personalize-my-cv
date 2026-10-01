import { generateJson, validateGeminiKey } from "../lib/chain.js";
import { buildBaseExtractSystem, parseBaseLang, type BaseLang } from "../lib/prompts.js";
import { normalizeResume } from "../lib/tailor.js";
import { buildRepairUser } from "../lib/prompts.js";
import { extractPdfText } from "../lib/pdf-extract.js";
import { loadConfig, saveBase, saveConfig } from "../lib/store.js";
import { t, type UiLocale } from "../lib/i18n.js";

export async function ensureApiKey(locale: UiLocale, promptKey: () => Promise<string>): Promise<string> {
  const cfg = loadConfig();
  if (cfg.geminiKey) return cfg.geminiKey;
  const key = (await promptKey()).trim();
  const v = await validateGeminiKey(key, locale);
  if (!v.ok) throw new Error(v.error);
  saveConfig({ ...cfg, geminiKey: key });
  return key;
}

export async function onboardWithPdf(pdfPath: string, locale: UiLocale, cvLangRaw: unknown): Promise<void> {
  const cvLang: BaseLang = parseBaseLang(cvLangRaw);
  const cfg = loadConfig();
  if (!cfg.geminiKey) throw new Error(t(locale, "Errors.noKey"));
  const text = await extractPdfText(pdfPath, locale);
  const system = buildBaseExtractSystem(cvLang);
  const { data } = await generateJson(system, text.slice(0, 12000), cfg.geminiKey, cfg.models, locale);
  let resume;
  try {
    resume = normalizeResume(data);
  } catch (zerr) {
    const { data: fixed } = await generateJson(system, buildRepairUser(JSON.stringify(data), String(zerr)), cfg.geminiKey, cfg.models, locale);
    resume = normalizeResume(fixed);
  }
  saveBase({ resume, lang: cvLang, updatedAt: new Date().toISOString() });
}
