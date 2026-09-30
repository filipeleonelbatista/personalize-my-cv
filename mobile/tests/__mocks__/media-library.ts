// Test double for expo-media-library (aliased in vitest.config.ts).
export async function requestPermissionsAsync(): Promise<{ status: string }> {
  return { status: "granted" };
}
export async function createAssetAsync(uri: string): Promise<{ uri: string }> {
  return { uri };
}
