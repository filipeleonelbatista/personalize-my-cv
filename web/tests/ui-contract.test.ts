import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";

describe("ui contract", () => {
  it("page and components exist", () => {
    for (const f of ["app/page.tsx", "app/components/BaseSetup.tsx", "app/components/VacancyTable.tsx", "app/components/GenerateModal.tsx", "app/components/DetailDrawer.tsx"]) {
      expect(existsSync(f), f).toBe(true);
    }
    expect(readFileSync("app/components/VacancyTable.tsx", "utf8")).toContain("Tentar novamente");
  });
  it("generate modal keeps the error visible on failure", () => {
    const src = readFileSync("app/components/GenerateModal.tsx", "utf8");
    expect(src).toContain("setError(r.error)");
    expect(src).not.toContain("if (r.id)");
  });
  it("base print is client-side via openResumePdf (no server route)", () => {
    const menu = readFileSync("app/components/BaseMenu.tsx", "utf8");
    expect(menu).toContain("openResumePdf");
    expect(menu).not.toContain("/api/");
    expect(menu).not.toContain("../actions");
  });
  it("generate modal has short IA label and per-vacancy language select", () => {
    const src = readFileSync("app/components/GenerateModal.tsx", "utf8");
    expect(src).toContain("Personalizar com IA");
    expect(src).not.toContain("Gerar outro currículo");
    expect(src).toContain('name="lang"');
  });
  it("tailored download is client-side via blob URL (no server route)", () => {
    const table = readFileSync("app/components/VacancyTable.tsx", "utf8");
    expect(table).toContain("resumeToBlob");
    expect(table).not.toContain("/api/applications/");
    expect(table).not.toContain("../actions");
    const drawer = readFileSync("app/components/DetailDrawer.tsx", "utf8");
    expect(drawer).toContain("StoredApp");
    expect(drawer).not.toContain("pdfPath");
    expect(drawer).not.toContain("id: number");
    expect(drawer).not.toContain("/api/");
  });
  it("redesign system exists (ui kit, dark mode, theme toggle)", () => {    for (const f of ["app/components/ui/button.tsx", "app/components/ui/card.tsx", "app/components/ui/dialog.tsx",
      "app/components/ui/table.tsx", "app/components/ui/badge.tsx", "app/components/ui/select.tsx",
      "app/components/ui/textarea.tsx", "app/components/ui/skeleton.tsx", "app/components/ui/progress.tsx",
      "app/components/theme-toggle.tsx", "app/components/ui/dropzone.tsx"]) {
      expect(existsSync(f), f).toBe(true);
    }
    const css = readFileSync("app/globals.css", "utf8");
    expect(css).toContain("@custom-variant dark");
    expect(css).toContain("--background");
    expect(readFileSync("app/layout.tsx", "utf8")).toContain("ThemeProvider");
  });
  it("layout has developer footer with linkedin", () => {
    const src = readFileSync("app/layout.tsx", "utf8");
    expect(src).toContain("filipeleonelbatista");
    expect(src).toContain("linkedin.com/in/filipeleonelbatista");
  });
});

describe("base setup dialog", () => {
  it("opens BaseSetup inside a dialog from a button", () => {
    expect(existsSync("app/components/BaseSetupDialog.tsx")).toBe(true);
    const dlg = readFileSync("app/components/BaseSetupDialog.tsx", "utf8");
    expect(dlg).toContain("BaseSetup");
    expect(dlg).toContain("Dialog");
    const page = readFileSync("app/page.tsx", "utf8");
    expect(page).toContain("BaseSetupDialog");
    expect(page).toContain("DashboardTabs");
    expect(readFileSync("app/components/DashboardTabs.tsx", "utf8")).toContain("BaseMenu");
  });
});

describe("base gear menu", () => {
  it("groups print and update actions under a gear dropdown", () => {
    expect(existsSync("app/components/ui/dropdown.tsx")).toBe(true);
    expect(existsSync("app/components/BaseMenu.tsx")).toBe(true);
    const menu = readFileSync("app/components/BaseMenu.tsx", "utf8");
    expect(menu).toContain("openResumePdf");
    expect(menu).toContain("BaseSetup");
    expect(menu).toContain("Atualizar currículo");
    expect(readFileSync("app/components/DashboardTabs.tsx", "utf8")).toContain("BaseMenu");
  });
});

describe("client dashboard", () => {
  it("GenerateModal uses store+generateJson, not actions", () => {
    const s = readFileSync("app/components/GenerateModal.tsx", "utf8");
    expect(s).toContain("@/lib/store");
    expect(s).not.toContain("../actions");
  });
  it("VacancyTable deletes from store", () => {
    const s = readFileSync("app/components/VacancyTable.tsx", "utf8");
    expect(s).toContain("saveApps");
  });
  it("dashboard syncs across tabs", () => {
    const s = readFileSync("app/components/DashboardTabs.tsx", "utf8");
    expect(s).toContain("storage");
  });
  it("no dashboard component imports server actions or /api/ routes", () => {
    for (const f of [
      "app/page.tsx",
      "app/components/GenerateModal.tsx",
      "app/components/VacancyTable.tsx",
      "app/components/DetailDrawer.tsx",
      "app/components/ReportsSection.tsx",
      "app/components/DashboardTabs.tsx",
      "app/components/BaseMenu.tsx",
      "app/components/BaseSetup.tsx",
    ]) {
      const s = readFileSync(f, "utf8");
      expect(s, f).not.toContain("../actions");
      expect(s, f).not.toContain("/api/");
    }
  });
  it("reports are computed client-side from the store", () => {
    const s = readFileSync("app/components/ReportsSection.tsx", "utf8");
    expect(s).toContain("loadApps");
    expect(s).toContain("bucketByWeekday");
    expect(s).not.toContain("../actions");
  });
});

describe("settings dialog (post-onboarding)", () => {
  it("is mounted on the dashboard toolbar", () => {
    const tabs = readFileSync("app/components/DashboardTabs.tsx", "utf8");
    expect(tabs).toContain("SettingsDialog");
    expect(tabs).toContain("<SettingsDialog />");
    expect(readFileSync("app/components/SettingsDialog.tsx", "utf8")).toContain("Configurações");
  });
  it("has models selector, clear-key and backup export/import", () => {
    const s = readFileSync("app/components/SettingsDialog.tsx", "utf8");
    expect(s).toContain("loadSettings");
    expect(s).toContain("saveSettings");
    expect(s).toContain("clearSettings");
    expect(s).toContain("exportBackup");
    expect(s).toContain("importBackup");
    expect(s).toMatch(/Models|models/);
    expect(s).toContain("key.trim()");
  });
  it("quota failures surface backup guidance where saves can throw", () => {
    for (const f of ["app/components/GenerateModal.tsx", "app/components/Onboarding.tsx", "app/components/BaseSetup.tsx", "app/components/VacancyTable.tsx"]) {
      expect(readFileSync(f, "utf8"), f).toContain("Armazenamento cheio");
    }
    expect(readFileSync("lib/store.ts", "utf8")).toContain("QUOTA_MESSAGE");
  });
  it("page gates on isOnboarded with cross-tab storage sync", () => {
    const s = readFileSync("app/page.tsx", "utf8");
    expect(s).toContain("isOnboarded");
    expect(s).toContain("storage");
  });
});
