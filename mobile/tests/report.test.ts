import { describe, expect, it } from "vitest";
import { bucketByWeekday, weekRange } from "../lib/report";

describe("mobile report", () => {
  it("week starts on monday", () => {
    const { start, end } = weekRange(new Date("2026-09-30T12:00:00"), 0);
    expect(start.getDay()).toBe(1);
    expect(end.getDay()).toBe(0);
  });
  it("buckets by weekday mon-first", () => {
    const counts = bucketByWeekday([new Date("2026-09-28T10:00:00"), new Date("2026-09-28T11:00:00")]);
    expect(counts[0]).toBe(2);
    expect(counts.slice(1)).toEqual([0, 0, 0, 0, 0, 0]);
  });
});
