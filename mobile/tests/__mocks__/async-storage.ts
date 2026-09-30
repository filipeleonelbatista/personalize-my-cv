// In-memory AsyncStorage for tests (aliased in vitest.config.ts).
const mem = new Map<string, string>();
export function __clear() {
  mem.clear();
}
export default {
  getItem: async (k: string): Promise<string | null> => mem.get(k) ?? null,
  setItem: async (k: string, v: string): Promise<void> => {
    mem.set(k, v);
  },
  removeItem: async (k: string): Promise<void> => {
    mem.delete(k);
  },
};
