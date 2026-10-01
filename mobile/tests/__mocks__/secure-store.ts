// In-memory SecureStore for tests (aliased in vitest.config.ts).
// Enforces the same key charset as the real expo-secure-store:
// keys may contain alphanumeric characters, `.`, `-`, and `_` only.
const mem = new Map<string, string>();

const VALID_KEY = /^[A-Za-z0-9.\-_]+$/;

export function __clear() {
  mem.clear();
}
export function __store() {
  return mem;
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  if (!VALID_KEY.test(key)) {
    throw new Error(`Invalid SecureStore key "${key}". Keys may contain alphanumeric characters, ".", "-", and "_" only.`);
  }
  mem.set(key, value);
}

export async function getItemAsync(key: string): Promise<string | null> {
  if (!VALID_KEY.test(key)) {
    throw new Error(`Invalid SecureStore key "${key}". Keys may contain alphanumeric characters, ".", "-", and "_" only.`);
  }
  return mem.get(key) ?? null;
}

export async function deleteItemAsync(key: string): Promise<void> {
  if (!VALID_KEY.test(key)) {
    throw new Error(`Invalid SecureStore key "${key}". Keys may contain alphanumeric characters, ".", "-", and "_" only.`);
  }
  mem.delete(key);
}

export default { setItemAsync, getItemAsync, deleteItemAsync };
