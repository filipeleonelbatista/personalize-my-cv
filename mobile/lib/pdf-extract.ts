// mobile/lib/pdf-extract.ts
import * as DocumentPicker from "expo-document-picker";
import { loadSettings, saveBase, setOnboarded } from "./store";
import { getApiKey } from "./secure-key";
import { generateJson } from "./llm/chain";
import { buildBaseExtractSystem, buildRepairUser, type BaseLang } from "./llm/prompts";
import { normalizeResume } from "./tailor";
import { getLocale, tErr, type UiLocale } from "./i18n-locale";
import { extractCvTextFromUri } from "./webview-extract";

export type PdfFile = { uri: string; name: string };

export async function pickPdf(): Promise<PdfFile | null> {
  const r = await DocumentPicker.getDocumentAsync({ type: "application/pdf", copyToCacheDirectory: true });
  if (r.canceled || !r.assets?.[0]) return null;
  return { uri: r.assets[0].uri, name: r.assets[0].name ?? "cv.pdf" };
}

export async function createBaseFromFile(file: PdfFile, lang: BaseLang, locale: UiLocale = getLocale()): Promise<void> {
  const text = await extractCvTextFromUri(file.uri, locale);
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
