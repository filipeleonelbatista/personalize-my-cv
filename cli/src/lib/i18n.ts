import ptBR from "../../messages/pt-BR.json" with { type: "json" };
import enUS from "../../messages/en-US.json" with { type: "json" };
import esES from "../../messages/es-ES.json" with { type: "json" };

export const LOCALES = ["pt-BR", "en-US", "es-ES"] as const;
export type UiLocale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: UiLocale = "pt-BR";

const TABLES: Record<UiLocale, unknown> = { "pt-BR": ptBR, "en-US": enUS, "es-ES": esES };

function lookup(table: unknown, key: string): string | null {
  let cur: unknown = table;
  for (const part of key.split(".")) {
    if (typeof cur !== "object" || cur === null) return null;
    cur = (cur as Record<string, unknown>)[part];
  }
  return typeof cur === "string" ? cur : null;
}

export function t(locale: UiLocale, key: string, vars?: Record<string, string | number>): string {
  const raw = lookup(TABLES[locale], key) ?? lookup(TABLES[DEFAULT_LOCALE], key) ?? key;
  return raw.replace(/\{(\w+)\}/g, (_, k: string) => String(vars?.[k] ?? `{${k}}`));
}

export function parseLocale(v: unknown): UiLocale {
  const s = String(v ?? "").trim();
  if (s === "pt-BR" || s === "pt_BR") return "pt-BR";
  if (s.startsWith("en")) return "en-US";
  if (s.startsWith("es")) return "es-ES";
  if ((LOCALES as readonly string[]).includes(s)) return s as UiLocale;
  const env = `${process.env.LC_ALL ?? ""} ${process.env.LANG ?? ""}`;
  if (/pt/i.test(env)) return "pt-BR";
  if (/es/i.test(env)) return "es-ES";
  if (/en/i.test(env)) return "en-US";
  return DEFAULT_LOCALE;
}
