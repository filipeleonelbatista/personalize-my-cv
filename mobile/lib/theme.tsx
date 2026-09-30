// mobile/lib/theme.tsx
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { useColorScheme as useNativeWindColorScheme } from "nativewind";
import { View } from "react-native";

export type Scheme = "light" | "dark" | "system";
export type Resolved = "light" | "dark";

const Ctx = createContext<{ scheme: Scheme; resolved: Resolved; setScheme: (s: Scheme) => void }>({
  scheme: "system",
  resolved: "light",
  setScheme: () => {},
});
export const useTheme = () => useContext(Ctx);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { colorScheme, setColorScheme } = useNativeWindColorScheme();
  const [scheme, setSchemeState] = useState<Scheme>("system");
  const setScheme = useCallback(
    (s: Scheme) => {
      setSchemeState(s);
      setColorScheme(s);
    },
    [setColorScheme],
  );
  const resolved: Resolved = scheme === "system" ? (colorScheme ?? "light") : scheme;
  return (
    <Ctx.Provider value={{ scheme, resolved, setScheme }}>
      <View className="flex-1 bg-white dark:bg-black">{children}</View>
    </Ctx.Provider>
  );
}
