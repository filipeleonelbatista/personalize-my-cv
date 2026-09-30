// mobile/components/SettingsSheet.tsx — key, models, backup.
import { useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, Text, View, Alert } from "react-native";
import { FormInput } from "./FormInput";
import { useTranslations } from "../lib/i18n-provider";
import { clearSettings, exportBackup, importBackup, loadSettings, saveSettings, setOnboarded } from "../lib/store";
import { clearApiKey, getApiKey, setApiKey } from "../lib/secure-key";
import { validateGeminiKey } from "../lib/llm/chain";
import { DEFAULT_GEMINI_MODELS } from "../lib/llm/gemini";
import { exportBackupToFile, importBackupFromFile } from "../lib/backup-files";
import { toast, toastError } from "../lib/toast";

export function SettingsSheet({ onKeyRemoved }: { onKeyRemoved: () => void }) {
  const t = useTranslations("Settings");
  const [key, setKey] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [custom, setCustom] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const [k, s] = await Promise.all([getApiKey(), loadSettings()]);
      setKey(k ?? "");
      setModels(s.models);
      setCustom(s.models.filter((m) => !DEFAULT_GEMINI_MODELS.includes(m)).join(", "));
    })();
  }, []);

  function toggleModel(m: string) {
    setModels((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  }

  async function handleSave() {
    setError("");
    setLoading(true);
    try {
      const trimmed = key.trim();
      const v = await validateGeminiKey(trimmed);
      if (!v.ok) {
        setError(v.error);
        return;
      }
      const all = Array.from(new Set([...models, ...custom.split(",").map((s) => s.trim()).filter(Boolean)]));
      if (!all.length) {
        setError(t("minOneModel"));
        return;
      }
      await setApiKey(trimmed);
      await saveSettings({ models: all });
      toast(t("updated"));
    } finally {
      setLoading(false);
    }
  }

  function handleClearKey() {
    Alert.alert(t("clearKey"), t("confirmClear"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("clearKey"),
        style: "destructive",
        onPress: () => {
          void (async () => {
            await clearApiKey();
            await clearSettings();
            await setOnboarded(false);
            onKeyRemoved();
          })();
        },
      },
    ]);
  }

  async function handleExport() {
    try {
      await exportBackupToFile();
      toast(t("exported"));
    } catch (e) {
      toastError(t("export"), e instanceof Error ? e.message : String(e));
    }
  }

  async function handleImport() {
    try {
      await importBackupFromFile();
      toast(t("imported"));
    } catch (e) {
      toastError(t("invalidBackup"), e instanceof Error ? e.message : String(e));
    }
  }

  const options = Array.from(new Set([...DEFAULT_GEMINI_MODELS, ...models]));

  return (
    <ScrollView contentContainerClassName="gap-3 p-4" className="flex-1">
      <Text className="text-sm text-zinc-500">{t("desc")}</Text>
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
      <Text className="text-sm font-bold text-zinc-700 dark:text-zinc-300">{t("modelsLegend")}</Text>
      {options.map((m) => (
        <Pressable key={m} onPress={() => toggleModel(m)} disabled={loading} className="flex-row items-center gap-2">
          <Text className="text-lg">{models.includes(m) ? "☑️" : "⬜"}</Text>
          <Text className="text-sm text-zinc-700 dark:text-zinc-300">{m}</Text>
        </Pressable>
      ))}
      <FormInput
        value={custom}
        onChangeText={setCustom}
        placeholder={t("customPlaceholder")}
        editable={!loading}
      />
      {error ? <Text className="text-sm text-red-600">{error}</Text> : null}
      <View className="flex-row gap-2">
        <Pressable onPress={handleClearKey} disabled={loading} className="flex-1 rounded-xl border border-red-300 p-3">
          <Text className="text-center text-red-600">{t("clearKey")}</Text>
        </Pressable>
        <Pressable onPress={handleSave} disabled={loading || !key.trim()} className="flex-1 rounded-xl bg-blue-600 p-3">
          <Text className="text-center font-bold text-white">{loading ? t("validating") : t("save")}</Text>
        </Pressable>
      </View>
      <Text className="mt-2 text-sm font-bold text-zinc-700 dark:text-zinc-300">{t("backup")}</Text>
      <View className="flex-row gap-2">
        <Pressable onPress={handleExport} className="flex-1 rounded-xl border border-zinc-300 p-3">
          <Text className="text-center text-zinc-700 dark:text-zinc-300">{t("export")}</Text>
        </Pressable>
        <Pressable onPress={handleImport} className="flex-1 rounded-xl border border-zinc-300 p-3">
          <Text className="text-center text-zinc-700 dark:text-zinc-300">{t("import")}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
