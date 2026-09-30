// mobile/scripts/vendor-pdfjs.mjs
// Inlines pdf.min.mjs + worker into a single extract.html (no relative
// paths, no MIME issues inside the WebView). Re-run after pdfjs upgrades:
//   node scripts/vendor-pdfjs.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "assets", "pdfjs");
const template = readFileSync(join(dir, "extract.template.html"), "utf8");
const pdfjs = readFileSync(join(dir, "pdf.min.mjs"), "utf8");
const worker = readFileSync(join(dir, "pdf.worker.min.mjs"), "utf8").replace(/`/g, "\\`").replace(/\$/g, "\\$");

const html = template.replace("/*__PDFJS__*/", () => pdfjs).replace("/*__WORKER__*/", () => worker);
writeFileSync(join(dir, "extract.html"), html);
console.log("wrote assets/pdfjs/extract.html", html.length, "bytes");
