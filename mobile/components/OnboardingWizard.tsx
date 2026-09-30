// mobile/components/OnboardingWizard.tsx — 3 steps mirroring web onboarding.
import { useState } from "react";
import { Linking, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useTranslations } from "../lib/i18n-provider";
import { validateGeminiKey } from "../lib/llm/chain";
import { loadSettings, saveSettings, quotaMessage } from "../lib/store";
import { setApiKey } from "../lib/secure-key";
import { getLocale } from "../lib/i18n-locale";
import { createBaseFromFile, pickPdf, type PdfFile } from "../lib/pdf-extract";
import { ensureOnline } from "../lib/net";
import { toast, toastError } from "../lib/toast";
import type { BaseLang } from "../lib/cv-labels";

const CV_LANGS: BaseLang[] = ["pt-BR", "en", "es"];
const CV_LANG_LABELS: Record<BaseLang, string> = { "pt-BR": "Português (BR)", en: "English", es: "Español" };

export function OnboardingWizard({ onDone }: { onDone: () => void }) {
  const t = useTranslations("Onboarding");
  const tc = useTranslations("Common");
  const tp = useTranslations("Picker");
  const [step, setStep] = useState(0);
  const [key, setKey] = useState("");
  const [file, setFile] = useState<PdfFile | null>(null);
  const [lang, setLang] = useState<BaseLang>("pt-BR");
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

  async function onPick() {
    const f = await pickPdf();
    if (f) setFile(f);
  }

  async function onCreateBase() {
    if (!file) return;
    if (!(await ensureOnline())) return;
    setError("");
    setLoading(true);
    try {
      await createBaseFromFile(file, lang);
      toast(t("baseCreated"));
      onDone();
    } catch (e) {
      const msg = ((e instanceof Error ? e.message : String(e)) || t("unknownFail")).slice(0, 500);
      setError(msg);
      if (msg === quotaMessage(getLocale())) toastError(t("storageFull"), msg);
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
        <TextInput
          value={key}
          onChangeText={setKey}
          placeholder={t("keyPlaceholder")}
          secureTextEntry
          editable={!loading}
          className="rounded-xl border border-zinc-300 p-3 text-zinc-900 dark:border-zinc-700 dark:text-zinc-50"
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
      <Text className="text-xl font-bold text-zinc-900 dark:text-zinc-50">{t("createTitle")}</Text>
      <Text className="text-sm text-zinc-500">{t("createDesc")}</Text>
      <Text className="text-sm text-zinc-500">{t("stepOf", { n: 3 })}</Text>
      <Pressable onPress={onPick} disabled={loading} className="rounded-xl border-2 border-dashed border-zinc-300 p-8 dark:border-zinc-700">
        <Text className="text-center text-sm font-bold text-zinc-700 dark:text-zinc-300">
          {file ? file.name : tp("pick")}
        </Text>
      </Pressable>
      <Text className="text-sm text-zinc-700 dark:text-zinc-300">{t("cvLang")}</Text>
      <View className="flex-row gap-2">
        {CV_LANGS.map((l) => (
          <Pressable
            key={l}
            onPress={() => setLang(l)}
            disabled={loading}
            className={`flex-1 rounded-xl border p-2 ${l === lang ? "border-blue-600" : "border-zinc-300 dark:border-zinc-700"}`}
          >
            <Text className="text-center text-sm text-zinc-700 dark:text-zinc-300">{CV_LANG_LABELS[l]}</Text>
          </Pressable>
        ))}
      </View>
      {error ? <Text className="text-sm text-red-600">{error}</Text> : null}
      <View className="flex-row gap-2">
        <Pressable onPress={() => setStep(1)} disabled={loading} className="flex-1 rounded-xl border border-zinc-300 p-3">
          <Text className="text-center text-zinc-700 dark:text-zinc-300">{tc("back")}</Text>
        </Pressable>
        <Pressable onPress={onCreateBase} disabled={loading || !file} className="flex-1 rounded-xl bg-blue-600 p-3">
          <Text className="text-center font-bold text-white">{loading ? t("stage1") : t("createBtn")}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
