// @vitest-environment jsdom
// Pins the pdf.js extraction path: a minimal valid uncompressed PDF (built
// in-memory, no fixtures) must yield its text via extractCvTextFromFile.
import { describe, expect, it } from "vitest";
import { extractCvTextFromFile } from "@/lib/cv-text-client";

function miniPdf(lines: string[]): Uint8Array {
  const content = new TextEncoder().encode(
    lines.map((t, i) => `BT /F1 12 Tf 100 ${700 - i * 20} Td (${t}) Tj ET`).join("\n"),
  );
  const enc = new TextEncoder();
  const objs: Uint8Array[] = [
    enc.encode("<< /Type /Catalog /Pages 2 0 R >>"),
    enc.encode("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
    enc.encode("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>"),
    new Uint8Array([...enc.encode(`<< /Length ${content.length} >>\nstream\n`), ...content, ...enc.encode("\nendstream")]),
    enc.encode("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"),
  ];
  const parts: Uint8Array[] = [enc.encode("%PDF-1.4\n")];
  const offsets: number[] = [];
  let len = parts[0].length;
  objs.forEach((body, i) => {
    const head = enc.encode(`${i + 1} 0 obj\n`);
    const tail = enc.encode("\nendobj\n");
    offsets.push(len);
    parts.push(head, body, tail);
    len += head.length + body.length + tail.length;
  });
  parts.push(enc.encode(`xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`));
  for (const o of offsets) parts.push(enc.encode(`${String(o).padStart(10, "0")} 00000 n \n`));
  parts.push(enc.encode(`trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${len}\n%%EOF`));
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

describe("cv-text-client extraction", () => {
  it("extracts text from a valid pdf", async () => {
    const bytes = miniPdf(["Ana Dev Curitiba"]);
    const text = await extractCvTextFromFile(
      new File([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer], "mini.pdf", { type: "application/pdf" }),
    );
    expect(text).toContain("Ana Dev Curitiba");
  }, 90000);
});
