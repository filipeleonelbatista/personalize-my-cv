// mobile/components/LocaleSelector.tsx
import { Pressable, Text, View } from "react-native";
import { useTranslations } from "../lib/i18n-provider";
import { LOCALES, LOCALE_LABELS } from "../lib/i18n-config";
import { useUiLocale } from "../lib/i18n-provider";

export function LocaleSelector() {
  const t = useTranslations("Locale");
  const { locale, setLocale } = useUiLocale();
  return (
    <View accessibilityLabel={t("aria")} className="flex-row gap-1 rounded-full bg-zinc-100 p-1 dark:bg-zinc-800">
      {LOCALES.map((l) => (
        <Pressable
          key={l}
          onPress={() => setLocale(l)}
          className={`rounded-full px-2 py-1 ${l === locale ? "bg-white dark:bg-zinc-950" : ""}`}
        >
          <Text className={`text-xs font-bold ${l === locale ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-500"}`}>
            {LOCALE_LABELS[l]}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
