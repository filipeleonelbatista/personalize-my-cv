// mobile/components/Header.tsx — title + [LocaleSelector][HelpDialog][ThemeToggle]
import { Text, View } from "react-native";
import { LocaleSelector } from "./LocaleSelector";
import { HelpDialog } from "./HelpDialog";
import { ThemeToggle } from "./ThemeToggle";

export function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View className="flex-row items-center justify-between gap-2 px-4 py-3">
      <View className="flex-1">
        <Text className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{title}</Text>
        {subtitle ? <Text className="text-sm text-zinc-500">{subtitle}</Text> : null}
      </View>
      <View className="flex-row items-center gap-1">
        <LocaleSelector />
        <HelpDialog />
        <ThemeToggle />
      </View>
    </View>
  );
}
