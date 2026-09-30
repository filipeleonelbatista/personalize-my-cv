// web/app/components/Onboarding.tsx
"use client";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { validateGeminiKey, generateJson } from "@/lib/llm/chain";
import { buildBaseExtractSystem, buildRepairUser, type BaseLang } from "@/lib/llm/prompts";
import { extractCvTextFromFile } from "@/lib/cv-text-client";
import { normalizeResume } from "@/lib/tailor";
import { loadSettings, saveSettings, saveBase, setOnboarded, quotaMessage } from "@/lib/store";
import { getLocale, tErr } from "@/lib/i18n/locale";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Select } from "./ui/select";
import { Dropzone } from "./ui/dropzone";
import { useStagedSteps } from "./use-staged-steps";

export function Onboarding({ onDone }: { onDone: () => void }) {
  const t = useTranslations("Onboarding");
  const tc = useTranslations("Common");
  const [step, setStep] = useState(0);
  const [key, setKey] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [lang, setLang] = useState<BaseLang>("pt-BR");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const stage = useStagedSteps([t("stage1"), t("stage2"), t("stage3")], loading && step === 2);
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
    if (!navigator.onLine) {
      const off = tErr(getLocale(), "offline");
      setError(off);
      toast.error(off);
      return;
    }
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
      toast.success(t("baseCreated"));
      onDone();
    } catch (e) {
      const msg = ((e instanceof Error ? e.message : String(e)) || t("unknownFail")).slice(0, 500);
      setError(msg);
      if (e instanceof Error && e.message === quotaMessage(getLocale())) {
        toast.error(t("storageFull"), { description: msg, duration: 10000 });
      }
    }
    finally { setLoading(false); }
  }

  if (step === 0) return (
    <Card><CardHeader><CardTitle>{t("welcomeTitle")}</CardTitle>
    <CardDescription>{t("howItWorks")}</CardDescription></CardHeader>
    <CardContent className="space-y-2 text-sm">
      <p>{t("stepOf", { n: 1 })}</p>
      <p>{t("b1")}</p>
      <p>{t("b2")}</p>
      <p>{t("b3")}</p>
      <Button onClick={() => setStep(1)}>{t("start")}</Button>
    </CardContent></Card>
  );
  if (step === 1) return (
    <Card><CardHeader><CardTitle>{t("connectTitle")}</CardTitle>
    <CardDescription>{t("connectDesc")}</CardDescription></CardHeader>
    <CardContent className="space-y-3">
      <p className="text-sm text-muted-foreground">{t("stepOf", { n: 2 })}</p>
      <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" className="text-sm underline">{t("createKeyLink")}</a>
      <input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder={t("keyPlaceholder")} className="w-full rounded border p-2 text-sm" disabled={loading} />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setStep(0)} disabled={loading}>{tc("back")}</Button>
        <Button onClick={onValidateSave} disabled={loading || !trimmedKey}>{loading ? t("validating") : t("validate")}</Button>
      </div>
    </CardContent></Card>
  );
  const stages = [t("stage1"), t("stage2"), t("stage3")];
  return (
    <Card><CardHeader><CardTitle>{t("createTitle")}</CardTitle>
    <CardDescription>{t("createDesc")}</CardDescription></CardHeader>
    <CardContent className="space-y-3">
      <p className="text-sm text-muted-foreground">{t("stepOf", { n: 3 })}</p>
      <Dropzone file={file} onFile={setFile} onClear={() => setFile(null)} disabled={loading} />
      <label className="flex items-center gap-2 text-sm">
        {t("cvLang")}
        <Select value={lang} onChange={(e) => setLang(e.target.value as BaseLang)} disabled={loading}>
          <option value="pt-BR">Português (BR)</option>
          <option value="en">English</option>
          <option value="es">Español</option>
        </Select>
      </label>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setStep(1)} disabled={loading}>{tc("back")}</Button>
        <Button onClick={onCreateBase} disabled={loading || !file}>{loading ? stages[stage] : t("createBtn")}</Button>
      </div>
    </CardContent></Card>
  );
}
