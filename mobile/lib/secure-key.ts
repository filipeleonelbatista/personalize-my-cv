// mobile/lib/secure-key.ts
// Gemini key storage in the OS keychain via expo-secure-store.
// SecureStore keys may contain alphanumeric characters, ".", "-" and "_"
// only — the legacy "pmcv:gemini-key" (with ":") is invalid, hence the
// compliant KEY below plus one-way migration from AsyncStorage.
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "pmcv_gemini_key";
const LEGACY_KEY = "pmcv:gemini-key";

export async function getApiKey(): Promise<string | null> {
  try {
    const current = await SecureStore.getItemAsync(KEY);
    if (current) return current;
  } catch {
    return null;
  }
  // One-way migration from the plaintext legacy slot.
  try {
    const legacy = await AsyncStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const trimmed = legacy.trim();
      if (trimmed) {
        try {
          await SecureStore.setItemAsync(KEY, trimmed);
        } catch {
          return trimmed;
        }
      }
      await AsyncStorage.removeItem(LEGACY_KEY);
      return trimmed || null;
    }
  } catch {
    /* no legacy value */
  }
  return null;
}

export async function setApiKey(key: string): Promise<void> {
  const trimmed = key.trim();
  await SecureStore.setItemAsync(KEY, trimmed);
}

export async function clearApiKey(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    /* already gone */
  }
  try {
    await AsyncStorage.removeItem(LEGACY_KEY);
  } catch {
    /* already gone */
  }
}
