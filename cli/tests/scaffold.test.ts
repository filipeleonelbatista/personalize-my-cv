import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
describe("scaffold", () => {
  it("exposes bin personalize-cv", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    expect(pkg.bin["personalize-cv"]).toBe("./dist/index.js");
  });
  it("has type module + node engine", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    expect(pkg.type).toBe("module");
    expect(existsSync("tsconfig.json")).toBe(true);
  });
});
