// Polyfill global localStorage from the test environment's own jsdom window.
// Node >= 22 declares globalThis.localStorage (gated behind --localstorage-file,
// left undefined without the flag); vitest's jsdom integration then skips copying
// the window's working localStorage, which breaks SecureLS (module-level
// `new SecureLS()` reads localStorage at import time) and any store code.
// No-op in non-jsdom environments (g.jsdom is only set by vitest's jsdom env).
const g = globalThis as unknown as Record<string, unknown>;
if (typeof g["localStorage"] === "undefined") {
  const win = (g["jsdom"] as { window?: { localStorage?: unknown } } | undefined)?.window;
  if (win?.localStorage) g["localStorage"] = win.localStorage;
}
