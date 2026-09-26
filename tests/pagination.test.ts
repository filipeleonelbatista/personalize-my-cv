import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { paginate, PAGE_SIZES } from "@/lib/pagination";

describe("paginate", () => {
  it("computes pages and 1-based range", () => {
    expect(paginate(95, 1, 10)).toEqual({ page: 1, pageCount: 10, start: 1, end: 10 });
    expect(paginate(95, 10, 10)).toEqual({ page: 10, pageCount: 10, start: 91, end: 95 });
  });
  it("clamps out-of-range pages", () => {
    expect(paginate(5, 99, 10).page).toBe(1);
    expect(paginate(5, 0, 10).page).toBe(1);
  });
  it("handles empty lists", () => {
    expect(paginate(0, 1, 10)).toEqual({ page: 1, pageCount: 0, start: 0, end: 0 });
  });
  it("offers 10/25/50/100 page sizes", () => {
    expect(PAGE_SIZES).toEqual([10, 25, 50, 100]);
  });
});

describe("table pagination contract", () => {
  it("table has footer with page-size select", () => {
    const src = readFileSync("app/components/VacancyTable.tsx", "utf8");
    expect(src).toContain("por página");
    expect(src).toContain("setPageSize");
  });
});
