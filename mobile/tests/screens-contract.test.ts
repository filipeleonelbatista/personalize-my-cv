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
  it("scroll containers fill remaining space (no cut-off content)", () => {
    const list = readFileSync("app/(tabs)/curriculos.tsx", "utf8");
    expect(list).toMatch(/<FlatList[\s\S]*?className="[^"]*flex-1/);
    const settings = readFileSync("components/SettingsSheet.tsx", "utf8");
    expect(settings).toMatch(/<ScrollView[^>]*className="[^"]*flex-1/);
  });
  it("detail can download the PDF to the device library", () => {
    const d = readFileSync("components/DetailSheet.tsx", "utf8");
    expect(d).toMatch(/downloadResumePdf/);
    const lib = readFileSync("lib/pdf-share.ts", "utf8");
    expect(lib).toContain("downloadResumePdf");
    expect(lib).toMatch(/MediaLibrary|media-library/);
  });
  it("inputs respect dark mode placeholders", () => {
    const form = readFileSync("components/FormInput.tsx", "utf8");
    expect(form).toMatch(/placeholderTextColor/);
    expect(form).toMatch(/resolved === "dark"/);
    for (const f of ["components/GenerateSheet.tsx", "components/OnboardingWizard.tsx", "components/SettingsSheet.tsx"]) {
      const s = readFileSync(f, "utf8");
      expect(s, `${f} raw TextInput`).not.toMatch(/<TextInput/);
      expect(s, `${f} uses FormInput`).toMatch(/<FormInput/);
    }
  });
  it("screens respect status bar and navigation safe areas", () => {
    for (const f of ["app/onboarding.tsx", "app/(tabs)/curriculos.tsx", "app/(tabs)/relatorios.tsx", "app/settings.tsx"]) {
      const s = readFileSync(f, "utf8");
      expect(s, f).toMatch(/SafeAreaView/);
    }
    const layout = readFileSync("app/_layout.tsx", "utf8");
    expect(layout).toMatch(/SafeAreaProvider/);
  });
  it("forms avoid the keyboard", () => {
    expect(readFileSync("components/ModalShell.tsx", "utf8")).toMatch(/KeyboardAvoidingView/);
    for (const f of ["app/onboarding.tsx", "app/settings.tsx"]) {
      expect(readFileSync(f, "utf8"), f).toMatch(/KeyboardAvoidingView/);
    }
  });
  it("settings scrolls focused inputs above the keyboard", () => {
    const s = readFileSync("components/SettingsSheet.tsx", "utf8");
    expect(s).toMatch(/scrollToEnd/);
    expect(s).toMatch(/keyboardShouldPersistTaps="handled"/);
  });
  it("uses vector icons, never emoji", () => {
    const files = [
      "components/HelpDialog.tsx",
      "components/ThemeToggle.tsx",
      "components/SettingsSheet.tsx",
      "components/SplashScreen.tsx",
      "components/VacancyCard.tsx",
      "components/DetailSheet.tsx",
      "components/GenerateSheet.tsx",
      "components/ReportsView.tsx",
      "app/(tabs)/curriculos.tsx",
      "app/(tabs)/_layout.tsx",
    ];
    for (const f of files) {
      const s = readFileSync(f, "utf8");
      expect(s, f).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/u);
    }
    expect(readFileSync("components/AppIcon.tsx", "utf8")).toMatch(/Ionicons/);
  });
  it("loading states animate with staged steps", () => {
    for (const f of ["components/GenerateSheet.tsx", "components/BasePickStep.tsx"]) {
      const s = readFileSync(f, "utf8");
      expect(s, f).toMatch(/ActivityIndicator/);
      expect(s, f).toMatch(/useStagedSteps/);
    }
    expect(existsSync("lib/use-staged-steps.ts")).toBe(true);
  });
});
