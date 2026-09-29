// web/lib/secure-store.ts
import SecureLS from "secure-ls";

// Lazily instantiated: `new SecureLS()` reads localStorage at construction,
// which breaks static prerender (no window on the server). Deferring to first
// use keeps `output: "export"` builds green; all callers run client-side.
let _ls: SecureLS | null = null;
function sls(): SecureLS {
  if (!_ls) _ls = new SecureLS({ encodingType: "aes" });
  return _ls;
}
export function getSecure(key: string): string | null { try { return sls().get(key) as string | null; } catch { return localStorage.getItem(key); } }
export function setSecure(key: string, value: string): void { try { sls().set(key, value); } catch { localStorage.setItem(key, value); } }
export function removeSecure(key: string): void { try { sls().remove(key); } catch { localStorage.removeItem(key); } }
