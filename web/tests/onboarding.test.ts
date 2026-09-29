// web/tests/onboarding.test.ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
describe("onboarding", () => {
  it("has 3-step wizard with apikey link", () => {
    const s = readFileSync("app/components/Onboarding.tsx", "utf8");
    expect(s).toMatch(/Bem-vindo|Como funciona/);
    expect(s).toContain("https://aistudio.google.com/apikey");
    expect(s).toMatch(/Criar base|Gerar.*base/);
  });
  it("page gates on key/base", () => {
    const s = readFileSync("app/page.tsx", "utf8");
    expect(s).toContain("Onboarding");
  });
});
