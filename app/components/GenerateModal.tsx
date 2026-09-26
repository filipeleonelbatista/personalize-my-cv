"use client";

import { useState } from "react";
import { tailorResume } from "../actions";

export function GenerateModal() {
  const [open, setOpen] = useState(false);
  const [jobText, setJobText] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onGenerate() {
    setError("");
    setLoading(true);
    try {
      const r = await tailorResume(jobText);
      if (r.ok) window.location.reload();
      else setError(r.error);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded bg-black px-4 py-2 text-sm text-white">
        Gerar outro currículo
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl space-y-3 rounded bg-white p-6">
        <h2 className="text-lg font-bold">Nova vaga</h2>
        <p className="text-sm text-gray-600">Cole o texto da vaga (requisitos, responsabilidades, empresa).</p>
        <textarea
          value={jobText}
          onChange={(e) => setJobText(e.target.value)}
          rows={12}
          placeholder="Cole aqui a descrição da vaga..."
          className="w-full rounded border p-2 text-sm"
        />
        {error ? (
          <div className="space-y-2">
            <p className="text-sm text-red-600">{error}</p>
            <button onClick={() => window.location.reload()} className="rounded border px-4 py-2 text-sm">
              Atualizar tabela
            </button>
          </div>
        ) : null}
        <div className="flex justify-end gap-2">
          <button onClick={() => setOpen(false)} className="rounded border px-4 py-2 text-sm">
            Cancelar
          </button>
          <button onClick={onGenerate} disabled={loading || jobText.trim().length < 20} className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50">
            {loading ? "Gerando (pode levar 1-2 min)..." : "Gerar currículo"}
          </button>
        </div>
      </div>
    </div>
  );
}
