// web/tests/onboarding.test.ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
describe("onboarding", () => {
  it("has 3-step wizard with apikey link", () => {
    const s = readFileSync("app/components/Onboarding.tsx", "utf8");
    expect(s).toContain('useTranslations("Onboarding")');
    expect(s).toContain("https://aistudio.google.com/apikey");
    expect(s).toMatch(/createTitle|createBtn/);
    const pt = JSON.parse(readFileSync("messages/pt-BR.json", "utf8"));
    expect(pt.Onboarding.welcomeTitle).toMatch(/Bem-vindo/);
  });
  it("page gates on key/base", () => {
    const s = readFileSync("app/page.tsx", "utf8");
    expect(s).toContain("Onboarding");
  });
  it("redesigned wizard has stepper, icons and confetti success screen", () => {
    const s = readFileSync("app/components/Onboarding.tsx", "utf8");
    expect(s).toContain("Stepper");
    expect(s).toContain("stepName1");
    expect(s).toContain("canvas-confetti");
    expect(s).toContain("celebrate()");
    expect(s).toContain("setStep(3)");
    expect(s).toContain("successTitle");
    expect(s).toContain("goBtn");
    const pt = JSON.parse(readFileSync("messages/pt-BR.json", "utf8"));
    expect(pt.Onboarding.goBtn).toBe("Começar a usar");
    expect(pt.Onboarding.successTitle).toBe("Currículo base criado!");
  });
  it("seo metadata is complete with canonical and language alternates", () => {
    const s = readFileSync("app/layout.tsx", "utf8");
    expect(s).toContain("metadataBase");
    expect(s).toContain("personalize-my-cv.vercel.app");
    expect(s).toContain("alternates");
    expect(s).toContain("languages");
    expect(s).toContain("openGraph");
    expect(s).toContain("url:");
    expect(s).toContain("Currículos sob medida com IA");
  });
});
