import "../global.css";
import { Stack } from "expo-router";
import { ThemeProvider } from "../lib/theme";
import { I18nProvider } from "../lib/i18n-provider";

export default function RootLayout() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </I18nProvider>
    </ThemeProvider>
  );
}
