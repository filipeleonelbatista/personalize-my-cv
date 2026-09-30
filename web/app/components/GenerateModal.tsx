"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { LuSparkles, LuLoaderCircle } from "react-icons/lu";
import { loadApps, quotaMessage, type StoredApp } from "@/lib/store";
import { getLocale, tErr } from "@/lib/i18n/locale";
import { runTailorJob } from "@/lib/tailor-client";
import type { BaseLang } from "../../lib/llm/prompts";
import { Button } from "./ui/button";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Textarea } from "./ui/textarea";
import { Select } from "./ui/select";
import { useStagedSteps } from "./use-staged-steps";

export function GenerateModal({ defaultLang = "pt-BR", onChanged }: { defaultLang?: BaseLang; onChanged?: (apps: StoredApp[]) => void }) {
  const t = useTranslations("Generate");
  const [open, setOpen] = useState(false);
  const [jobText, setJobText] = useState("");
  const [lang, setLang] = useState<BaseLang>(defaultLang);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const stages = [t("stage1"), t("stage2"), t("stage3")];
  const stage = useStagedSteps(stages, loading, 8000);

  async function onGenerate() {
    if (!navigator.onLine) {
      const msg = tErr(getLocale(), "offline");
      setError(msg);
      toast.error(msg);
      return;
    }
    setError("");
    setLoading(true);
    try {
      const r = await runTailorJob(jobText, lang);
      if (r.ok) {
        toast.success(t("success"));
        onChanged?.(loadApps());
        setOpen(false);
        setJobText("");
      } else {
        setError(r.error);
        toast.error(t("failSaved"), { description: r.error.slice(0, 200) });
        onChanged?.(loadApps());
      }
    } catch (err) {
      const msg = ((err instanceof Error ? err.message : String(err)) || t("unknownFail")).slice(0, 500);
      setError(msg);
      if (err instanceof Error && err.message === quotaMessage(getLocale())) {
        toast.error(t("storageFull"), { description: msg, duration: 10000 });
      } else {
        toast.error(t("failGeneric"), { description: msg });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <LuSparkles /> {t("open")}
      </Button>
      <Dialog open={open} onClose={() => !loading && setOpen(false)}>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("desc")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-4">
          <label className="flex items-center gap-2 text-sm">
            {t("cvLang")}
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
            placeholder={t("placeholder")}
            disabled={loading}
          />
          {loading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <LuLoaderCircle className="animate-spin" /> {stages[stage]} {t("loadingNote")}
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
                {t("refreshTable")}
              </Button>
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            {t("cancel")}
          </Button>
          <Button onClick={onGenerate} disabled={loading || jobText.trim().length < 20}>
            {loading && <LuLoaderCircle className="animate-spin" />}
            {loading ? t("generating") : t("submit")}
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  );
}
