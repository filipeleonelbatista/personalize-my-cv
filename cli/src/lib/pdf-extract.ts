import { readFileSync } from "node:fs";
import { t, type UiLocale } from "./i18n.js";

export async function extractPdfText(path: string, locale: UiLocale = "pt-BR"): Promise<string> {
  if (!/\.pdf$/i.test(path)) throw new Error(t(locale, "Errors.invalidPdf"));
  let buf: Buffer;
  try {
    buf = readFileSync(path);
  } catch {
    throw new Error(t(locale, "Errors.notFound"));
  }
  if (buf.length < 100) throw new Error(t(locale, "Errors.emptyPdf"));
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), isEvalSupported: false }).promise;
  try {
    let out = "";
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const tc = await page.getTextContent();
      out += tc.items.map((it) => ("str" in (it as object) ? (it as { str: string }).str : "")).join(" ") + "\n";
    }
    const text = out.trim();
    if (!text) throw new Error(t(locale, "Errors.unscannedPdf"));
    return text;
  } finally {
    await doc.destroy();
  }
}
