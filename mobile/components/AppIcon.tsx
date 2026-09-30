// mobile/components/AppIcon.tsx — vector icons (Ionicons, bundled in Expo Go).
import { Ionicons } from "@expo/vector-icons";
import type { ColorValue, StyleProp, TextStyle } from "react-native";

export type IconName =
  | "sun"
  | "moon"
  | "help"
  | "file"
  | "chart"
  | "download"
  | "share"
  | "retry"
  | "trash"
  | "eye"
  | "settings"
  | "upload"
  | "sparkles"
  | "check"
  | "copy"
  | "chevron-left"
  | "chevron-right"
  | "trending"
  | "close"
  | "square";

const MAP: Record<IconName, keyof typeof Ionicons.glyphMap> = {
  sun: "sunny",
  moon: "moon",
  help: "help-circle",
  file: "document-text",
  chart: "bar-chart",
  download: "download",
  share: "share-social",
  retry: "refresh",
  trash: "trash",
  eye: "eye",
  settings: "settings",
  upload: "cloud-upload",
  sparkles: "sparkles",
  check: "checkmark",
  copy: "copy",
  "chevron-left": "chevron-back",
  "chevron-right": "chevron-forward",
  trending: "trending-up",
  close: "close",
  square: "square-outline",
};

export function AppIcon({ name, size = 22, color, style }: { name: IconName; size?: number; color?: ColorValue; style?: StyleProp<TextStyle> }) {
  return <Ionicons name={MAP[name]} size={size} color={color} style={style} />;
}
