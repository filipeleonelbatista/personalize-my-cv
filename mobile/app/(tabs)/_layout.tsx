// mobile/app/(tabs)/_layout.tsx
import { Tabs } from "expo-router";
import type { ColorValue } from "react-native";
import { useTranslations } from "../../lib/i18n-provider";
import { AppIcon, type IconName } from "../../components/AppIcon";

function TabIcon({ name, color, size }: { name: IconName; color?: ColorValue; size?: number }) {
  return <AppIcon name={name} color={color} size={size} />;
}

export default function TabsLayout() {
  const t = useTranslations("Dashboard");
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen
        name="curriculos"
        options={{
          title: t("resumes"),
          tabBarIcon: ({ color, size }) => <TabIcon name="file" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="relatorios"
        options={{
          title: t("reports"),
          tabBarIcon: ({ color, size }) => <TabIcon name="chart" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
