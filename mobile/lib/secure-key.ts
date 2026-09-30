// mobile/lib/secure-key.ts
// Gemini key storage. Deliberately AsyncStorage (plaintext) per product
// decision — NOT the OS keychain. Same interface as before so callers
// don't change; see PROJECT.md warnings.
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "pmcv:gemini-key";

export async function getApiKey(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export async function setApiKey(key: string): Promise<void> {
  await AsyncStorage.setItem(KEY, key);
}

export async function clearApiKey(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    /* already gone */
  }
}
