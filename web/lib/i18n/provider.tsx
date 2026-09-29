// web/lib/i18n/provider.tsx
"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import ptBR from "@/messages/pt-BR.json";
import enUS from "@/messages/en-US.json";
import esES from "@/messages/es-ES.json";
import { DEFAULT_LOCALE, type UiLocale } from "./config";
import { loadLocale, saveLocale } from "@/lib/store";

const MESSAGES = { "pt-BR": ptBR, "en-US": enUS, "es-ES": esES } as const;
const Ctx = createContext<{ locale: UiLocale; setLocale: (l: UiLocale) => void }>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
});
export const useUiLocale = () => useContext(Ctx);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<UiLocale>(DEFAULT_LOCALE);
  useEffect(() => setLocaleState(loadLocale()), []);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  const setLocale = useCallback((l: UiLocale) => {
    saveLocale(l);
    setLocaleState(l);
  }, []);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "pmcv:locale" || e.key === null) setLocaleState(loadLocale());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return (
    <Ctx.Provider value={{ locale, setLocale }}>
      <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]} key={locale}>
        {children}
      </NextIntlClientProvider>
    </Ctx.Provider>
  );
}
