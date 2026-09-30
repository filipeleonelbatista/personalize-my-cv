// mobile/lib/pdf-share.ts
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import { cvHtml } from "./cv-html";
import { getLocale, tErr, type UiLocale } from "./i18n-locale";
import type { StoredApp } from "./store";

export async function shareResumePdf(app: StoredApp, locale: UiLocale = getLocale()): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html: cvHtml(app.resume, app.lang) });
  const dest = `${FileSystem.documentDirectory}${app.fileName}`;
  await FileSystem.copyAsync({ from: uri, to: dest });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(dest);
  } else {
    throw new Error(tErr(locale, "shareUnavailable"));
  }
}
