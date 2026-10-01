import "../global.css";
import { useEffect } from "react";
import { Stack } from "expo-router";
import Toast from "react-native-toast-message";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import { Roboto_400Regular, Roboto_500Medium, Roboto_700Bold, useFonts } from "@expo-google-fonts/roboto";
import { ThemeProvider } from "../lib/theme";
import { I18nProvider } from "../lib/i18n-provider";
import { PdfExtractorHost } from "../components/PdfExtractorHost";

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Roboto_400Regular,
    Roboto_500Medium,
    Roboto_700Bold,
  });

  useEffect(() => {
    if (loaded || error) {
      void SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <I18nProvider>
          <PdfExtractorHost />
          <Stack screenOptions={{ headerShown: false }} />
          <Toast />
        </I18nProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
