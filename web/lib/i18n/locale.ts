// web/lib/i18n/locale.ts
// Non-React locale helpers for lib code (no provider needed): static message
// tables + pmcv:locale read with pt-BR fallback.
import { z } from "zod";
import ptBR from "@/messages/pt-BR.json";
import enUS from "@/messages/en-US.json";
import esES from "@/messages/es-ES.json";
import { DEFAULT_LOCALE, type UiLocale } from "./config";

const LocaleSchema = z.enum(["pt-BR", "en-US", "es-ES"]);
const TABLES: Record<UiLocale, unknown> = { "pt-BR": ptBR, "en-US": enUS, "es-ES": esES };

export function getLocale(): UiLocale {
  try {
    const raw = localStorage.getItem("pmcv:locale");
    return LocaleSchema.parse(raw ?? DEFAULT_LOCALE);
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
