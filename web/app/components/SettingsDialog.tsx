// web/app/components/SettingsDialog.tsx
"use client";

import { useState } from "react";
import { LuSettings } from "react-icons/lu";
import { toast } from "sonner";
import { loadSettings, saveSettings } from "@/lib/store";
import { validateGeminiKey } from "@/lib/llm/chain";
import { Button } from "./ui/button";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";

export function SettingsDialog() {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleOpen() {
    setKey(loadSettings().geminiKey);
    setError("");
    setOpen(true);
  }

  async function handleSave() {
    setError("");
    setLoading(true);
    try {
      const v = await validateGeminiKey(key);
      if (!v.ok) {
        setError(v.error);
        return;
      }
      const cur = loadSettings();
      saveSettings({ ...cur, geminiKey: key.trim() });
      toast.success("Chave Gemini atualizada!");
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button variant="outline" onClick={handleOpen}>
        <LuSettings /> Configurações
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogHeader>
          <DialogTitle>Configurações</DialogTitle>
          <DialogDescription>Gerencie sua chave Gemini (armazenada no browser).</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-4">
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noopener"
            className="text-sm underline"
          >
            Criar chave em aistudio.google.com/apikey
          </a>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="GEMINI_API_KEY"
            className="w-full rounded border p-2 text-sm"
            disabled={loading}
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={loading || !key.trim()}>
              {loading ? "Validando…" : "Salvar"}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
