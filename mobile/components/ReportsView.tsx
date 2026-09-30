// mobile/components/ReportsView.tsx — week pager + stat cards + custom bars.
import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useTranslations } from "../lib/i18n-provider";
import { loadApps, type StoredApp } from "../lib/store";
import { getLocale } from "../lib/i18n-locale";
import { bucketByWeekday, weekLabel, weekRange } from "../lib/report";
import { EmptyState } from "./EmptyState";

const WEEKDAYS: Record<string, string[]> = {
  "pt-BR": ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"],
  "en-US": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  "es-ES": ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"],
};

export function ReportsView() {
  const t = useTranslations("Reports");
  const [offset, setOffset] = useState(0);
  const [apps, setApps] = useState<StoredApp[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadApps().then(setApps);
    }, []),
  );

  const { start, end } = weekRange(new Date(), offset);
  const endExclusive = new Date(end);
  endExclusive.setDate(endExclusive.getDate() + 1);
  const dates = apps
    .map((a) => new Date(a.createdAt))
    .filter((d) => !Number.isNaN(d.getTime()) && d >= start && d < endExclusive);
  const counts = bucketByWeekday(dates);
  const total = dates.length;
  const labels = WEEKDAYS[getLocale()] ?? WEEKDAYS["pt-BR"];
  const best = counts.indexOf(Math.max(...counts));
  const max = Math.max(1, ...counts);

  return (
    <View className="gap-3 p-4">
      <View className="flex-row items-center justify-between">
        <Pressable onPress={() => setOffset((o) => o - 1)} className="rounded-xl border border-zinc-300 px-3 py-2">
          <Text className="text-sm text-zinc-700 dark:text-zinc-300">‹ {t("prevWeek")}</Text>
        </Pressable>
        <Text className="text-sm font-bold text-zinc-900 dark:text-zinc-50">{weekLabel(start, end)}</Text>
        <Pressable onPress={() => setOffset((o) => o + 1)} disabled={offset >= 0} className="rounded-xl border border-zinc-300 px-3 py-2 opacity-100 disabled:opacity-40">
          <Text className="text-sm text-zinc-700 dark:text-zinc-300">{t("nextWeek")} ›</Text>
        </Pressable>
      </View>
      {total === 0 ? (
        <EmptyState message={t("empty")} />
      ) : (
        <View className="gap-3">
          <View className="flex-row gap-2">
            {[
              [t("totalWeek"), String(total)],
              [t("avgDay"), String(Math.round((total / 7) * 10) / 10)],
              [t("bestDay"), labels[best]],
            ].map(([label, value]) => (
              <View key={label} className="flex-1 rounded-2xl border border-zinc-200 p-3 dark:border-zinc-800">
                <Text className="text-xs text-zinc-500">{label}</Text>
                <Text className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{value}</Text>
              </View>
            ))}
          </View>
          <View className="rounded-2xl border border-zinc-200 p-3 dark:border-zinc-800">
            <Text className="mb-2 text-sm font-bold text-zinc-900 dark:text-zinc-50">{t("chartTitle")}</Text>
            <View className="h-40 flex-row items-end justify-between gap-1">
              {counts.map((c, i) => (
                <View key={i} className="flex-1 items-center justify-end">
                  <View className="w-full rounded-t bg-blue-600" style={{ height: `${(c / max) * 100}%`, minHeight: c ? 4 : 0 }} />
                  <Text className="mt-1 text-[10px] text-zinc-500">{labels[i]}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
