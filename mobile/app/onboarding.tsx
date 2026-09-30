// mobile/app/onboarding.tsx
import { ScrollView, View } from "react-native";
import { router } from "expo-router";
import { useTranslations } from "../lib/i18n-provider";
import { Header } from "../components/Header";
import { OnboardingWizard } from "../components/OnboardingWizard";

export default function OnboardingScreen() {
  const t = useTranslations("Page");
  return (
    <View className="flex-1 bg-white dark:bg-black">
      <Header title="Personalize My CV" subtitle={t("tagline")} />
      <ScrollView>
        <OnboardingWizard onDone={() => router.replace("/(tabs)/curriculos")} />
      </ScrollView>
    </View>
  );
}
