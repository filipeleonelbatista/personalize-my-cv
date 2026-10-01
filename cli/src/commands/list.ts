import type { StoredApp } from "../lib/store.js";
import { t, type UiLocale } from "../lib/i18n.js";

export function formatTable(apps: StoredApp[], locale: UiLocale): string {
  if (!apps.length) return t(locale, "Vacancy.empty");
  const header = ["#", t(locale, "Vacancy.colRole"), t(locale, "Vacancy.colCompany"), t(locale, "Vacancy.colMatch"), t(locale, "Vacancy.colDate"), t(locale, "Vacancy.colStatus")].join(" | ");
  const rows = apps.map((a, i) => {
    const date = new Date(a.createdAt).toLocaleDateString(locale);
    const status = a.status === "done" ? t(locale, "Vacancy.done") : t(locale, "Vacancy.failed");
    return `${String(i + 1).padStart(2)} | ${a.cargo} | ${a.empresa} | ${a.matchPercent}% | ${date} | ${status}`;
  });
  return [header, ...rows].join("\n");
}
