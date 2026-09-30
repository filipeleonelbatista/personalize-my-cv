// mobile/lib/i18n-config.ts
export const LOCALES = ["pt-BR", "en-US", "es-ES"] as const;
export type UiLocale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: UiLocale = "pt-BR";
export const LOCALE_LABELS: Record<UiLocale, string> = { "pt-BR": "PT-BR", "en-US": "EN-US", "es-ES": "ES-ES" };
