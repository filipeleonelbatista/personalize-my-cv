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
  it("base print route exists and page links it", () => {
    expect(existsSync("app/api/base/pdf/route.ts")).toBe(true);
    expect(readFileSync("app/api/base/pdf/route.ts", "utf8")).toContain("application/pdf");
    expect(readFileSync("app/page.tsx", "utf8")).toContain("/api/base/pdf");
  });
  it("generate modal has short IA label and per-vacancy language select", () => {
    const src = readFileSync("app/components/GenerateModal.tsx", "utf8");
    expect(src).toContain("Personalizar com IA");
    expect(src).not.toContain("Gerar outro currículo");
    expect(src).toContain('name="lang"');
  });
  it("tailored print route exists and table links it", () => {
    expect(existsSync("app/api/applications/[id]/pdf/route.ts")).toBe(true);
    expect(readFileSync("app/api/applications/[id]/pdf/route.ts", "utf8")).toContain("application/pdf");
    expect(readFileSync("app/components/VacancyTable.tsx", "utf8")).toContain("/api/applications/");
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
});

describe("base setup dialog", () => {
  it("opens BaseSetup inside a dialog from a button", () => {
    expect(existsSync("app/components/BaseSetupDialog.tsx")).toBe(true);
    const dlg = readFileSync("app/components/BaseSetupDialog.tsx", "utf8");
    expect(dlg).toContain("BaseSetup");
    expect(dlg).toContain("Dialog");
    const page = readFileSync("app/page.tsx", "utf8");
    expect(page).toContain("BaseSetupDialog");
  });
});
