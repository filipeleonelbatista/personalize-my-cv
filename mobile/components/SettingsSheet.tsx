// mobile/components/SettingsSheet.tsx — key, models, backup.
import { useEffect, useRef, useState } from "react";
import { Keyboard, Linking, Pressable, ScrollView, Text, View, Alert } from "react-native";
import { AppIcon } from "./AppIcon";
import { FormInput } from "./FormInput";
import { useTranslations } from "../lib/i18n-provider";
import { clearSettings, exportBackup, importBackup, loadSettings, saveSettings, setOnboarded } from "../lib/store";
import { clearAiLog, loadAiLog, type AiLogEntry } from "../lib/ai-log";
import { clearApiKey, getApiKey, setApiKey } from "../lib/secure-key";
import { validateGeminiKey } from "../lib/llm/chain";
import { ensureOnline } from "../lib/net";
import { DEFAULT_GEMINI_MODELS } from "../lib/llm/gemini";
import { exportBackupToFile, importBackupFromFile } from "../lib/backup-files";
import { toast, toastError } from "../lib/toast";

export function SettingsSheet({ onKeyRemoved }: { onKeyRemoved: () => void }) {
  const t = useTranslations("Settings");
  const ta = useTranslations("AiLog");
  const [key, setKey] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [custom, setCustom] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const [aiLog, setAiLog] = useState<AiLogEntry[]>([]);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => {
      if (focused) scrollRef.current?.scrollToEnd({ animated: true });
    });
    return () => show.remove();
  }, [focused]);

  useEffect(() => {
    (async () => {
      const [k, s] = await Promise.all([getApiKey(), loadSettings()]);
      setKey(k ?? "");
      setModels(s.models);
      setCustom(s.models.filter((m) => !DEFAULT_GEMINI_MODELS.includes(m)).join(", "));
      setAiLog(await loadAiLog());
    })();
  }, []);

  function toggleModel(m: string) {
    setModels((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  }

  async function handleSave() {
    if (!(await ensureOnline())) return;
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
    <ScrollView
      ref={scrollRef}
      contentContainerClassName="gap-3 p-4"
      className="flex-1"
      keyboardShouldPersistTaps="handled"
    >
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
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      <Text className="text-sm font-bold text-zinc-700 dark:text-zinc-300">{t("modelsLegend")}</Text>
      {options.map((m) => (
        <Pressable key={m} onPress={() => toggleModel(m)} disabled={loading} className="flex-row items-center gap-2">
          <Text className="text-lg">{models.includes(m) ? <AppIcon name="check" size={20} /> : <AppIcon name="square" size={20} />}</Text>
          <Text className="text-sm text-zinc-700 dark:text-zinc-300">{m}</Text>
        </Pressable>
      ))}
      <FormInput
        value={custom}
        onChangeText={setCustom}
        placeholder={t("customPlaceholder")}
        editable={!loading}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
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
      <View className="mt-2 gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
        <View className="flex-row items-center justify-between">
          <Text className="text-sm font-bold text-zinc-700 dark:text-zinc-300">{ta("title")}</Text>
          <Pressable
            onPress={() => {
              void clearAiLog().then(() => setAiLog([]));
            }}
          >
            <Text className="text-sm text-blue-600">{ta("clear")}</Text>
          </Pressable>
        </View>
        <Text className="text-xs text-zinc-500">{ta("desc")}</Text>
        {aiLog.length === 0 ? (
          <Text className="text-sm text-zinc-500">{ta("empty")}</Text>
        ) : (
          aiLog.slice(0, 20).map((e) => (
            <View key={e.id} className="rounded-lg bg-zinc-100 p-2 dark:bg-zinc-800">
              <View className="flex-row items-center gap-1">
                <AppIcon name={e.ok ? "check" : "close"} size={12} />
                <Text className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                  {e.label} · {e.provider || "—"} · {e.ms}ms
                </Text>
              </View>
              <Text className="text-[11px] text-zinc-500">{new Date(e.at).toLocaleString()}</Text>
              {e.error ? <Text className="text-[11px] text-red-600">{e.error}</Text> : null}
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}
