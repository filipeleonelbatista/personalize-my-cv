import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await db.tailoredApplication.findUnique({ where: { id: Number(id) } });
  if (!row || !row.pdfPath) {
    return NextResponse.json({ error: "Currículo não encontrado." }, { status: 404 });
  }
  try {
    const abs = path.join(process.cwd(), "public", path.basename(row.pdfPath));
  const buf = await readFile(abs);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${row.fileName}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Arquivo PDF não encontrado." }, { status: 404 });
  }
}
