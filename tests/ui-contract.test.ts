import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";

describe("ui contract", () => {
  it("page and components exist", () => {
    for (const f of ["app/page.tsx", "app/components/BaseSetup.tsx", "app/components/VacancyTable.tsx", "app/components/GenerateModal.tsx", "app/components/DetailDrawer.tsx"]) {
      expect(existsSync(f), f).toBe(true);
    }
    expect(readFileSync("app/components/VacancyTable.tsx", "utf8")).toContain("Tentar novamente");
  });
});
