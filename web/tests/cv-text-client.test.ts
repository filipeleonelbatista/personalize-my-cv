// web/tests/cv-text-client.test.ts
import { describe, expect, it } from "vitest";
import { extractCvTextFromFile } from "@/lib/cv-text-client";
describe("cv-text-client", () => {
  it("rejects non-pdf", async () => {
    await expect(extractCvTextFromFile(new File(["x"], "a.txt", { type: "text/plain" }))).rejects.toThrow(/PDF/);
  });
});
