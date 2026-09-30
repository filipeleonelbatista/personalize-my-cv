// mobile/app/settings.tsx
import { View } from "react-native";
import { router } from "expo-router";
import { useTranslations } from "../lib/i18n-provider";
import { Header } from "../components/Header";
import { SettingsSheet } from "../components/SettingsSheet";

export default function SettingsScreen() {
  const t = useTranslations("Page");
  return (
    <View className="flex-1 bg-white dark:bg-black">
      <Header title="Personalize My CV" subtitle={t("tagline")} />
      <SettingsSheet onKeyRemoved={() => router.replace("/onboarding")} />
    </View>
  );
}
