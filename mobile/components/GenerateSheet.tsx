// mobile/components/GenerateSheet.tsx
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { FormInput } from "./FormInput";
import { useTranslations } from "../lib/i18n-provider";
import { runTailorJob } from "../lib/tailor-client";
import { loadApps, quotaMessage } from "../lib/store";
import { getLocale } from "../lib/i18n-locale";
import { ensureOnline } from "../lib/net";
import { toast, toastError } from "../lib/toast";
import type { BaseLang } from "../lib/cv-labels";
import { ModalShell } from "./ModalShell";

const CV_LANGS: BaseLang[] = ["pt-BR", "en", "es"];
const CV_LANG_LABELS: Record<BaseLang, string> = { "pt-BR": "Português (BR)", en: "English", es: "Español" };

export function GenerateSheet({ visible, onClose, onChanged }: { visible: boolean; onClose: () => void; onChanged: () => void }) {
  const t = useTranslations("Generate");
  const [jobText, setJobText] = useState("");
  const [lang, setLang] = useState<BaseLang>("pt-BR");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onGenerate() {
    if (!(await ensureOnline())) return;
    setError("");
    setLoading(true);
    try {
      const r = await runTailorJob(jobText, lang);
      if (r.ok) {
        toast(t("success"));
        setJobText("");
        onChanged();
        onClose();
      } else {
        setError(r.error);
        toastError(t("failSaved"), r.error.slice(0, 200));
        onChanged();
      }
    } catch (e) {
      const msg = ((e instanceof Error ? e.message : String(e)) || t("unknownFail")).slice(0, 500);
      setError(msg);
      if (msg === quotaMessage(getLocale())) toastError(t("storageFull"), msg);
      else toastError(t("failGeneric"), msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModalShell visible={visible} onClose={onClose} title={t("title")}>
      <ScrollView>
        <Text className="mb-2 text-sm text-zinc-500">{t("desc")}</Text>
        <Text className="mb-1 text-sm font-bold text-zinc-700 dark:text-zinc-300">{t("cvLang")}</Text>
        <View className="mb-2 flex-row gap-2">
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
        <FormInput
          value={jobText}
          onChangeText={setJobText}
          placeholder={t("placeholder")}
          multiline
          numberOfLines={8}
          editable={!loading}
          textAlignVertical="top"
          className="mb-2 min-h-[160px]"
        />
        {loading ? (
          <Text className="mb-2 text-sm text-zinc-500">
            {t("stage1")} {t("loadingNote")}
          </Text>
        ) : null}
        {error ? <Text className="mb-2 text-sm text-red-600">{error}</Text> : null}
        <View className="flex-row gap-2">
          <Pressable onPress={onClose} disabled={loading} className="flex-1 rounded-xl border border-zinc-300 p-3">
            <Text className="text-center text-zinc-700 dark:text-zinc-300">{t("cancel")}</Text>
          </Pressable>
          <Pressable onPress={onGenerate} disabled={loading || jobText.trim().length < 20} className="flex-1 rounded-xl bg-blue-600 p-3">
            <Text className="text-center font-bold text-white">{loading ? t("generating") : t("submit")}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </ModalShell>
  );
}
