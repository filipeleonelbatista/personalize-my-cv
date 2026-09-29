// web/lib/secure-store.ts
import SecureLS from "secure-ls";
const ls = new SecureLS({ encodingType: "aes" });
export function getSecure(key: string): string | null { try { return ls.get(key) as string | null; } catch { return localStorage.getItem(key); } }
export function setSecure(key: string, value: string): void { try { ls.set(key, value); } catch { localStorage.setItem(key, value); } }
export function removeSecure(key: string): void { try { ls.remove(key); } catch { localStorage.removeItem(key); } }
