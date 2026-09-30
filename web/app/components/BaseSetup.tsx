"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { LuSparkles, LuLoaderCircle } from "react-icons/lu";
import { generateJson } from "@/lib/llm/chain";
import { buildBaseExtractSystem, buildRepairUser, type BaseLang } from "@/lib/llm/prompts";
import { extractCvTextFromFile } from "@/lib/cv-text-client";
import { normalizeResume } from "@/lib/tailor";
import { loadSettings, saveBase, quotaMessage } from "@/lib/store";
import { getLocale, tErr } from "@/lib/i18n/locale";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Select } from "./ui/select";
import { Dropzone } from "./ui/dropzone";
import { useStagedSteps } from "./use-staged-steps";

export function BaseSetup({ onDone }: { onDone?: () => void }) {
  const t = useTranslations("Base");
  const [file, setFile] = useState<File | null>(null);
  const [lang, setLang] = useState<BaseLang>("pt-BR");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const stages = [t("stage1"), t("stage2"), t("stage3")];
  const stage = useStagedSteps(stages, loading);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    if (!navigator.onLine) {
      const off = tErr(getLocale(), "offline");
      setError(off);
      toast.error(off);
      return;
    }
    setError("");
    setLoading(true);
    try {
      const settings = loadSettings();
      const text = await extractCvTextFromFile(file);
      const system = buildBaseExtractSystem(lang);
      const { data } = await generateJson(system, text.slice(0, 12000), settings.geminiKey, settings.models);
      let resume;
      try {
        resume = normalizeResume(data);
      } catch (zerr) {
        const { data: fixed } = await generateJson(system, buildRepairUser(JSON.stringify(data), String(zerr)), settings.geminiKey, settings.models);
        resume = normalizeResume(fixed);
      }
      saveBase({ resume, lang, updatedAt: new Date().toISOString() });
      toast.success(t("updated"));
      if (onDone) onDone();
      else window.location.reload();
    } catch (err) {
      const msg = ((err instanceof Error ? err.message : String(err)) || t("unknownFail")).slice(0, 500);
      setError(msg);
      if (err instanceof Error && err.message === quotaMessage(getLocale())) {
        toast.error(t("storageFull"), { description: msg, duration: 10000 });
      } else {
        toast.error(t("failUpdate"), { description: msg });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("desc")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <Dropzone file={file} onFile={setFile} onClear={() => setFile(null)} disabled={loading} />
          <label className="flex items-center gap-2 text-sm">
            {t("cvLang")}
            <Select name="lang" value={lang} onChange={(e) => setLang(e.target.value as BaseLang)} disabled={loading}>
              <option value="pt-BR">Português (BR)</option>
              <option value="en">English</option>
              <option value="es">Español</option>
            </Select>
          </label>
          <Button type="submit" disabled={loading || !file}>
            {loading ? <LuLoaderCircle className="animate-spin" /> : <LuSparkles />}
            {loading ? stages[stage] : t("submit")}
          </Button>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </form>
      </CardContent>
    </Card>
  );
}
