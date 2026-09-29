import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";

describe("scaffolding", () => {
  it("has env example with all providers", () => {
    const env = readFileSync(".env.example", "utf8");
    for (const k of ["GEMINI_API_KEY", "GEMINI_MODELS"]) {
      expect(env).toContain(k);
    }
  });
  it("has prisma schema with both models", () => {
    const s = readFileSync("prisma/schema.prisma", "utf8");
    expect(s).toContain("model BaseResume");
    expect(s).toContain("model TailoredApplication");
  });
  it("has generated dir gitkeep", () => {
    expect(existsSync("public/generated/.gitkeep")).toBe(true);
  });
});
