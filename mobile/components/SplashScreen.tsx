// mobile/components/SplashScreen.tsx
import { Text, View } from "react-native";
import { useTranslations } from "../lib/i18n-provider";
import { AppIcon } from "./AppIcon";

export function SplashScreen() {
  const t = useTranslations("Splash");
  return (
    <View className="flex-1 items-center justify-center gap-4 bg-white p-6 dark:bg-black" accessibilityLabel={t("loading")}>
      <AppIcon name="file" size={72} />
      <Text className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Personalize My CV</Text>
      <Text className="text-sm text-zinc-500">{t("loading")}</Text>
    </View>
  );
}
