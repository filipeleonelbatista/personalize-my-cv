const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function formatMesAno(yyyyMM: string): string {
  const m = yyyyMM.match(/^(\d{4})-(\d{2})$/);
  if (!m) return yyyyMM;
  const idx = Number(m[2]) - 1;
  if (idx < 0 || idx > 11) return yyyyMM;
  return `${MESES[idx]} ${m[1]}`;
}

export function formatPeriodo(p: { inicio: string; fim: string | null; atual: boolean }): string {
  const ini = formatMesAno(p.inicio);
  const fim = p.atual || !p.fim ? "atual" : formatMesAno(p.fim);
  return `${ini} – ${fim}`;
}

export function skillBullets(itens: string[], perBullet = 3, maxBullets = 6): string[] {
  const skills = itens.flatMap((s) => s.split(/[,;]/).map((x) => x.trim()).filter(Boolean));
  const out: string[] = [];
  for (let i = 0; i < skills.length && out.length < maxBullets; i += perBullet) {
    out.push(skills.slice(i, i + perBullet).join(", "));
  }
  return out;
}

export function skillColumns(itens: string[]): [string[], string[]] {
  const bullets = skillBullets(itens);
  return [bullets.slice(0, 3), bullets.slice(3, 6)];
}
