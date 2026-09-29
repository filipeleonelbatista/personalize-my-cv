"use client";

import { useState } from "react";
import { toast } from "sonner";
import { LuCopy, LuCheck, LuDownload, LuPrinter } from "react-icons/lu";
import { resumeToBlob, openResumePdf } from "@/lib/pdf/client";
import type { StoredApp } from "@/lib/store";
import { Button } from "./ui/button";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";

export type AppRow = StoredApp;

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setDone(true);
    toast.success(`${label} copiado!`);
    setTimeout(() => setDone(false), 1500);
  }
  return (
    <Button variant="ghost" size="sm" onClick={copy}>
      {done ? <LuCheck /> : <LuCopy />} Copiar
    </Button>
  );
}

export function DetailDrawer({ app, onClose }: { app: AppRow; onClose: () => void }) {
  async function onDownload() {
    try {
      const blob = await resumeToBlob(app.resume, app.lang);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = app.fileName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (err) {
      toast.error("Falha ao gerar PDF", { description: (err as Error).message });
    }
  }

  async function onPrint() {
    try {
      await openResumePdf(app.resume, app.lang);
    } catch (err) {
      toast.error("Falha ao abrir PDF", { description: (err as Error).message });
    }
  }

  return (
    <Dialog open onClose={onClose}>
      <DialogHeader>
        <DialogTitle>
          {app.cargo} — {app.empresa}
        </DialogTitle>
        <DialogDescription>
          Gerado em {new Date(app.createdAt).toLocaleString("pt-BR")} • {app.fileName}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-4">
        {app.status === "done" ? (
          <div className="flex gap-2">
            <Button size="sm" onClick={onDownload}>
              <LuDownload /> Baixar PDF
            </Button>
            <Button variant="outline" size="sm" onClick={onPrint}>
              <LuPrinter /> Imprimir
            </Button>
            <Badge variant="success">Pronto</Badge>
          </div>
        ) : (
          <p className="text-sm text-destructive">PDF não gerado. Erro: {app.errorLog}</p>
        )}

        {app.status === "done" ? (
          <>
            <div className="space-y-1">
              <p className="text-sm font-bold">Afinidade com a vaga: {app.matchPercent}%</p>
              <Progress value={app.matchPercent} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm font-bold">Pontos fortes</p>
                <ul className="list-disc pl-5 text-sm">
                  {app.strengths.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-sm font-bold">Pontos fracos</p>
                <ul className="list-disc pl-5 text-sm">
                  {app.weaknesses.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold">Email de apresentação</p>
                <CopyButton text={app.emailBody} label="Email" />
              </div>
              <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">{app.emailBody}</pre>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold">Mensagem instantânea</p>
                <CopyButton text={app.chatMessage} label="Mensagem" />
              </div>
              <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">{app.chatMessage}</pre>
            </div>
          </>
        ) : null}

        <details>
          <summary className="cursor-pointer text-sm text-muted-foreground">Ver texto original da vaga</summary>
          <pre className="mt-2 whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">{app.jobText}</pre>
        </details>
      </div>
    </Dialog>
  );
}
