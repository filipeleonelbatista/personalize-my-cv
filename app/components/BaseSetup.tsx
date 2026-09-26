"use client";

import { useState } from "react";
import { uploadBase } from "../actions";

export function BaseSetup() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const r = await uploadBase(new FormData(e.currentTarget));
      if (r.ok) window.location.reload();
      else setError(r.error);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded border p-4">
      <p className="text-sm text-gray-700">Envie seu currículo em PDF para criar o JSON base.</p>
      <input type="file" name="pdf" accept="application/pdf" required className="block text-sm" />
      <button type="submit" disabled={loading} className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50">
        {loading ? "Analisando com IA..." : "Criar currículo base"}
      </button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </form>
  );
}
