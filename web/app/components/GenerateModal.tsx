"use client";

import { useState } from "react";
import { toast } from "sonner";
import { LuSparkles, LuLoaderCircle } from "react-icons/lu";
import { loadApps, type StoredApp } from "@/lib/store";
import { runTailorJob } from "@/lib/tailor-client";
import type { BaseLang } from "../../lib/llm/prompts";
import { Button } from "./ui/button";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Textarea } from "./ui/textarea";
import { Select } from "./ui/select";
import { useStagedSteps } from "./use-staged-steps";

const STAGES = ["Lendo a vaga…", "Reescrevendo com keywords…", "Gerando PDF e análise…"];

export function GenerateModal({ defaultLang = "pt-BR", onChanged }: { defaultLang?: BaseLang; onChanged?: (apps: StoredApp[]) => void }) {
  const [open, setOpen] = useState(false);
  const [jobText, setJobText] = useState("");
  const [lang, setLang] = useState<BaseLang>(defaultLang);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const stage = useStagedSteps(STAGES, loading, 8000);

  async function onGenerate() {
    setError("");
    setLoading(true);
    try {
      const r = await runTailorJob(jobText, lang);
      if (r.ok) {
        toast.success("Currículo personalizado gerado!");
        onChanged?.(loadApps());
        setOpen(false);
        setJobText("");
      } else {
        setError(r.error);
        toast.error("As IAs falharam — vaga salva para retry", { description: r.error.slice(0, 200) });
        onChanged?.(loadApps());
      }
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      toast.error("Falha ao gerar", { description: msg });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <LuSparkles /> Personalizar com IA
      </Button>
      <Dialog open={open} onClose={() => !loading && setOpen(false)}>
        <DialogHeader>
          <DialogTitle>Nova vaga</DialogTitle>
          <DialogDescription>Cole o texto da vaga (requisitos, responsabilidades, empresa).</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-4">
          <label className="flex items-center gap-2 text-sm">
            Idioma do currículo
            <Select name="lang" value={lang} onChange={(e) => setLang(e.target.value as BaseLang)} disabled={loading}>
              <option value="pt-BR">Português (BR)</option>
              <option value="en">English</option>
              <option value="es">Español</option>
            </Select>
          </label>
          <Textarea
            value={jobText}
            onChange={(e) => setJobText(e.target.value)}
            rows={12}
            placeholder="Cole aqui a descrição da vaga..."
            disabled={loading}
          />
          {loading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <LuLoaderCircle className="animate-spin" /> {STAGES[stage]} (pode levar 1–2 min)
            </p>
          ) : null}
          {error ? (
            <div className="space-y-2">
              <p className="text-sm text-destructive">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onChanged?.(loadApps());
                  setOpen(false);
                }}
              >
                Atualizar tabela
              </Button>
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={onGenerate} disabled={loading || jobText.trim().length < 20}>
            {loading && <LuLoaderCircle className="animate-spin" />}
            {loading ? "Gerando…" : "Gerar currículo"}
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  );
}
