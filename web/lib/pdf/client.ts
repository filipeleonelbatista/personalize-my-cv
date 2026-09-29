// web/lib/pdf/client.ts
import { pdf } from "@react-pdf/renderer";
import { cvElement } from "./CVDocument";
import type { Resume } from "@/lib/resume-schema";
import type { BaseLang } from "@/lib/llm/prompts";
export async function resumeToBlob(resume: Resume, lang: BaseLang): Promise<Blob> {
  return pdf(cvElement(resume, lang)).toBlob();
}
export async function openResumePdf(resume: Resume, lang: BaseLang): Promise<void> {
  const blob = await resumeToBlob(resume, lang);
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank", "noopener");
  if (!win) {
    // Popup bloqueado — baixa o arquivo em vez de perder o PDF.
    const a = document.createElement("a");
    a.href = url;
    a.download = "curriculo.pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
