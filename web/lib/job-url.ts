// web/lib/job-url.ts
// Normaliza/valida a URL opcional da vaga. Só http/https são aceitos:
// a URL é aberta em nova aba, então esquemas executáveis (javascript:,
// data:, etc.) nunca podem chegar ao `window.open`.

const UNSAFE_SCHEME = /^(javascript|data|vbscript|file|blob|mailto|tel|sms):/i;

export function normalizeJobUrl(raw: string): string {
  const s = (raw ?? "").trim();
  if (!s) return "";
  if (UNSAFE_SCHEME.test(s)) return "";
  const candidate = s.includes("://") ? s : `https://${s}`;
  try {
    const u = new URL(candidate);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "";
    return candidate;
  } catch {
    return "";
  }
}

export function isValidJobUrl(raw: string): boolean {
  return normalizeJobUrl(raw) !== "";
}
