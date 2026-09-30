// mobile/components/BasePickStep.tsx
// PDF pick + CV language + base creation. Shared by OnboardingWizard
// (step 3) and UpdateBaseSheet (settings) so both flows stay identical.
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useTranslations } from "../lib/i18n-provider";
import { useStagedSteps } from "../lib/use-staged-steps";
import { quotaMessage } from "../lib/store";
import { getLocale } from "../lib/i18n-locale";
import { createBaseFromFile, pickPdf, type PdfFile } from "../lib/pdf-extract";
import { ensureOnline } from "../lib/net";
import { toast, toastError } from "../lib/toast";
import type { BaseLang } from "../lib/cv-labels";

const CV_LANGS: BaseLang[] = ["pt-BR", "en", "es"];
const CV_LANG_LABELS: Record<BaseLang, string> = { "pt-BR": "Português (BR)", en: "English", es: "Español" };

export function BasePickStep({
  title,
  description,
  stepLabel,
  submitLabel,
  showBack,
  onBack,
  onDone,
}: {
  title: string;
  description: string;
  stepLabel?: string;
  submitLabel: string;
  showBack?: boolean;
  onBack?: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("Onboarding");
  const tc = useTranslations("Common");
  const tp = useTranslations("Picker");
  const [file, setFile] = useState<PdfFile | null>(null);
  const [lang, setLang] = useState<BaseLang>("pt-BR");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const stages = [t("stage1"), t("stage2"), t("stage3")];
  const stage = useStagedSteps(stages, loading);

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

  return (
    <View className="gap-3">
      <Text className="text-xl font-bold text-zinc-900 dark:text-zinc-50">{title}</Text>
      <Text className="text-sm text-zinc-500">{description}</Text>
      {stepLabel ? <Text className="text-sm text-zinc-500">{stepLabel}</Text> : null}
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
        {showBack ? (
          <Pressable onPress={onBack} disabled={loading} className="flex-1 rounded-xl border border-zinc-300 p-3">
            <Text className="text-center text-zinc-700 dark:text-zinc-300">{tc("back")}</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={onCreateBase} disabled={loading || !file} className="flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-blue-600 p-3">
          {loading ? <ActivityIndicator size="small" color="#fff" /> : null}
          <Text className="text-center font-bold text-white">{loading ? stages[stage] : submitLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}
