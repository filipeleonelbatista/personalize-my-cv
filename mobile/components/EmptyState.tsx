// mobile/components/EmptyState.tsx
import { Text, View } from "react-native";

export function EmptyState({ message }: { message: string }) {
  return (
    <View className="items-center gap-2 rounded-xl border border-zinc-200 p-8 dark:border-zinc-800">
      <Text className="text-center text-sm text-zinc-500">{message}</Text>
    </View>
  );
}
