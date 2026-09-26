"use client";

import { useState } from "react";
import { retryTailor } from "../actions";
import { DetailDrawer, type AppRow } from "./DetailDrawer";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR");
}

export function VacancyTable({ apps }: { apps: AppRow[] }) {
  const [selected, setSelected] = useState<AppRow | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function onRetry(id: number) {
    setError("");
    setBusyId(id);
    try {
      const r = await retryTailor(id);
      if (r.ok) window.location.reload();
      else setError(r.error || "Falha ao tentar novamente.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  if (!apps.length) {
    return <p className="text-sm text-gray-600">Nenhum currículo gerado ainda. Clique em “Personalizar com IA”.</p>;
  }

  return (
    <div className="space-y-2">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="overflow-x-auto rounded border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 text-left">
              <th className="p-2">Cargo</th>
              <th className="p-2">Empresa</th>
              <th className="p-2">Match</th>
              <th className="p-2">Status</th>
              <th className="p-2">Data</th>
              <th className="p-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {apps.map((app) => (
              <tr key={app.id} className="border-t">
                <td className="p-2">{app.cargo}</td>
                <td className="p-2">{app.empresa}</td>
                <td className="p-2">{app.status === "done" ? `${app.matchPercent}%` : "—"}</td>
                <td className="p-2">
                  <span className={`rounded px-2 py-1 text-xs ${app.status === "done" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                    {app.status === "done" ? "Pronto" : "Falhou"}
                  </span>
                </td>
                <td className="p-2 whitespace-nowrap">{fmtDate(app.createdAt)}</td>
                <td className="p-2">
                  <div className="flex gap-2">
                    <button onClick={() => setSelected(app)} className="underline">Ver</button>
                    {app.pdfPath ? (
                      <>
                        <a href={app.pdfPath} download={app.fileName} className="underline">Baixar</a>
                        <a href={`/api/applications/${app.id}/pdf`} target="_blank" rel="noopener" className="underline">Imprimir</a>
                      </>
                    ) : null}
                    {app.status === "failed" ? (
                      <button onClick={() => onRetry(app.id)} disabled={busyId === app.id} className="underline disabled:opacity-50">
                        {busyId === app.id ? "Tentando..." : "Tentar novamente"}
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selected ? <DetailDrawer app={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}
