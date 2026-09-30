// mobile/app/(tabs)/curriculos.tsx — resume list + generate + detail.
import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, router } from "expo-router";
import { useTranslations } from "../../lib/i18n-provider";
import { loadApps, loadBase, type StoredApp } from "../../lib/store";
import { Header } from "../../components/Header";
import { VacancyCard } from "../../components/VacancyCard";
import { GenerateSheet } from "../../components/GenerateSheet";
import { DetailSheet } from "../../components/DetailSheet";
import { EmptyState } from "../../components/EmptyState";

export default function CurriculosScreen() {
  const t = useTranslations("Page");
  const tg = useTranslations("Generate");
  const tv = useTranslations("Vacancy");
  const [apps, setApps] = useState<StoredApp[]>([]);
  const [baseName, setBaseName] = useState<string | null>(null);
  const [baseTitle, setBaseTitle] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [selected, setSelected] = useState<StoredApp | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    const [b, a] = await Promise.all([loadBase(), loadApps()]);
    setBaseName(b?.resume.cabecalho.nome ?? null);
    setBaseTitle(b?.resume.cabecalho.titulo_profissional ?? null);
    setApps(a);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  async function onRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  return (
    <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-white dark:bg-black">
      <Header
        title="Personalize My CV"
        subtitle={baseName && baseTitle ? t("baseLine", { nome: baseName, titulo: baseTitle }) : t("tagline")}
      />
      <View className="flex-row gap-2 px-4 pb-2">
        <Pressable onPress={() => setGenerating(true)} className="flex-1 rounded-xl bg-blue-600 p-3">
          <Text className="text-center font-bold text-white">✨ {tg("open")}</Text>
        </Pressable>
        <Pressable onPress={() => router.push("/settings")} className="rounded-xl border border-zinc-300 p-3">
          <Text>⚙️</Text>
        </Pressable>
      </View>
      {apps.length === 0 ? (
        <View className="p-4">
          <EmptyState message={tv("empty")} />
        </View>
      ) : (
        <FlatList
          data={apps}
          keyExtractor={(a) => a.id}
          className="flex-1"
          contentContainerClassName="p-4"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => <VacancyCard app={item} onOpen={() => setSelected(item)} />}
        />
      )}
      <GenerateSheet visible={generating} onClose={() => setGenerating(false)} onChanged={refresh} />
      {selected ? <DetailSheet app={selected} onClose={() => setSelected(null)} onChanged={refresh} /> : null}
    </SafeAreaView>
  );
}
