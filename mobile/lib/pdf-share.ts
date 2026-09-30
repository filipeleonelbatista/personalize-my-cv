// mobile/lib/pdf-share.ts
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";
import { cvHtml } from "./cv-html";
import { getLocale, tErr, type UiLocale } from "./i18n-locale";
import type { StoredApp } from "./store";

async function renderToFile(app: StoredApp): Promise<string> {
  const { uri } = await Print.printToFileAsync({ html: cvHtml(app.resume, app.lang) });
  const dest = `${FileSystem.documentDirectory}${app.fileName}`;
  await FileSystem.copyAsync({ from: uri, to: dest });
  return dest;
}

export async function shareResumePdf(app: StoredApp, locale: UiLocale = getLocale()): Promise<void> {
  const dest = await renderToFile(app);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(dest);
  } else {
    throw new Error(tErr(locale, "shareUnavailable"));
  }
}

/** Saves the PDF into the device library (visible in Downloads/Files). */
export async function downloadResumePdf(app: StoredApp, locale: UiLocale = getLocale()): Promise<string> {
  const { status } = await MediaLibrary.requestPermissionsAsync();
  if (status !== "granted") throw new Error(tErr(locale, "permissionDenied"));
  const dest = await renderToFile(app);
  const asset = await MediaLibrary.createAssetAsync(dest);
  return asset.uri;
}
