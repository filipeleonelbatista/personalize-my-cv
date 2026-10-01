import { describe, expect, it, beforeEach, afterEach } from "vitest";
const PREV = process.env.PMCV_HOME;
beforeEach(() => {
  process.env.PMCV_HOME = `/tmp/opencode/pmcv-store-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
});
afterEach(() => {
  if (PREV === undefined) delete process.env.PMCV_HOME;
  else process.env.PMCV_HOME = PREV;
});
describe("store", () => {
  it("discards invalid apps on read, keeps valid", async () => {
    process.env.PMCV_HOME = "/tmp/opencode/pmcv-test-home";
    const { mkdirSync, writeFileSync } = await import("node:fs");
    mkdirSync(process.env.PMCV_HOME, { recursive: true });
    writeFileSync(`${process.env.PMCV_HOME}/apps.json`, JSON.stringify([{ bogus: 1 }]));
    const { saveApps, loadApps } = await import("../src/lib/store.js");
    saveApps([]);
    expect(loadApps()).toEqual([]);
  });
  it("maps unwritable home to PMCV_QUOTA", async () => {
    const { writeFileSync } = await import("node:fs");
    const blocker = `/tmp/opencode/pmcv-blocker-${Date.now()}`;
    writeFileSync(blocker, "x");
    process.env.PMCV_HOME = blocker;
    const { saveConfig } = await import("../src/lib/store.js");
    await expect(
      (async () => saveConfig({ geminiKey: "k", models: ["m"], locale: "pt-BR" }))(),
    ).rejects.toThrow("PMCV_QUOTA");
  });
});
