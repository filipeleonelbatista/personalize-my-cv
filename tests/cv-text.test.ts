import { describe, expect, it } from "vitest";
import { extractCvText } from "@/lib/cv-text";

describe("extractCvText", () => {
  it("throws friendly error on empty buffer", async () => {
    await expect(extractCvText(Buffer.from(""))).rejects.toThrow(/PDF/i);
  });
});
