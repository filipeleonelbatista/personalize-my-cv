"use server";

import { db } from "@/lib/db";
import { extractCvText } from "@/lib/cv-text";
import { parseResume, type Resume } from "@/lib/resume-schema";
import { generateJson } from "@/lib/llm/chain";
import { BASE_EXTRACT_SYSTEM, buildRepairUser } from "@/lib/llm/prompts";

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
