import { loadApps } from "../lib/store.js";
import { bucketByWeekday, weekLabel, weekRange } from "../lib/report.js";
import { t, type UiLocale } from "../lib/i18n.js";

const WEEKDAYS: Record<UiLocale, string[]> = {
  "pt-BR": ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"],
  "en-US": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  "es-ES": ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"],
};

export function renderReport(locale: UiLocale, offsetWeeks: number): string {
  const offset = Math.min(offsetWeeks, 0);
  const { start, end } = weekRange(new Date(), offset);
  const endExclusive = new Date(end);
  endExclusive.setDate(endExclusive.getDate() + 1);
  const dates = loadApps()
    .map((a) => new Date(a.createdAt))
    .filter((d) => !Number.isNaN(d.getTime()) && d >= start && d < endExclusive);
  const counts = bucketByWeekday(dates);
  const total = dates.length;
  const labels = WEEKDAYS[locale] ?? WEEKDAYS["pt-BR"];
  if (!total) return `${weekLabel(start, end)}\n${t(locale, "Reports.empty")}`;
  const best = counts.indexOf(Math.max(...counts));
  const avg = Math.round((total / 7) * 10) / 10;
  const max = Math.max(...counts, 1);
  const lines = [
    weekLabel(start, end),
    `${t(locale, "Reports.totalWeek")}: ${total}`,
    `${t(locale, "Reports.avgDay")}: ${avg}`,
    `${t(locale, "Reports.bestDay")}: ${labels[best]}`,
    t(locale, "Reports.chartTitle"),
  ];
  counts.forEach((c, i) => {
    const bar = "█".repeat(Math.round((c / max) * 10));
    lines.push(`${labels[i].padEnd(4)} ${String(c).padStart(3)} ${bar}`);
  });
  return lines.join("\n");
}
