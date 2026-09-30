// mobile/components/DetailSheet.tsx
import { Pressable, ScrollView, Text, View } from "react-native";
import { useTranslations } from "../lib/i18n-provider";
import * as Clipboard from "expo-clipboard";
import { shareResumePdf, downloadResumePdf } from "../lib/pdf-share";
import { retryStoredApp } from "../lib/tailor-client";
import { loadApps, saveApps, type StoredApp } from "../lib/store";
import { ensureOnline } from "../lib/net";
import { toast, toastError } from "../lib/toast";
import { ModalShell } from "./ModalShell";

export function DetailSheet({ app, onClose, onChanged }: { app: StoredApp; onClose: () => void; onChanged: () => void }) {
  const t = useTranslations("Detail");
  const tv = useTranslations("Vacancy");

  async function copy(text: string, label: string) {
    await Clipboard.setStringAsync(text);
    toast(t("copied", { label }));
  }

  async function onShare() {
    try {
      await shareResumePdf(app);
    } catch (e) {
      toastError(t("downloadFail"), e instanceof Error ? e.message : String(e));
    }
  }

  async function onDownload() {
    try {
      await downloadResumePdf(app);
      toast(t("downloaded"));
    } catch (e) {
      toastError(t("downloadFail"), e instanceof Error ? e.message : String(e));
    }
  }

  async function onRetry() {
    if (!(await ensureOnline())) return;
    try {
      const r = await retryStoredApp(app.id);
      if (r.ok) {
        toast(tv("regenerated"));
        onChanged();
        onClose();
      } else {
        toastError(tv("retryFail"), r.error);
        onChanged();
      }
    } catch (e) {
      toastError(tv("retryFail"), e instanceof Error ? e.message : String(e));
    }
  }

  async function onDelete() {
    try {
      await saveApps((await loadApps()).filter((a) => a.id !== app.id));
      toast(tv("deleted"));
      onChanged();
      onClose();
    } catch (e) {
      toastError(tv("deleteFail"), e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <ModalShell visible onClose={onClose} title={`${app.cargo} — ${app.empresa}`}>
      <ScrollView>
        <Text className="mb-2 text-xs text-zinc-500">
          {t("generatedAt", { date: new Date(app.createdAt).toLocaleString(), file: app.fileName })}
        </Text>
        {app.status === "done" ? (
          <View className="gap-3">
            <View className="flex-row gap-2">
              <Pressable onPress={onDownload} className="flex-1 rounded-xl bg-blue-600 p-3">
                <Text className="text-center font-bold text-white">{t("download")}</Text>
              </Pressable>
              <Pressable onPress={onShare} className="flex-1 rounded-xl border border-zinc-300 p-3 dark:border-zinc-700">
                <Text className="text-center text-zinc-700 dark:text-zinc-300">{t("share")}</Text>
              </Pressable>
              <Pressable onPress={onDelete} className="rounded-xl border border-red-300 p-3">
                <Text className="text-center text-red-600">{tv("delete")}</Text>
              </Pressable>
            </View>
            <Text className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
              {t("affinity", { n: app.matchPercent })}
            </Text>
            <Text className="text-sm font-bold text-zinc-900 dark:text-zinc-50">{t("strengths")}</Text>
            {app.strengths.map((s) => (
              <Text key={s} className="text-sm text-zinc-700 dark:text-zinc-300">
                • {s}
              </Text>
            ))}
            <Text className="text-sm font-bold text-zinc-900 dark:text-zinc-50">{t("weaknesses")}</Text>
            {app.weaknesses.map((w) => (
              <Text key={w} className="text-sm text-zinc-700 dark:text-zinc-300">
                • {w}
              </Text>
            ))}
            <View className="flex-row items-center justify-between">
              <Text className="text-sm font-bold text-zinc-900 dark:text-zinc-50">{t("email")}</Text>
              <Pressable onPress={() => copy(app.emailBody, t("emailShort"))}>
                <Text className="text-sm text-blue-600">{t("copy")}</Text>
              </Pressable>
            </View>
            <Text className="rounded-xl bg-zinc-100 p-3 text-sm text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">{app.emailBody}</Text>
            <View className="flex-row items-center justify-between">
              <Text className="text-sm font-bold text-zinc-900 dark:text-zinc-50">{t("chat")}</Text>
              <Pressable onPress={() => copy(app.chatMessage, t("chatShort"))}>
                <Text className="text-sm text-blue-600">{t("copy")}</Text>
              </Pressable>
            </View>
            <Text className="rounded-xl bg-zinc-100 p-3 text-sm text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">{app.chatMessage}</Text>
            <Text className="mt-2 text-xs text-zinc-400">{t("viewJob")}</Text>
            <Text className="rounded-xl bg-zinc-100 p-3 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">{app.jobText}</Text>
          </View>
        ) : (
          <View className="gap-3">
            <Text className="text-sm text-red-600">{t("noPdf", { error: app.errorLog })}</Text>
            <View className="flex-row gap-2">
              <Pressable onPress={onRetry} className="flex-1 rounded-xl bg-blue-600 p-3">
                <Text className="text-center font-bold text-white">{tv("retry")}</Text>
              </Pressable>
              <Pressable onPress={onDelete} className="rounded-xl border border-red-300 p-3">
                <Text className="text-center text-red-600">{tv("delete")}</Text>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>
    </ModalShell>
  );
}
