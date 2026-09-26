"use client";

import { useState } from "react";

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

async function copy(text: string, setCopied: (v: string) => void, label: string) {
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
  setCopied(label);
  setTimeout(() => setCopied(""), 1500);
}

export function DetailDrawer({ app, onClose }: { app: AppRow; onClose: () => void }) {
  const [copied, setCopied] = useState("");
  const strengths = parseList(app.strengths);
  const weaknesses = parseList(app.weaknesses);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded bg-white p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold">{app.cargo} — {app.empresa}</h2>
            <p className="text-xs text-gray-500">Gerado em {new Date(app.createdAt).toLocaleString("pt-BR")} • {app.fileName}</p>
          </div>
          <button onClick={onClose} className="rounded border px-3 py-1 text-sm">Fechar</button>
        </div>

        {app.pdfPath ? (
          <div className="flex gap-2">
            <a href={app.pdfPath} download={app.fileName} className="inline-block rounded bg-black px-4 py-2 text-sm text-white">
              Baixar PDF
            </a>
            <a href={`/api/applications/${app.id}/pdf`} target="_blank" rel="noopener" className="inline-block rounded border px-4 py-2 text-sm">
              Imprimir
            </a>
          </div>
        ) : (
          <p className="text-sm text-red-600">PDF não gerado. Erro: {app.errorLog}</p>
        )}

        {app.status === "done" ? (
          <>
            <div>
              <p className="text-sm font-bold">Afinidade com a vaga: {app.matchPercent}%</p>
              <div className="h-2 w-full rounded bg-gray-200">
                <div className="h-2 rounded bg-green-600" style={{ width: `${app.matchPercent}%` }} />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm font-bold">Pontos fortes</p>
                <ul className="list-disc pl-5 text-sm">{strengths.map((s) => <li key={s}>{s}</li>)}</ul>
              </div>
              <div>
                <p className="text-sm font-bold">Pontos fracos</p>
                <ul className="list-disc pl-5 text-sm">{weaknesses.map((w) => <li key={w}>{w}</li>)}</ul>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold">Email de apresentação</p>
                <button onClick={() => copy(app.emailBody, setCopied, "email")} className="text-sm underline">Copiar</button>
              </div>
              <pre className="whitespace-pre-wrap rounded bg-gray-50 p-2 text-sm">{app.emailBody}</pre>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold">Mensagem instantânea</p>
                <button onClick={() => copy(app.chatMessage, setCopied, "chat")} className="text-sm underline">Copiar</button>
              </div>
              <pre className="whitespace-pre-wrap rounded bg-gray-50 p-2 text-sm">{app.chatMessage}</pre>
            </div>
            {copied ? <p className="text-xs text-green-700">Copiado: {copied}</p> : null}
          </>
        ) : null}

        <details>
          <summary className="cursor-pointer text-sm text-gray-600">Ver texto original da vaga</summary>
          <pre className="whitespace-pre-wrap rounded bg-gray-50 p-2 text-xs">{app.jobText}</pre>
        </details>
      </div>
    </div>
  );
}
