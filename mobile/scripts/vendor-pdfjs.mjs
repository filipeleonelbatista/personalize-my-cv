// mobile/scripts/vendor-pdfjs.mjs
// Builds a single-file extract.html: pdf.min.mjs travels base64-encoded
// (raw inline would break on backticks/${} and its ESM exports would bind
// to nothing); the worker stays a template literal (already escaped).
// Re-run after pdfjs upgrades: node scripts/vendor-pdfjs.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "assets", "pdfjs");
const template = readFileSync(join(dir, "extract.template.html"), "utf8");
const pdfjs = readFileSync(join(dir, "pdf.min.mjs"));
const worker = readFileSync(join(dir, "pdf.worker.min.mjs"), "utf8")
  .replace(/`/g, "\\`")
  .replace(/\$/g, "\\$");

if (template.includes("__PDFJS_B64__") === false || template.includes("/*__WORKER__*/") === false) {
  throw new Error("template placeholders missing");
}
const html = template
  .replace("__PDFJS_B64__", () => Buffer.from(pdfjs).toString("base64"))
  .replace("/*__WORKER__*/", () => worker);
if (html.includes("__PDFJS_B64__") || html.includes("__WORKER__")) {
  throw new Error("unreplaced placeholder left in extract.html");
}
writeFileSync(join(dir, "extract.html"), html);
console.log("wrote assets/pdfjs/extract.html", html.length, "bytes");
