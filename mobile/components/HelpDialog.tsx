// mobile/components/HelpDialog.tsx
import { useState } from "react";
import { Pressable, Text, View, ScrollView } from "react-native";
import { useTranslations } from "../lib/i18n-provider";
import { ModalShell } from "./ModalShell";

export function HelpDialog() {
  const [open, setOpen] = useState(false);
  const t = useTranslations("Help");
  return (
    <View>
      <Pressable
        accessibilityLabel={t("open")}
        onPress={() => setOpen(true)}
        className="h-10 w-10 items-center justify-center rounded-full"
      >
        <Text className="text-xl">❓</Text>
      </Pressable>
      <ModalShell visible={open} onClose={() => setOpen(false)} title={t("title")}>
        <ScrollView>
          <Text className="mb-3 text-sm text-zinc-500">{t("desc")}</Text>
          {(["s1", "s2", "s3", "s4"] as const).map((s) => (
            <View key={s} className="mb-3">
              <Text className="text-sm font-bold text-zinc-900 dark:text-zinc-50">{t(`${s}t`)}</Text>
              <Text className="text-sm text-zinc-500">{t(`${s}d`)}</Text>
            </View>
          ))}
        </ScrollView>
      </ModalShell>
    </View>
  );
}
