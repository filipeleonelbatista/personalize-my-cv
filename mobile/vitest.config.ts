import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(__dirname, ".") },
      { find: "expo-file-system/legacy", replacement: path.resolve(__dirname, "tests/__mocks__/file-system.ts") },
      { find: "@react-native-async-storage/async-storage", replacement: path.resolve(__dirname, "tests/__mocks__/async-storage.ts") },
      { find: "expo-secure-store", replacement: path.resolve(__dirname, "tests/__mocks__/secure-store.ts") },
      { find: "expo-document-picker", replacement: path.resolve(__dirname, "tests/__mocks__/document-picker.ts") },
      { find: "expo-file-system", replacement: path.resolve(__dirname, "tests/__mocks__/file-system.ts") },
      { find: "expo-print", replacement: path.resolve(__dirname, "tests/__mocks__/print.ts") },
      { find: "expo-media-library", replacement: path.resolve(__dirname, "tests/__mocks__/media-library.ts") },
      { find: "expo-sharing", replacement: path.resolve(__dirname, "tests/__mocks__/sharing.ts") },
    ],
  },
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
});
