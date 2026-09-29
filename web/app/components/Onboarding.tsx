// web/app/components/Onboarding.tsx
"use client";
import { useState } from "react";
import { toast } from "sonner";
import { validateGeminiKey, generateJson } from "@/lib/llm/chain";
import { buildBaseExtractSystem, buildRepairUser, type BaseLang } from "@/lib/llm/prompts";
import { extractCvTextFromFile } from "@/lib/cv-text-client";
import { normalizeResume } from "@/lib/tailor";
import { loadSettings, saveSettings, saveBase, setOnboarded } from "@/lib/store";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Select } from "./ui/select";
import { Dropzone } from "./ui/dropzone";
import { useStagedSteps } from "./use-staged-steps";

const STAGES = ["Extraindo texto do PDF…", "IA catalogando experiências…", "Validando e salvando base…"];

export function Onboarding({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [key, setKey] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [lang, setLang] = useState<BaseLang>("pt-BR");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const stage = useStagedSteps(STAGES, loading && step === 2);
  const trimmedKey = key.trim();

  async function onValidateSave() {
    setError(""); setLoading(true);
    try {
      const trimmed = key.trim();
      const v = await validateGeminiKey(trimmed);
      if (!v.ok) { setError(v.error); return; }
      const cur = loadSettings();
      saveSettings({ ...cur, geminiKey: trimmed });
      setStep(2);
    } finally { setLoading(false); }
  }

  async function onCreateBase() {
    if (!file) return;
    setError(""); setLoading(true);
    try {
      const settings = loadSettings();
      const text = await extractCvTextFromFile(file);
      const system = buildBaseExtractSystem(lang);
      const { data } = await generateJson(system, text.slice(0, 12000), settings.geminiKey, settings.models);
      let resume;
      try { resume = normalizeResume(data); }
      catch (zerr) {
        const { data: fixed } = await generateJson(system, buildRepairUser(JSON.stringify(data), String(zerr)), settings.geminiKey, settings.models);
        resume = normalizeResume(fixed);
      }
      saveBase({ resume, lang, updatedAt: new Date().toISOString() });
      setOnboarded(true);
      toast.success("Currículo base criado!");
      onDone();
    } catch (e) {
      const msg = ((e instanceof Error ? e.message : String(e)) || "Falha desconhecida.").slice(0, 500);
      setError(msg);
      if (/Armazenamento cheio/.test(msg)) {
        toast.error("Armazenamento cheio", {
          description: `${msg} Exporte o backup em Configurações e apague currículos antigos.`,
          duration: 10000,
        });
      }
    }
    finally { setLoading(false); }
  }

  if (step === 0) return (
    <Card><CardHeader><CardTitle>Bem-vindo ao Personalize My CV</CardTitle>
    <CardDescription>Como funciona</CardDescription></CardHeader>
    <CardContent className="space-y-2 text-sm">
      <p>Passo 1 de 3</p>
      <p>1. Você cadastra seu currículo base em PDF — a IA cataloga tudo em JSON.</p>
      <p>2. Para cada vaga, geramos um CV sob medida com match, pontos fortes/fracos, email e mensagem.</p>
      <p>3. Tudo fica no seu browser (localStorage) com sua própria chave Gemini.</p>
      <Button onClick={() => setStep(1)}>Começar</Button>
    </CardContent></Card>
  );
  if (step === 1) return (
    <Card><CardHeader><CardTitle>Conectar Gemini</CardTitle>
    <CardDescription>Crie sua chave e cole abaixo</CardDescription></CardHeader>
    <CardContent className="space-y-3">
      <p className="text-sm text-muted-foreground">Passo 2 de 3</p>
      <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" className="text-sm underline">Criar chave em aistudio.google.com/apikey</a>
      <input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Cole a GEMINI_API_KEY" className="w-full rounded border p-2 text-sm" disabled={loading} />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setStep(0)} disabled={loading}>Voltar</Button>
        <Button onClick={onValidateSave} disabled={loading || !trimmedKey}>{loading ? "Validando…" : "Validar e continuar"}</Button>
      </div>
    </CardContent></Card>
  );
  return (
    <Card><CardHeader><CardTitle>Criar base</CardTitle>
    <CardDescription>Envie seu currículo em PDF para a IA catalogar</CardDescription></CardHeader>
    <CardContent className="space-y-3">
      <p className="text-sm text-muted-foreground">Passo 3 de 3</p>
      <Dropzone file={file} onFile={setFile} onClear={() => setFile(null)} disabled={loading} />
      <label className="flex items-center gap-2 text-sm">
        Idioma do currículo
        <Select value={lang} onChange={(e) => setLang(e.target.value as BaseLang)} disabled={loading}>
          <option value="pt-BR">Português (BR)</option>
          <option value="en">English</option>
          <option value="es">Español</option>
        </Select>
      </label>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setStep(1)} disabled={loading}>Voltar</Button>
        <Button onClick={onCreateBase} disabled={loading || !file}>{loading ? STAGES[stage] : "Criar currículo base"}</Button>
      </div>
    </CardContent></Card>
  );
}
