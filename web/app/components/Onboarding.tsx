// web/app/components/Onboarding.tsx
"use client";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { LuArrowRight, LuCheck, LuFileText, LuKeyRound, LuPartyPopper, LuSparkles } from "react-icons/lu";
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

const STEP_ICONS = [LuSparkles, LuKeyRound, LuFileText];

function celebrate() {
  void import("canvas-confetti").then(({ default: confetti }) => {
    confetti({ particleCount: 130, spread: 80, origin: { y: 0.6 } });
    setTimeout(() => confetti({ particleCount: 70, angle: 60, spread: 60, origin: { x: 0 } }), 250);
    setTimeout(() => confetti({ particleCount: 70, angle: 120, spread: 60, origin: { x: 1 } }), 400);
  });
}

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
  const stepNames = [t("stepName1"), t("stepName2"), t("stepName3")];

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
      celebrate();
      setStep(3);
    } catch (e) {
      const msg = ((e instanceof Error ? e.message : String(e)) || t("unknownFail")).slice(0, 500);
      setError(msg);
      if (e instanceof Error && e.message === quotaMessage(getLocale())) {
        toast.error(t("storageFull"), { description: msg, duration: 10000 });
      }
    }
    finally { setLoading(false); }
  }

  function Stepper({ current }: { current: number }) {
    return (
      <ol className="flex items-center gap-1 sm:gap-2" aria-label={t("howItWorks")}>
        {stepNames.map((name, i) => {
          const Icon = STEP_ICONS[i];
          const done = i < current;
          const active = i === current;
          return (
            <li key={name} className="flex flex-1 items-center gap-2 last:flex-none">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold ${
                  done
                    ? "border-primary bg-primary text-primary-foreground"
                    : active
                      ? "border-primary text-primary"
                      : "border-border text-muted-foreground"
                }`}
              >
                {done ? <LuCheck /> : <Icon />}
              </span>
              <span className={`hidden text-xs font-medium sm:inline ${active ? "text-foreground" : "text-muted-foreground"}`}>
                {name}
              </span>
              {i < stepNames.length - 1 ? <span className="h-px flex-1 bg-border" /> : null}
            </li>
          );
        })}
      </ol>
    );
  }

  if (step === 3) return (
    <Card className="overflow-hidden">
      <div className="bg-gradient-to-r from-primary/15 via-primary/5 to-transparent px-6 pt-6">
        <Stepper current={3} />
      </div>
      <CardHeader className="items-center text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-2xl text-primary">
          <LuPartyPopper />
        </span>
        <CardTitle className="text-2xl">{t("successTitle")}</CardTitle>
        <CardDescription className="max-w-md">{t("successDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center pb-6">
        <Button size="lg" onClick={onDone}>
          {t("goBtn")} <LuArrowRight />
        </Button>
      </CardContent>
    </Card>
  );

  if (step === 0) return (
    <Card className="overflow-hidden">
      <div className="bg-gradient-to-r from-primary/15 via-primary/5 to-transparent px-6 pt-6">
        <Stepper current={0} />
      </div>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <LuSparkles />
          </span>
          {t("welcomeTitle")}
        </CardTitle>
        <CardDescription>{t("howItWorks")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-2 text-sm">
          {[t("b1"), t("b2"), t("b3")].map((b) => (
            <li key={b} className="flex items-start gap-2">
              <LuCheck className="mt-0.5 shrink-0 text-primary" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
        <Button size="lg" onClick={() => setStep(1)}>
          {t("start")} <LuArrowRight />
        </Button>
      </CardContent>
    </Card>
  );
  if (step === 1) return (
    <Card className="overflow-hidden">
      <div className="bg-gradient-to-r from-primary/15 via-primary/5 to-transparent px-6 pt-6">
        <Stepper current={1} />
      </div>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <LuKeyRound />
          </span>
          {t("connectTitle")}
        </CardTitle>
        <CardDescription>{t("connectDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" className="text-sm underline">{t("createKeyLink")}</a>
        <input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder={t("keyPlaceholder")} className="w-full rounded border p-2 text-sm" disabled={loading} />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setStep(0)} disabled={loading}>{tc("back")}</Button>
          <Button onClick={onValidateSave} disabled={loading || !trimmedKey}>{loading ? t("validating") : t("validate")}</Button>
        </div>
      </CardContent>
    </Card>
  );
  const stages = [t("stage1"), t("stage2"), t("stage3")];
  return (
    <Card className="overflow-hidden">
      <div className="bg-gradient-to-r from-primary/15 via-primary/5 to-transparent px-6 pt-6">
        <Stepper current={2} />
      </div>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <LuFileText />
          </span>
          {t("createTitle")}
        </CardTitle>
        <CardDescription>{t("createDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
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
      </CardContent>
    </Card>
  );
}
