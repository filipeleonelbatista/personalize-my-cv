import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { deleteApplication } from "@/app/actions";

describe("deleteApplication", () => {
  it("returns not found for unknown id", async () => {
    await expect(deleteApplication(999999)).resolves.toEqual({ ok: false, error: "Registro não encontrado." });
  });
  it("table row has a delete action", () => {
    expect(readFileSync("app/components/VacancyTable.tsx", "utf8")).toContain("Excluir");
  });
});
