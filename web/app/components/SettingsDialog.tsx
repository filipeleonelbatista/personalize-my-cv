// web/app/components/SettingsDialog.tsx
"use client";

import { useRef, useState } from "react";
import { LuSettings } from "react-icons/lu";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  clearSettings,
  exportBackup,
  importBackup,
  loadSettings,
  saveSettings,
  setOnboarded,
  wipeAll,
  type Settings,
} from "@/lib/store";
import { validateGeminiKey } from "@/lib/llm/chain";
import { DEFAULT_GEMINI_MODELS } from "@/lib/llm/gemini";
import { tavilySearch } from "@/lib/research/tavily";
import { BRAVE_ENABLED } from "@/lib/research/brave";
import { Button } from "./ui/button";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Badge } from "./ui/badge";

type ResearchKeys = Settings["research"];

// field: state key · provider: desc/link suffix (`tr("<provider>Desc")`, `tr("links.<provider>")`)
const RESEARCH_FIELDS: Array<{ field: keyof ResearchKeys; provider: string }> = [
  { field: "tavilyKey", provider: "tavily" },
  { field: "braveKey", provider: "brave" },
  { field: "jinaKey", provider: "jina" },
  { field: "youtubeKey", provider: "youtube" },
  { field: "githubToken", provider: "github" },
];

type TavilyStatus = "ok" | "invalid" | "rateLimit" | null;

