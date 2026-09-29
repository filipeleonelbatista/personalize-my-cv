import { describe, expect, it } from "vitest";
import { buildFileName, buildFailedFileName } from "@/lib/filename";

describe("buildFileName", () => {
  it("builds Nome_Cargo_Empresa_timestamp", () => {
    const f = buildFileName("Filipe de Leonel Batista", "Front-end React", "CI&T", new Date("2026-09-25T14:30:00"));
    expect(f).toBe("Filipe_de_Leonel_Batista_Front-end_React_CI&T_20260925-143000.pdf");
  });
  it("strips slashes and colons", () => {
    const f = buildFileName("A", "Front-end/React", "X:Y", new Date("2026-01-02T03:04:05"));
    expect(f).not.toContain("/");
    expect(f).not.toContain(":");
    expect(f.endsWith(".pdf")).toBe(true);
  });
  it("builds unique failed filenames", () => {
    const a = buildFailedFileName();
    const b = buildFailedFileName();
    expect(a).not.toBe(b);
    expect(a.endsWith(".pdf")).toBe(true);
    expect(a).not.toContain("/");
  });
});
