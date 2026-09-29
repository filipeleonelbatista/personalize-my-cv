"use client";

import { useState } from "react";
import { toast } from "sonner";
import { LuSparkles, LuLoaderCircle } from "react-icons/lu";
import { uploadBase } from "../actions";
import type { BaseLang } from "../../lib/llm/prompts";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Select } from "./ui/select";
import { Dropzone } from "./ui/dropzone";
import { useStagedSteps } from "./use-staged-steps";

const STAGES = ["Extraindo texto do PDF…", "IA catalogando experiências…", "Validando e salvando base…"];

export function BaseSetup() {
  const [file, setFile] = useState<File | null>(null);
  const [lang, setLang] = useState<BaseLang>("pt-BR");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const stage = useStagedSteps(STAGES, loading);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setError("");
    setLoading(true);
    try {
      const fd = new FormData();
      fd.set("pdf", file);
      fd.set("lang", lang);
      const r = await uploadBase(fd);
      if (r.ok) {
        toast.success("Currículo base criado!");
        window.location.reload();
      } else {
        setError(r.error);
        toast.error("Falha ao criar base", { description: r.error });
      }
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      toast.error("Falha ao criar base", { description: msg });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Criar currículo base</CardTitle>
        <CardDescription>Envie seu currículo em PDF. A IA vai catalogar seus dados e criar o JSON base.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <Dropzone file={file} onFile={setFile} onClear={() => setFile(null)} disabled={loading} />
          <label className="flex items-center gap-2 text-sm">
            Idioma do currículo
            <Select name="lang" value={lang} onChange={(e) => setLang(e.target.value as BaseLang)} disabled={loading}>
              <option value="pt-BR">Português (BR)</option>
              <option value="en">English</option>
              <option value="es">Español</option>
            </Select>
          </label>
          <Button type="submit" disabled={loading || !file}>
            {loading ? <LuLoaderCircle className="animate-spin" /> : <LuSparkles />}
            {loading ? STAGES[stage] : "Criar currículo base"}
          </Button>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </form>
      </CardContent>
    </Card>
  );
}
