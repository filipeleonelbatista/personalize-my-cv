// mobile/lib/toast.ts
import Toast from "react-native-toast-message";

export function toast(msg: string): void {
  Toast.show({ type: "success", text1: msg });
}

export function toastError(title: string, desc?: string): void {
  Toast.show({ type: "error", text1: title, text2: desc });
}
