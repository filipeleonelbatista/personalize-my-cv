// Test double for expo-sharing (aliased in vitest.config.ts).
export async function isAvailableAsync(): Promise<boolean> {
  return false;
}
export async function shareAsync(): Promise<void> {}
