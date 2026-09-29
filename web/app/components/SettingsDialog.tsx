// web/app/components/SettingsDialog.tsx
"use client";

import { useRef, useState } from "react";
import { LuSettings } from "react-icons/lu";
import { toast } from "sonner";
import { clearSettings, exportBackup, importBackup, loadSettings, saveSettings, setOnboarded } from "@/lib/store";
import { validateGeminiKey } from "@/lib/llm/chain";
import { DEFAULT_GEMINI_MODELS } from "@/lib/llm/gemini";
import { Button } from "./ui/button";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";

export function SettingsDialog() {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [custom, setCustom] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleOpen() {
    const s = loadSettings();
    setKey(s.geminiKey);
    setModels(s.models);
    setCustom(s.models.filter((m) => !DEFAULT_GEMINI_MODELS.includes(m)).join(", "));
    setError("");
    setOpen(true);
  }

  function toggleModel(m: string) {
    setModels((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  }

  async function handleSave() {
    setError("");
    setLoading(true);
    try {
      const trimmed = key.trim();
      const v = await validateGeminiKey(trimmed);
      if (!v.ok) {
        setError(v.error);
        return;
      }
      const all = Array.from(
        new Set([...models, ...custom.split(",").map((s) => s.trim()).filter(Boolean)]),
      );
      if (!all.length) {
        setError("Selecione ao menos um model.");
        return;
      }
      saveSettings({ geminiKey: trimmed, models: all });
      toast.success("Configurações atualizadas!");
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  function handleClearKey() {
    if (!window.confirm("Remover a chave Gemini e voltar ao onboarding? Seus dados locais são mantidos.")) return;
    clearSettings();
    setOnboarded(false);
    window.location.reload();
  }

  function handleExport() {
    const blob = new Blob([exportBackup()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pmcv-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    toast.success("Backup exportado!");
  }

  async function handleImportFile(file: File) {
    try {
      importBackup(await file.text());
      toast.success("Backup importado!");
      window.location.reload();
    } catch (e) {
      toast.error("Backup inválido", { description: (e as Error).message.slice(0, 300) });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const options = Array.from(new Set([...DEFAULT_GEMINI_MODELS, ...models]));

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
        <div className="space-y-4 py-4">
          <div className="space-y-3">
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
            <fieldset className="space-y-1">
              <legend className="text-sm font-medium">Models (ordem de tentativa)</legend>
              {options.map((m) => (
                <label key={m} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={models.includes(m)}
                    onChange={() => toggleModel(m)}
                    disabled={loading}
                  />
                  {m}
                </label>
              ))}
              <input
                type="text"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                placeholder="Outros models, separados por vírgula"
                className="w-full rounded border p-2 text-sm"
                disabled={loading}
              />
            </fieldset>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
                Cancelar
              </Button>
              <Button variant="outline" onClick={handleClearKey} disabled={loading}>
                Remover chave
              </Button>
              <Button onClick={handleSave} disabled={loading || !key.trim()}>
                {loading ? "Validando…" : "Salvar"}
              </Button>
            </div>
          </div>
          <div className="space-y-2 border-t pt-3">
            <p className="text-sm font-medium">Backup</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={handleExport}>
                Exportar backup
              </Button>
              <Button variant="outline" onClick={() => fileRef.current?.click()}>
                Importar backup
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleImportFile(f);
                }}
              />
            </div>
          </div>
        </div>
      </Dialog>
    </>
  );
}
