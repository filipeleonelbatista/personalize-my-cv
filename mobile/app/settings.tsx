// mobile/app/settings.tsx
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useTranslations } from "../lib/i18n-provider";
import { Header } from "../components/Header";
import { SettingsSheet } from "../components/SettingsSheet";
import { UpdateBaseSheet } from "../components/UpdateBaseSheet";

export default function SettingsScreen() {
  const t = useTranslations("Page");
  const tb = useTranslations("Base");
  const [updating, setUpdating] = useState(false);
  return (
    <View className="flex-1 bg-white dark:bg-black">
      <Header title="Personalize My CV" subtitle={t("tagline")} />
      <View className="px-4 pb-2">
        <Pressable onPress={() => setUpdating(true)} className="rounded-xl border border-zinc-300 p-3 dark:border-zinc-700">
          <Text className="text-center font-bold text-zinc-700 dark:text-zinc-300">{tb("updateBaseBtn")}</Text>
        </Pressable>
      </View>
      <View className="flex-1">
        <SettingsSheet onKeyRemoved={() => router.replace("/onboarding")} />
      </View>
      <UpdateBaseSheet visible={updating} onClose={() => setUpdating(false)} onChanged={() => {}} />
    </View>
  );
}
