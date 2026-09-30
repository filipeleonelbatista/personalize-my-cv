import { describe, expect, it } from "vitest";
import { buildFailedFileName, buildFileName, sanitizePart } from "../lib/filename";

describe("mobile filename", () => {
  it("sanitizes illegal chars and spaces", () => {
    expect(sanitizePart('A/B:C*?"<> D')).toBe("ABC_D");
  });
  it("builds timestamped names", () => {
    expect(buildFileName("Ana Souza", "Dev", "Acme")).toMatch(/^Ana_Souza_Dev_Acme_\d{8}-\d{6}\.pdf$/);
  });
  it("builds failed names", () => {
    expect(buildFailedFileName()).toMatch(/^failed_.*\.pdf$/);
  });
});
