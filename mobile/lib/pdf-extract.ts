// mobile/lib/pdf-extract.ts — STUB: real implementation lands in Task 4.
// Exists now only so Task 3 screens compile against the interface contract.
import type { BaseLang } from "./cv-labels";
import type { UiLocale } from "./i18n-locale";

export type PdfFile = { uri: string; name: string };

export async function pickPdf(): Promise<PdfFile | null> {
  throw new Error("not implemented (Task 4)");
}

export async function createBaseFromFile(_file: PdfFile, _lang: BaseLang, _locale?: UiLocale): Promise<void> {
  throw new Error("not implemented (Task 4)");
}
