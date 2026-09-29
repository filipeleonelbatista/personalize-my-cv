import { describe, expect, it } from "vitest";
import React from "react";
import { Document, Page, Text, renderToBuffer } from "@react-pdf/renderer";
import { extractCvTextFromFile } from "@/lib/cv-text-client";

function toFile(buf: Buffer, name: string): File {
  const bytes = new Uint8Array(buf.length);
  bytes.set(buf);
  return new File([bytes], name, { type: "application/pdf" });
}

describe("extractCvTextFromFile", () => {
  it("throws friendly error on empty file", async () => {
    const f = new File([new Uint8Array(10)], "vazio.pdf", { type: "application/pdf" });
    await expect(extractCvTextFromFile(f)).rejects.toThrow(/PDF/i);
  });
  it("extracts text from a real pdf", async () => {
    const buf = await renderToBuffer(
      React.createElement(Document, null, React.createElement(Page, null, React.createElement(Text, null, "Olá Filipe")) as never) as never
    );
    const f = toFile(Buffer.from(buf), "cv.pdf");
    await expect(extractCvTextFromFile(f)).resolves.toContain("Olá");
  }, 30000);
});
