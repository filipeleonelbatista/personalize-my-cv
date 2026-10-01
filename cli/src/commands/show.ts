import type { StoredApp } from "../lib/store.js";
import { t, type UiLocale } from "../lib/i18n.js";

export function formatAnalysis(app: StoredApp, locale: UiLocale): string {
  const lines = [
    `${app.cargo} — ${app.empresa}`,
    t(locale, "Detail.affinity", { n: app.matchPercent }),
    "",
    `${t(locale, "Detail.strengths")}:`,
    ...app.strengths.map((s) => `  • ${s}`),
    `${t(locale, "Detail.weaknesses")}:`,
    ...app.weaknesses.map((w) => `  • ${w}`),
    "",
    `${t(locale, "Detail.email")}:`,
    app.emailBody,
    "",
    `${t(locale, "Detail.chat")}:`,
    app.chatMessage,
  ];
  return lines.join("\n");
}
