// mobile/lib/i18n-provider.tsx
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { IntlProvider } from "use-intl";
import ptBR from "./messages/pt-BR.json";
import enUS from "./messages/en-US.json";
import esES from "./messages/es-ES.json";
import { DEFAULT_LOCALE, type UiLocale } from "./i18n-config";
import { loadLocale, saveLocale } from "./store";
import { setRuntimeLocale } from "./i18n-locale";

const MESSAGES = { "pt-BR": ptBR, "en-US": enUS, "es-ES": esES } as const;

const Ctx = createContext<{ locale: UiLocale; setLocale: (l: UiLocale) => void }>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
});
export const useUiLocale = () => useContext(Ctx);
export { useTranslations } from "use-intl";

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<UiLocale>(DEFAULT_LOCALE);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    loadLocale().then((l) => {
      setRuntimeLocale(l);
      setLocaleState(l);
      setReady(true);
    });
  }, []);
  const setLocale = useCallback((l: UiLocale) => {
    setRuntimeLocale(l);
    void saveLocale(l).then(() => setLocaleState(l));
  }, []);
  if (!ready) return null;
  return (
    <Ctx.Provider value={{ locale, setLocale }}>
      <IntlProvider locale={locale} messages={MESSAGES[locale]}>
        {children}
      </IntlProvider>
    </Ctx.Provider>
  );
}
