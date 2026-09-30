// mobile/components/FormInput.tsx — TextInput with theme-aware placeholder.
import { TextInput, type TextInputProps } from "react-native";
import { useTheme } from "../lib/theme";

export function FormInput({ className, ...props }: TextInputProps & { className?: string }) {
  const { resolved } = useTheme();
  return (
    <TextInput
      placeholderTextColor={resolved === "dark" ? "#a1a1aa" : "#71717a"}
      {...props}
      className={`rounded-xl border border-zinc-300 p-3 text-base text-zinc-900 dark:border-zinc-700 dark:text-zinc-50 ${className ?? ""}`}
    />
  );
}
