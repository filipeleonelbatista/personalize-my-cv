import { join } from "node:path";
import { parseBaseLang, type BaseLang } from "../lib/prompts.js";
import { runTailorJob, type TailorResult } from "../lib/tailor.js";
import { renderPdf } from "../lib/pdf.js";
import { loadBase } from "../lib/store.js";
import { t, type UiLocale } from "../lib/i18n.js";
import { formatAnalysis } from "./show.js";

export async function generateForJob(
  jobText: string,
  locale: UiLocale,
  cvLangRaw: unknown,
  outDir: string = process.cwd(),
): Promise<{ result: TailorResult; analysis: string; pdfPath: string }> {
  const base = loadBase();
  if (!base) throw new Error(t(locale, "Errors.noBase"));
  const cvLang: BaseLang = parseBaseLang(cvLangRaw === "auto" ? base.lang : cvLangRaw);
  const result = await runTailorJob(jobText, cvLang, locale);
  const pdfPath = join(outDir, result.app.fileName);
  if (result.ok) {
    await renderPdf(result.app.resume, cvLang, pdfPath);
  }
  const analysis = formatAnalysis(result.app, locale);
  return { result, analysis, pdfPath };
}
