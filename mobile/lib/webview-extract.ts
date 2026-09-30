// mobile/lib/webview-extract.ts
// PDF text extraction through a hidden WebView running vendored pdf.js.
// The PdfExtractorHost component (mounted in _layout) owns the WebView;
// jobs flow through the module-level registry below.
import * as FileSystem from "expo-file-system/legacy";
import { getLocale, tErr, type UiLocale } from "./i18n-locale";

type Pending = { resolve: (text: string) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout>; locale: UiLocale };
const pending = new Map<number, Pending>();
let seq = 0;
let poster: ((js: string) => void) | null = null;

export function registerExtractorHost(poster_: (js: string) => void): () => void {
  poster = poster_;
  return () => {
    if (poster === poster_) poster = null;
  };
}

export function resolveExtractorJob(id: number, ok: boolean, text?: string, error?: string): void {
  const p = pending.get(id);
  if (!p) return;
  pending.delete(id);
  clearTimeout(p.timer);
  if (ok && typeof text === "string") p.resolve(text);
  else p.reject(new Error(error || tErr(p.locale, "unknownFail")));
}

function escapeForJs(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$/g, "\\$");
}

export async function extractCvTextFromUri(uri: string, locale: UiLocale = getLocale(), timeoutMs = 60_000): Promise<string> {
  if (!poster) throw new Error(tErr(locale, "extractUnavailable"));
  let b64: string;
  try {
    b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  } catch {
    throw new Error(tErr(locale, "fileUnreadable"));
  }
  const id = ++seq;
  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(tErr(locale, "extractTimeout")));
    }, timeoutMs);
    pending.set(id, { resolve, reject, timer, locale });
    poster!(`window.__extract(\`${escapeForJs(b64)}\`, ${id}); true;`);
  }).then((text) => {
    if (!text.trim()) throw new Error(tErr(locale, "unscannedPdf"));
    return text.trim();
  });
}
