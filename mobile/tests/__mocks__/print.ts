// Test double for expo-print (aliased in vitest.config.ts).
export async function printToFileAsync(): Promise<{ uri: string }> {
  return { uri: "/mock.pdf" };
}
