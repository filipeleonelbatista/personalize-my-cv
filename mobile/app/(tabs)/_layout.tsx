// mobile/app/(tabs)/_layout.tsx
import { Tabs } from "expo-router";
import { Text } from "react-native";
import { useTranslations } from "../../lib/i18n-provider";

export default function TabsLayout() {
  const t = useTranslations("Dashboard");
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen
        name="curriculos"
        options={{
          title: t("resumes"),
          tabBarIcon: () => <Text>📄</Text>,
        }}
      />
      <Tabs.Screen
        name="relatorios"
        options={{
          title: t("reports"),
          tabBarIcon: () => <Text>📊</Text>,
        }}
      />
    </Tabs>
  );
}
