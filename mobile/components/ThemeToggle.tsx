// mobile/components/ThemeToggle.tsx
import { Pressable } from "react-native";
import { useTranslations } from "../lib/i18n-provider";
import { useTheme } from "../lib/theme";
import { AppIcon } from "./AppIcon";

export function ThemeToggle() {
  const t = useTranslations("Theme");
  const { resolved, setScheme } = useTheme();
  return (
    <Pressable
      accessibilityLabel={t("toggle")}
      onPress={() => setScheme(resolved === "dark" ? "light" : "dark")}
      className="h-10 w-10 items-center justify-center rounded-full"
    >
      <AppIcon name={resolved === "dark" ? "sun" : "moon"} size={22} />
    </Pressable>
  );
}
