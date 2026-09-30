// web/lib/cv-text-client.ts
import { getLocale, tErr, type UiLocale } from "@/lib/i18n/locale";

export async function extractCvTextFromFile(file: File, locale: UiLocale = getLocale()): Promise<string> {
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) throw new Error(tErr(locale, "invalidPdf"));
  const buf = new Uint8Array(await file.arrayBuffer());
  if (buf.length < 100) throw new Error(tErr(locale, "emptyPdf"));
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // Worker local (public/pdf.worker.min.mjs, sem CDN) — mantém o output
  // estático/offline-friendly. Se o Worker falhar (ex.: arquivo ausente), o
  // pdf.js cai para o fake worker na thread principal sozinho.
  try {
    if (!pdfjs.GlobalWorkerOptions.workerSrc) pdfjs.GlobalWorkerOptions.workerSrc = "pdf.worker.min.mjs";
  } catch { /* usa o default/fallback do pdf.js */ }
  const doc = await pdfjs.getDocument({ data: buf, standardFontDataUrl: "standard_fonts/" }).promise;
  try {
    let out = "";
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const tc = await page.getTextContent();
      out += tc.items.map((it) => ("str" in (it as object) ? (it as { str: string }).str : "")).join(" ") + "\n";
    }
    const text = out.trim();
    if (!text) throw new Error(tErr(locale, "unscannedPdf"));
    return text;
  } finally { await doc.destroy(); }
}
