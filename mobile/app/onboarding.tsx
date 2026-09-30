// mobile/app/onboarding.tsx
import { KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useTranslations } from "../lib/i18n-provider";
import { Header } from "../components/Header";
import { OnboardingWizard } from "../components/OnboardingWizard";

export default function OnboardingScreen() {
  const t = useTranslations("Page");
  return (
    <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-white dark:bg-black">
      <Header title="Personalize My CV" subtitle={t("tagline")} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1">
        <ScrollView keyboardShouldPersistTaps="handled">
          <OnboardingWizard onDone={() => router.replace("/(tabs)/curriculos")} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
