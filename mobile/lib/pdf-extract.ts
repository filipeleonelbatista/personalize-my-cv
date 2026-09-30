// mobile/lib/pdf-extract.ts
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { loadSettings, saveBase, setOnboarded } from "./store";
import { getApiKey } from "./secure-key";
import { generateJson } from "./llm/chain";
import { buildBaseExtractSystem, buildRepairUser, type BaseLang } from "./llm/prompts";
import { normalizeResume } from "./tailor";
import { getLocale, tErr, type UiLocale } from "./i18n-locale";
import { extractCvTextFromUri } from "./webview-extract";

export type PdfFile = { uri: string; name: string };

export async function pickPdf(): Promise<PdfFile | null> {
  // No copyToCacheDirectory: we copy the original (often content://) into
  // our own documentDirectory ourselves — the picker's cache copy proved
  // unreliable on some devices (unreadable file:// cache path).
  const r = await DocumentPicker.getDocumentAsync({ type: "application/pdf", copyToCacheDirectory: false });
  if (r.canceled || !r.assets?.[0]) return null;
  return { uri: r.assets[0].uri, name: r.assets[0].name ?? "cv.pdf" };
}

/** Copies the picked file into app storage; throws guided error if unreadable. */
async function ensureLocalCopy(file: PdfFile, locale: UiLocale): Promise<string> {
  const dest = `${FileSystem.documentDirectory}incoming-${Date.now()}.pdf`;
  try {
    await FileSystem.copyAsync({ from: file.uri, to: dest });
  } catch {
    throw new Error(tErr(locale, "fileUnreadable"));
  }
  const info = await FileSystem.getInfoAsync(dest);
  if (!info.exists || (info.size ?? 0) === 0) throw new Error(tErr(locale, "fileUnreadable"));
  return dest;
}

export async function createBaseFromFile(file: PdfFile, lang: BaseLang, locale: UiLocale = getLocale()): Promise<void> {
  const localUri = await ensureLocalCopy(file, locale);
  const text = await extractCvTextFromUri(localUri, locale);
  const settings = await loadSettings();
  const key = await getApiKey();
  if (!key) throw new Error(tErr(locale, "noKey"));
  const system = buildBaseExtractSystem(lang);
  const { data } = await generateJson(system, text.slice(0, 12000), key, settings.models, locale);
  let resume;
  try {
    resume = normalizeResume(data);
  } catch (zerr) {
    const { data: fixed } = await generateJson(
      system,
      buildRepairUser(JSON.stringify(data), String(zerr)),
      key,
      settings.models,
      locale,
    );
    resume = normalizeResume(fixed);
  }
  await saveBase({ resume, lang, updatedAt: new Date().toISOString() });
  await setOnboarded(true);
}
