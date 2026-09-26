export const WEEKDAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function mondayOf(date: Date): Date {
  const d = startOfDay(date);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

export function weekRange(ref: Date, offsetWeeks: number): { start: Date; end: Date } {
  const clamped = Math.min(offsetWeeks, 0);
  const start = mondayOf(ref);
  start.setDate(start.getDate() + clamped * 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return { start, end };
}

export function bucketByWeekday(dates: Date[]): number[] {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const d of dates) {
    counts[(d.getDay() + 6) % 7] += 1;
  }
  return counts;
}

export function weekLabel(start: Date, end: Date): string {
  const fmt = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
  return `${fmt(start)} – ${fmt(end)}`;
}
