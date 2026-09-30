import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";

describe("screens contract", () => {
  it("routes and screens exist", () => {
    for (const f of [
      "app/index.tsx",
      "app/onboarding.tsx",
      "app/(tabs)/_layout.tsx",
      "app/(tabs)/curriculos.tsx",
      "app/(tabs)/relatorios.tsx",
      "app/settings.tsx",
    ]) {
      expect(existsSync(f), f).toBe(true);
    }
  });
  it("header cluster on every screen", () => {
    const header = readFileSync("components/Header.tsx", "utf8");
    expect(header).toMatch(/LocaleSelector/);
    expect(header).toMatch(/HelpDialog/);
    expect(header).toMatch(/ThemeToggle/);
    for (const f of ["app/onboarding.tsx", "app/(tabs)/curriculos.tsx", "app/(tabs)/relatorios.tsx", "app/settings.tsx"]) {
      expect(readFileSync(f, "utf8"), f).toMatch(/Header/);
    }
  });
  it("no hardcoded UI strings outside messages", () => {
    for (const f of [
      "components/GenerateSheet.tsx",
      "components/VacancyCard.tsx",
      "components/DetailSheet.tsx",
      "components/ReportsView.tsx",
      "components/SettingsSheet.tsx",
    ]) {
      const s = readFileSync(f, "utf8");
      expect(s, f).not.toMatch(/Currículos|Relatórios|Personalizar com IA|Baixar|Excluir|Configurações/);
    }
  });
  it("settings offers base update reusing the pick step", () => {
    expect(existsSync("components/UpdateBaseSheet.tsx")).toBe(true);
    expect(existsSync("components/BasePickStep.tsx")).toBe(true);
    const w = readFileSync("components/OnboardingWizard.tsx", "utf8");
    expect(w).toContain("BasePickStep");
    const s = readFileSync("app/settings.tsx", "utf8");
    expect(s).toMatch(/UpdateBaseSheet/);
  });
  it("detail can download the PDF to the device library", () => {
    const d = readFileSync("components/DetailSheet.tsx", "utf8");
    expect(d).toMatch(/downloadResumePdf/);
    const lib = readFileSync("lib/pdf-share.ts", "utf8");
    expect(lib).toContain("downloadResumePdf");
    expect(lib).toMatch(/MediaLibrary|media-library/);
  });
});
