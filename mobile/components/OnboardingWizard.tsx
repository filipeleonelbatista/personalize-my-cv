// mobile/components/OnboardingWizard.tsx — 3 steps mirroring web onboarding.
import { useState } from "react";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { FormInput } from "./FormInput";
import { useTranslations } from "../lib/i18n-provider";
import { validateGeminiKey } from "../lib/llm/chain";
import { loadSettings, saveSettings } from "../lib/store";
import { setApiKey } from "../lib/secure-key";
import { BasePickStep } from "./BasePickStep";

export function OnboardingWizard({ onDone }: { onDone: () => void }) {
  const t = useTranslations("Onboarding");
  const tc = useTranslations("Common");
  const [step, setStep] = useState(0);
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const trimmedKey = key.trim();

  async function onValidateSave() {
    setError("");
    setLoading(true);
    try {
      const v = await validateGeminiKey(trimmedKey);
      if (!v.ok) {
        setError(v.error);
        return;
      }
      const cur = await loadSettings();
      await saveSettings(cur);
      await setApiKey(trimmedKey);
      setStep(2);
    } finally {
      setLoading(false);
    }
  }

  if (step === 0) {
    return (
      <View className="gap-2 p-4">
        <Text className="text-xl font-bold text-zinc-900 dark:text-zinc-50">{t("welcomeTitle")}</Text>
        <Text className="text-sm text-zinc-500">{t("howItWorks")}</Text>
        <Text className="text-sm text-zinc-500">{t("stepOf", { n: 1 })}</Text>
        <Text className="text-sm text-zinc-700 dark:text-zinc-300">{t("b1")}</Text>
        <Text className="text-sm text-zinc-700 dark:text-zinc-300">{t("b2")}</Text>
        <Text className="text-sm text-zinc-700 dark:text-zinc-300">{t("b3")}</Text>
        <Pressable onPress={() => setStep(1)} className="mt-2 rounded-xl bg-blue-600 p-3">
          <Text className="text-center font-bold text-white">{t("start")}</Text>
        </Pressable>
      </View>
    );
  }

  if (step === 1) {
    return (
      <View className="gap-3 p-4">
        <Text className="text-xl font-bold text-zinc-900 dark:text-zinc-50">{t("connectTitle")}</Text>
        <Text className="text-sm text-zinc-500">{t("connectDesc")}</Text>
        <Text className="text-sm text-zinc-500">{t("stepOf", { n: 2 })}</Text>
        <Text className="text-sm text-blue-600 underline" onPress={() => Linking.openURL("https://aistudio.google.com/apikey")}>
          {t("createKeyLink")}
        </Text>
        <FormInput
          value={key}
          onChangeText={setKey}
          placeholder={t("keyPlaceholder")}
          secureTextEntry
          editable={!loading}
        />
        {error ? <Text className="text-sm text-red-600">{error}</Text> : null}
        <View className="flex-row gap-2">
          <Pressable onPress={() => setStep(0)} disabled={loading} className="flex-1 rounded-xl border border-zinc-300 p-3">
            <Text className="text-center text-zinc-700 dark:text-zinc-300">{tc("back")}</Text>
          </Pressable>
          <Pressable onPress={onValidateSave} disabled={loading || !trimmedKey} className="flex-1 rounded-xl bg-blue-600 p-3">
            <Text className="text-center font-bold text-white">{loading ? t("validating") : t("validate")}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <ScrollView contentContainerClassName="gap-3 p-4">
      <BasePickStep
        title={t("createTitle")}
        description={t("createDesc")}
        stepLabel={t("stepOf", { n: 3 })}
        submitLabel={t("createBtn")}
        showBack
        onBack={() => setStep(1)}
        onDone={onDone}
      />
    </ScrollView>
  );
}
