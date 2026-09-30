// mobile/components/VacancyCard.tsx
import { Pressable, Text, View } from "react-native";
import { useTranslations } from "../lib/i18n-provider";
import type { StoredApp } from "../lib/store";

export function VacancyCard({ app, onOpen }: { app: StoredApp; onOpen: () => void }) {
  const t = useTranslations("Vacancy");
  return (
    <Pressable onPress={onOpen} className="mb-2 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
      <View className="flex-row items-center justify-between">
        <Text className="flex-1 text-base font-bold text-zinc-900 dark:text-zinc-50">
          {app.cargo} — {app.empresa}
        </Text>
        <Text
          className={`rounded-full px-2 py-1 text-xs font-bold ${
            app.status === "done" ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300" : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
          }`}
        >
          {app.status === "done" ? t("done") : t("failed")}
        </Text>
      </View>
      <View className="mt-1 flex-row items-center justify-between">
        {app.status === "done" ? (
          <Text className="text-sm text-zinc-500">
            {t("colMatch")}: {app.matchPercent}%
          </Text>
        ) : (
          <Text className="text-sm text-zinc-500">—</Text>
        )}
        <Text className="text-xs text-zinc-400">
          {new Date(app.createdAt).toLocaleDateString()}
        </Text>
      </View>
    </Pressable>
  );
}
