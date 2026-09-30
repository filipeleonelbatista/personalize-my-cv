// mobile/lib/filename.ts
export function sanitizePart(s: string): string {
  return (s || "").trim().replace(/[/\\|:*?"<>]/g, "").replace(/\s+/g, "_").slice(0, 60) || "Vaga";
}

function stamp(d: Date): string {
  const p = (n: number, l = 2) => String(n).padStart(l, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export function buildFileName(nome: string, cargo: string, empresa: string, now = new Date()): string {
  return `${sanitizePart(nome)}_${sanitizePart(cargo)}_${sanitizePart(empresa)}_${stamp(now)}.pdf`;
}

export function buildFailedFileName(): string {
  return `failed_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.pdf`;
}
