// mobile/lib/secure-key.ts
import * as SecureStore from "expo-secure-store";

const KEY = "pmcv:gemini-key";

export async function getApiKey(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(KEY);
  } catch {
    return null;
  }
}

export async function setApiKey(key: string): Promise<void> {
  await SecureStore.setItemAsync(KEY, key);
}

export async function clearApiKey(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    /* already gone */
  }
}
