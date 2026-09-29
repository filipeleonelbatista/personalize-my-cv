import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { weekRange, bucketByWeekday, WEEKDAY_LABELS } from "@/lib/report";

describe("weekRange", () => {
  it("returns Monday to Sunday of the current week", () => {
    const { start, end } = weekRange(new Date("2026-09-25T12:00:00"), 0);
    expect(start.getDay()).toBe(1);
    expect(end.getDay()).toBe(0);
    expect(end.getTime() - start.getTime()).toBe(6 * 24 * 3600 * 1000);
  });
  it("shifts whole weeks back and forth", () => {
    const a = weekRange(new Date("2026-09-25T12:00:00"), 0);
    const b = weekRange(new Date("2026-09-25T12:00:00"), -1);
    expect(a.start.getTime() - b.start.getTime()).toBe(7 * 24 * 3600 * 1000);
  });
  it("clamps future offsets to current week", () => {
    const a = weekRange(new Date("2026-09-25T12:00:00"), 0);
    const b = weekRange(new Date("2026-09-25T12:00:00"), 5);
    expect(b.start.getTime()).toBe(a.start.getTime());
  });
});

describe("bucketByWeekday", () => {
  it("counts Mon-Sun buckets starting Monday", () => {
    expect(WEEKDAY_LABELS).toEqual(["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]);
    const counts = bucketByWeekday([new Date("2026-09-21T10:00:00"), new Date("2026-09-21T15:00:00"), new Date("2026-09-27T10:00:00")]);
    expect(counts).toEqual([2, 0, 0, 0, 0, 0, 1]);
  });
});

describe("reports ui contract", () => {
  it("tabs and reports files exist", () => {
    for (const f of ["app/components/ui/tabs.tsx", "app/components/ReportsSection.tsx", "app/components/DashboardTabs.tsx", "lib/report.ts"]) {
      expect(existsSync(f), f).toBe(true);
    }
    expect(readFileSync("app/components/DashboardTabs.tsx", "utf8")).toContain("Relatórios");
    const tabs = readFileSync("app/components/ui/tabs.tsx", "utf8");
    expect(tabs).toContain("createContext");
    expect(tabs).not.toContain("cloneElement");
  });
});
