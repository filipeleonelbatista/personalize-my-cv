"use client";

import { useState } from "react";
import { toast } from "sonner";
import { LuCopy, LuCheck, LuDownload, LuPrinter } from "react-icons/lu";
import { Button, buttonVariants } from "./ui/button";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
import { cn } from "@/lib/utils";

export type AppRow = {
  id: number;
  jobText: string;
  cargo: string;
  empresa: string;
  fileName: string;
  pdfPath: string;
  matchPercent: number;
  strengths: string;
  weaknesses: string;
  emailBody: string;
  chatMessage: string;
  status: string;
  errorLog: string;
  createdAt: string;
};

function parseList(json: string): string[] {
  try {
    const v = JSON.parse(json) as unknown;
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

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
  const strengths = parseList(app.strengths);
  const weaknesses = parseList(app.weaknesses);

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
        {app.pdfPath ? (
          <div className="flex gap-2">
            <a
              href={app.pdfPath}
              download={app.fileName}
              className={cn(buttonVariants({ size: "sm" }))}
            >
              <LuDownload /> Baixar PDF
            </a>
            <a
              href={`/api/applications/${app.id}/pdf`}
              target="_blank"
              rel="noopener"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              <LuPrinter /> Imprimir
            </a>
            <Badge variant={app.status === "done" ? "success" : "destructive"}>
              {app.status === "done" ? "Pronto" : "Falhou"}
            </Badge>
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
                  {strengths.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-sm font-bold">Pontos fracos</p>
                <ul className="list-disc pl-5 text-sm">
                  {weaknesses.map((w) => (
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
