import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { db } from "@/lib/db";
import { parseResume } from "@/lib/resume-schema";
import { parseBaseLang } from "@/lib/llm/prompts";
import { cvElement } from "@/lib/pdf/CVDocument";
import { sanitizePart } from "@/lib/filename";

export async function GET() {
  const row = await db.baseResume.findUnique({ where: { id: 1 } });
  if (!row) return NextResponse.json({ error: "Currículo base não cadastrado." }, { status: 404 });
  let resume;
  try {
    resume = parseResume(JSON.parse(row.json));
  } catch {
    return NextResponse.json({ error: "Currículo base inválido. Reenvie o PDF." }, { status: 422 });
  }
  const buf = await renderToBuffer(cvElement(resume, parseBaseLang(row.lang)));
  const fileName = `${sanitizePart(resume.cabecalho.nome)}_Base.pdf`;
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${fileName}"`,
    },
  });
}
