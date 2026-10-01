import { describe, expect, it } from "vitest";
describe("store", () => {
  it("discards invalid apps on read, keeps valid", async () => {
    process.env.PMCV_HOME = "/tmp/opencode/pmcv-test-home";
    const { mkdirSync, writeFileSync } = await import("node:fs");
    mkdirSync(process.env.PMCV_HOME, { recursive: true });
    writeFileSync(`${process.env.PMCV_HOME}/apps.json`, JSON.stringify([{ bogus: 1 }]));
    const { loadApps } = await import("../src/lib/store.js");
    expect(loadApps()).toEqual([]);
  });
});
