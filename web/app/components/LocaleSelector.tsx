// web/app/components/LocaleSelector.tsx
"use client";
import { LOCALE_LABELS, LOCALES } from "@/lib/i18n/config";
import { useUiLocale } from "@/lib/i18n/provider";
import { useTranslations } from "next-intl";
import { Select } from "./ui/select";

export function LocaleSelector() {
  const { locale, setLocale } = useUiLocale();
  const t = useTranslations("Locale");
  return (
    <label className="flex items-center gap-1 text-sm">
      <span className="sr-only">{t("label")}</span>
      <Select value={locale} onChange={(e) => setLocale(e.target.value as typeof locale)} aria-label={t("aria")}>
        {LOCALES.map((l) => (
          <option key={l} value={l}>
            {LOCALE_LABELS[l]}
          </option>
        ))}
      </Select>
    </label>
  );
}
