// mobile/app/(tabs)/relatorios.tsx
import { ScrollView, View } from "react-native";
import { useTranslations } from "../../lib/i18n-provider";
import { Header } from "../../components/Header";
import { ReportsView } from "../../components/ReportsView";

export default function RelatoriosScreen() {
  const t = useTranslations("Page");
  return (
    <View className="flex-1 bg-white dark:bg-black">
      <Header title="Personalize My CV" subtitle={t("tagline")} />
      <ScrollView>
        <ReportsView />
      </ScrollView>
    </View>
  );
}
