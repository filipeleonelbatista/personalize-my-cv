import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
describe("static byok", () => {
  it("next config is export", () => {
    expect(readFileSync("next.config.ts", "utf8")).toContain('output: "export"');
  });
  it("no server leftovers", () => {
    expect(existsSync("lib/db.ts")).toBe(false);
    expect(existsSync("prisma")).toBe(false);
    expect(existsSync("app/actions.ts")).toBe(false);
    expect(existsSync("app/api")).toBe(false);
  });
  it("store keys documented", () => {
    expect(readFileSync("lib/store.ts", "utf8")).toContain("pmcv:base");
  });
});
