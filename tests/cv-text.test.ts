import { describe, expect, it } from "vitest";
import React from "react";
import { Document, Page, Text, renderToBuffer } from "@react-pdf/renderer";
import { extractCvText } from "@/lib/cv-text";

describe("extractCvText", () => {
  it("throws friendly error on empty buffer", async () => {
    await expect(extractCvText(Buffer.from(""))).rejects.toThrow(/PDF/i);
  });
  it("extracts text from a real pdf", async () => {
    const buf = await renderToBuffer(
      React.createElement(Document, null, React.createElement(Page, null, React.createElement(Text, null, "Olá Filipe")) as never) as never
    );
    await expect(extractCvText(Buffer.from(buf))).resolves.toContain("Olá");
  }, 30000);
});