export function SettingsDialog() {
  const t = useTranslations("Settings");
  const tr = useTranslations("Research");
  const te = useTranslations("Errors");
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [custom, setCustom] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [researchForm, setResearchForm] = useState<ResearchKeys>({ tavilyKey: "", braveKey: "", jinaKey: "", youtubeKey: "", githubToken: "" });
  const [tavilyStatus, setTavilyStatus] = useState<TavilyStatus>(null);
  const [validatingTavily, setValidatingTavily] = useState(false);

  function handleOpen() {
    const s = loadSettings();
    setKey(s.geminiKey);
    setModels(s.models);
    setCustom(s.models.filter((m) => !DEFAULT_GEMINI_MODELS.includes(m)).join(", "));
    setResearchForm(s.research);
    setTavilyStatus(null);
    setError("");
    setOpen(true);
  }

  function toggleModel(m: string) {
    setModels((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  }

  function researchBadge(field: keyof ResearchKeys) {
    // Brave stays hard-off while BRAVE_ENABLED is false — the key cannot be used anyway.
    if (field === "braveKey" && !BRAVE_ENABLED) {
      return <Badge variant="outline">{tr("blocked")}</Badge>;
    }
    if (field === "tavilyKey" && tavilyStatus === "invalid") {
      return <Badge variant="destructive">{tr("invalid")}</Badge>;
    }
    return researchForm[field].trim() ? <Badge variant="success">{tr("ready")}</Badge> : <Badge variant="secondary">{tr("noKey")}</Badge>;
  }

  async function handleValidateTavily() {
    setTavilyStatus(null);
    setValidatingTavily(true);
    try {
      // Emits a search request to validate the key (spends 1 credit per click).
      await tavilySearch("personalize-my-cv test", researchForm.tavilyKey.trim());
      setTavilyStatus("ok");
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes("429")) {
        setTavilyStatus("rateLimit");
      } else if (msg.includes("401")) {
        setTavilyStatus("invalid");
      } else {
        toast.error(te("validateFailed", { status: msg.split(":")[0] ?? msg }), { description: msg.slice(0, 300) });
      }
    } finally {
      setValidatingTavily(false);
    }
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
        setError(t("minOneModel"));
        return;
      }
      const research: ResearchKeys = {
        tavilyKey: researchForm.tavilyKey.trim(),
        braveKey: researchForm.braveKey.trim(),
        jinaKey: researchForm.jinaKey.trim(),
        youtubeKey: researchForm.youtubeKey.trim(),
        githubToken: researchForm.githubToken.trim(),
      };
      saveSettings({ geminiKey: trimmed, models: all, research });
      toast.success(t("updated"));
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  function handleClearKey() {
    if (!window.confirm(t("confirmClear"))) return;
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
    toast.success(t("exported"));
  }

  async function handleImportFile(file: File) {
    try {
      importBackup(await file.text());
      toast.success(t("imported"));
      window.location.reload();
    } catch (e) {
      toast.error(t("invalidBackup"), { description: (e as Error).message.slice(0, 300) });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function handleWipeAll() {
    wipeAll();
    window.location.reload();
  }

  const options = Array.from(new Set([...DEFAULT_GEMINI_MODELS, ...models]));

  return (
    <>
      <Button variant="outline" onClick={handleOpen}>
        <LuSettings /> {t("open")}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("desc")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener"
              className="text-sm underline"
            >
              {t("createKeyLink")}
            </a>
            <input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder={t("keyPlaceholder")}
              className="w-full rounded border p-2 text-sm"
              disabled={loading}
            />
            <fieldset className="space-y-1">
              <legend className="text-sm font-medium">{t("modelsLegend")}</legend>
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
                placeholder={t("customPlaceholder")}
                className="w-full rounded border p-2 text-sm"
                disabled={loading}
              />
            </fieldset>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
                {t("cancel")}
              </Button>
              <Button variant="outline" onClick={handleClearKey} disabled={loading}>
                {t("clearKey")}
              </Button>
              <Button onClick={handleSave} disabled={loading || !key.trim()}>
                {loading ? t("validating") : t("save")}
              </Button>
            </div>
          </div>
          {/* Pesquisa: BYOK research keys (Task 7). Renders after the Gemini key block, before Backup. */}
          <div className="space-y-2 border-t pt-3">
            <p className="text-sm font-medium">{tr("title")}</p>
            <p className="text-xs text-muted-foreground">{tr("desc")}</p>
            {RESEARCH_FIELDS.map(({ field, provider }) => (
              <div key={field} className="space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label htmlFor={field} className="text-sm font-medium">
                    {tr(field)}
                  </label>
                  <span className="flex items-center gap-2">
                    {researchBadge(field)}
                    {field === "tavilyKey" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleValidateTavily}
                        disabled={loading || validatingTavily || !researchForm.tavilyKey.trim()}
                      >
                        {validatingTavily ? t("validating") : tr("validate")}
                      </Button>
                    )}
                  </span>
                </div>
                <input
                  id={field}
                  type="password"
                  value={researchForm[field]}
                  onChange={(e) => setResearchForm({ ...researchForm, [field]: e.target.value })}
                  placeholder={tr(field)}
                  className="w-full rounded border p-2 text-sm"
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">{tr(`${provider}Desc`)}</p>
                <a href={tr(`links.${provider}`)} target="_blank" rel="noopener" className="text-xs underline">
                  {tr(`links.${provider}`)}
                </a>
                {field === "tavilyKey" ? <p className="text-xs text-muted-foreground">{tr("validateNote")}</p> : null}
                {field === "tavilyKey" && tavilyStatus === "rateLimit" ? (
                  <p className="text-xs text-destructive">{te("researchRateLimit")}</p>
                ) : null}
              </div>
            ))}
          </div>
          <div className="space-y-2 border-t pt-3">
            <p className="text-sm font-medium">{t("backup")}</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={handleExport}>
                {t("export")}
              </Button>
              <Button variant="outline" onClick={() => fileRef.current?.click()}>
                {t("import")}
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
          <div className="space-y-2 border-t border-destructive/30 pt-3">
            <p className="text-sm font-medium text-destructive">{t("wipeAll")}</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="destructive" onClick={() => setConfirmWipe(true)} disabled={loading}>
                {t("wipeAll")}
              </Button>
            </div>
          </div>
        </div>
      </Dialog>
      <Dialog open={confirmWipe} onClose={() => setConfirmWipe(false)}>
        <DialogHeader>
          <DialogTitle>{t("wipeTitle")}</DialogTitle>
          <DialogDescription>{t("wipeDesc")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setConfirmWipe(false)}>
            {t("cancel")}
          </Button>
          <Button variant="destructive" onClick={handleWipeAll}>
            {t("wipeConfirm")}
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  );
}
