import { describe, expect, it } from "vitest";
import { buildFileName } from "../src/lib/filename.js";
import { bucketByWeekday, weekRange } from "../src/lib/report.js";
describe("pure", () => {
  it("builds stamped filename", () => {
    const n = buildFileName("Ana Souza", "Dev", "Acme", new Date("2026-01-05T10:20:30"));
    expect(n).toMatch(/^Ana_Souza_Dev_Acme_20260105-102030\.pdf$/);
  });
  it("monday-based week buckets mon=0", () => {
    const { start } = weekRange(new Date("2026-09-30T12:00:00"), 0);
    expect(start.getDay()).toBe(1);
    expect(bucketByWeekday([new Date("2026-09-28T10:00:00")])[0]).toBe(1);
  });
});
