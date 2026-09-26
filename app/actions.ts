"use server";

import { renderToFile } from "@react-pdf/renderer";
import { db } from "@/lib/db";
import { extractCvText } from "@/lib/cv-text";
import { parseResume, parseEnvelope, type Resume } from "@/lib/resume-schema";
import { generateJson } from "@/lib/llm/chain";
import { BASE_EXTRACT_SYSTEM, TAILOR_SYSTEM, buildTailorUser, buildRepairUser } from "@/lib/llm/prompts";
import { buildFileName } from "@/lib/filename";
import { cvElement } from "@/lib/pdf/CVDocument";

export async function getBase(): Promise<Resume | null> {
  const row = await db.baseResume.findUnique({ where: { id: 1 } });
  return row ? (JSON.parse(row.json) as Resume) : null;
}

export async function uploadBase(formData: FormData): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const file = formData.get("pdf") as File | null;
    if (!file) return { ok: false, error: "Envie um arquivo PDF." };
    const text = await extractCvText(Buffer.from(await file.arrayBuffer()));
    const { data } = await generateJson(BASE_EXTRACT_SYSTEM, text.slice(0, 12000));
    try {
      const resume = parseResume(data);
      await db.baseResume.upsert({
        where: { id: 1 },
        create: { id: 1, json: JSON.stringify(resume) },
        update: { json: JSON.stringify(resume) },
      });
      return { ok: true };
    } catch (zerr) {
      const { data: fixed } = await generateJson(BASE_EXTRACT_SYSTEM, buildRepairUser(JSON.stringify(data), String(zerr)));
      const resume = parseResume(fixed);
      await db.baseResume.upsert({
        where: { id: 1 },
        create: { id: 1, json: JSON.stringify(resume) },
        update: { json: JSON.stringify(resume) },
      });
      return { ok: true };
    }
  } catch (e) {
    return { ok: false, error: (e as Error).message.slice(0, 500) };
  }
}

export async function listApplications() {
  return db.tailoredApplication.findMany({ orderBy: { createdAt: "desc" } });
}

export async function tailorResume(jobText: string): Promise<{ ok: true; id: number } | { ok: false; error: string; id?: number }> {
  if (!jobText || jobText.trim().length < 20) return { ok: false, error: "Cole o texto da vaga (mín. 20 caracteres)." };
  try {
    const base = await getBase();
    if (!base) return { ok: false, error: "Cadastre o currículo base primeiro." };
    const { data } = await generateJson(TAILOR_SYSTEM, buildTailorUser(JSON.stringify(base), jobText));
    const env = parseEnvelope(data);
    const fileName = buildFileName(base.cabecalho.nome, env.cargo || "Vaga", env.empresa || "Empresa");
    await renderToFile(cvElement(env.resume), `./public/generated/${fileName}`);
    const row = await db.tailoredApplication.create({
      data: {
        jobText, cargo: env.cargo, empresa: env.empresa, fileName, pdfPath: `/generated/${fileName}`,
        matchPercent: env.matchPercent, strengths: JSON.stringify(env.strengths),
        weaknesses: JSON.stringify(env.weaknesses), emailBody: env.emailBody,
        chatMessage: env.chatMessage, status: "done", errorLog: "",
      },
    });
    return { ok: true, id: row.id };
  } catch (e) {
    const msg = (e as Error).message.slice(0, 1000);
    const row = await db.tailoredApplication.create({
      data: {
        jobText, cargo: "Vaga", empresa: "Empresa", fileName: `failed_${Date.now()}.pdf`, pdfPath: "",
        matchPercent: 0, strengths: "[]", weaknesses: "[]", status: "failed", errorLog: msg,
      },
    });
    return { ok: false, error: `As 3 IAs falharam. Vaga salva como failed para retry. Detalhe: ${msg}`, id: row.id };
  }
}

export async function retryTailor(id: number): Promise<{ ok: boolean; error?: string }> {
  const row = await db.tailoredApplication.findUnique({ where: { id } });
  if (!row) return { ok: false, error: "Registro não encontrado." };
  const r = await tailorResume(row.jobText);
  if (r.ok && r.id !== id) await db.tailoredApplication.delete({ where: { id } });
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}
