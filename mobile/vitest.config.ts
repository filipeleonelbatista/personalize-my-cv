import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "@react-native-async-storage/async-storage": path.resolve(__dirname, "tests/__mocks__/async-storage.ts"),
      "expo-secure-store": path.resolve(__dirname, "tests/__mocks__/secure-store.ts"),
    },
  },
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
});
