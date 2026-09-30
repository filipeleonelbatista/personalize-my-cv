// mobile/components/ModalShell.tsx
import { KeyboardAvoidingView, Modal, Platform, Pressable, Text, View } from "react-native";
import type { ReactNode } from "react";

export function ModalShell({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: ReactNode }) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1">
        <Pressable className="flex-1 justify-end bg-black/50" onPress={onClose}>
          <Pressable className="max-h-[85%] rounded-t-3xl bg-white p-5 dark:bg-zinc-900" onPress={() => {}}>
            <Text className="mb-3 text-lg font-bold text-zinc-900 dark:text-zinc-50">{title}</Text>
            {children}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
