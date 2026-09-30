// In-memory SecureStore for tests (aliased in vitest.config.ts).
const mem = new Map<string, string>();
export function __clear() {
  mem.clear();
}
export async function getItemAsync(k: string): Promise<string | null> {
  return mem.get(k) ?? null;
}
export async function setItemAsync(k: string, v: string): Promise<void> {
  mem.set(k, v);
}
export async function deleteItemAsync(k: string): Promise<void> {
  mem.delete(k);
}
