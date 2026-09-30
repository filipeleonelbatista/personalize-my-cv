// mobile/components/ThemeToggle.tsx
import { Pressable, Text } from "react-native";
import { useTranslations } from "../lib/i18n-provider";
import { useTheme } from "../lib/theme";

export function ThemeToggle() {
  const t = useTranslations("Theme");
  const { resolved, setScheme } = useTheme();
  return (
    <Pressable
      accessibilityLabel={t("toggle")}
      onPress={() => setScheme(resolved === "dark" ? "light" : "dark")}
      className="h-10 w-10 items-center justify-center rounded-full"
    >
      <Text className="text-xl">{resolved === "dark" ? "☀️" : "🌙"}</Text>
    </Pressable>
  );
}
