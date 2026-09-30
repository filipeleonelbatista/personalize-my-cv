// mobile/lib/i18n-locale.ts
// Non-React locale helpers (no provider needed): static message tables +
// pmcv:locale read with pt-BR fallback. Mirrors web/lib/i18n/locale.ts.
import ptBR from "./messages/pt-BR.json";
import enUS from "./messages/en-US.json";
import esES from "./messages/es-ES.json";
import { DEFAULT_LOCALE, type UiLocale } from "./i18n-config";

export type { UiLocale } from "./i18n-config";

const TABLES: Record<UiLocale, unknown> = { "pt-BR": ptBR, "en-US": enUS, "es-ES": esES };

export function parseLocale(raw: unknown): UiLocale {
  return raw === "pt-BR" || raw === "en-US" || raw === "es-ES" ? raw : DEFAULT_LOCALE;
}

// Runtime cache set by the I18nProvider (React Native has no localStorage;
// the provider loads AsyncStorage once and mirrors it here for sync lib use).
let runtimeLocale: UiLocale | null = null;
export function setRuntimeLocale(l: UiLocale): void {
  runtimeLocale = l;
}

export function getLocale(): UiLocale {
  if (runtimeLocale) return runtimeLocale;
  try {
    if (typeof localStorage === "undefined") return DEFAULT_LOCALE;
    return parseLocale(localStorage.getItem("pmcv:locale") ?? DEFAULT_LOCALE);
  } catch {
    return DEFAULT_LOCALE;
  }
}

function lookup(table: unknown, key: string): string | null {
  let cur: unknown = table;
  for (const part of key.split(".")) {
    if (typeof cur !== "object" || cur === null) return null;
    cur = (cur as Record<string, unknown>)[part];
  }
  return typeof cur === "string" ? cur : null;
}

export function tErr(locale: UiLocale, key: string, vars?: Record<string, string | number>): string {
  const raw =
    lookup(TABLES[locale], key) ??
    lookup(TABLES[locale], `Errors.${key}`) ??
    lookup(TABLES[DEFAULT_LOCALE], key) ??
    lookup(TABLES[DEFAULT_LOCALE], `Errors.${key}`) ??
    key;
  return raw.replace(/\{(\w+)\}/g, (_, k: string) => String(vars?.[k] ?? `{${k}}`));
}
