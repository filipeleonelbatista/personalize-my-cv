"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { LuLoaderCircle } from "react-icons/lu";
import { runDossierFromDocs, runDossierJob, runDossierMatch, type DossierStage } from "@/lib/dossier-client";
import { companyKey, isPlaceholderCompany } from "@/lib/dossier";
import type { Dossier, DossierMatch } from "@/lib/dossier-schema";
import { buildDossierMarkdown, dossierMarkdownFileName } from "@/lib/dossier-markdown";
import { findDossierByCompany, loadApps, loadSettings, saveApps, type StoredApp } from "@/lib/store";
import { jinaRead } from "@/lib/research/jina";
import type { ReadDoc } from "@/lib/research/providers";
import { getLocale, tErr } from "@/lib/i18n/locale";
import { cn } from "@/lib/utils";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Textarea } from "./ui/textarea";
import { DossierPanel } from "./DossierPanel";

type Phase = "form" | "busy" | "ready";
type Mode = "auto" | "urls" | "text";

export function DossierDialog({ app, onClose, onChanged }: { app: StoredApp; onClose: () => void; onChanged?: (apps: StoredApp[]) => void }) {
  const t = useTranslations("Dossier");
  const [locale] = useState(getLocale);
  const [settings] = useState(loadSettings);
  const placeholderCompany = isPlaceholderCompany(app.empresa, app.lang);

  const [company, setCompany] = useState(placeholderCompany ? "" : app.empresa);
  const [cnpj, setCnpj] = useState("");
  const [mode, setMode] = useState<Mode>("auto");
  const [urlsText, setUrlsText] = useState("");
  const [materialText, setMaterialText] = useState("");
  const [dossier, setDossier] = useState<Dossier | null>(() => {
    if (placeholderCompany) return null;
    const existing = findDossierByCompany(companyKey(app.empresa));
    return existing && existing.status === "done" ? existing : null;
  });
  const [match, setMatch] = useState<DossierMatch | null>(() => (dossier ? app.dossierMatch ?? null : null));
  const [phase, setPhase] = useState<Phase>(dossier ? "ready" : "form");
  const [stage, setStage] = useState<DossierStage | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const hasTavilyKey = !!settings.research.tavilyKey.trim();
  const urlLines = urlsText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  const modes: Array<{ id: Mode; title: string; description: string }> = [
    { id: "auto", title: t("auto"), description: t("autoDesc") },
    { id: "urls", title: t("manualUrls"), description: t("manualUrlsDesc") },
    { id: "text", title: t("manualText"), description: t("manualTextDesc") },
  ];

  const canStart =
    (mode !== "auto" || hasTavilyKey) &&
    (mode !== "urls" || urlLines.length > 0) &&
    (mode !== "text" || materialText.trim().length > 0);

  async function build() {
    const name = company.trim();
    if (!name) {
      setError(t("companyRequired"));
      return;
    }
    if (mode === "urls" && urlLines.length === 0) {
      setError(tErr(locale, "noUrls"));
      return;
    }

    setError("");
    setStage(null);
    setPhase("busy");
    try {
      if (mode === "auto") {
        const result = await runDossierJob({
          company: name,
          cnpj: cnpj.trim() || null,
          lang: app.lang,
          force: true,
          onStage: setStage,
        });
        if (!result.ok) {
          setError(result.error);
          setPhase("form");
          return;
        }
        setDossier(result.dossier);
        setMatch(result.match ?? null);
        setPhase("ready");
        return;
      }

      const docs: ReadDoc[] = [];
      if (mode === "urls") {
        const failed: string[] = [];
        const jinaKey = loadSettings().research.jinaKey || undefined;
        for (const url of urlLines) {
          try {
            docs.push(await jinaRead(url, jinaKey));
          } catch {
            failed.push(url);
          }
        }
        if (docs.length === 0) {
          setError(failed.join("\n") || tErr(locale, "noUrls"));
          setPhase("form");
          return;
        }
        if (failed.length > 0) setError(failed.join("\n"));
      } else {
        docs.push({
          url: "pmcv:material:1",
          title: t("manualText"),
          publishedAt: null,
          content: materialText,
          provider: "user",
        });
      }

      const result = await runDossierFromDocs({ company: name, lang: app.lang, docs, onStage: setStage });
      if (!result.ok) {
        setError(result.error);
        setPhase("form");
        return;
      }
      setDossier(result.dossier);
      setMatch(result.match ?? null);
      setPhase("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase("form");
    }
  }

  async function analyze() {
    setBusy(true);
    try {
      // O dossiê do diálogo manda: `app.empresa` pode ter sido editado aqui
      // (ou ser o placeholder "Empresa"), então associa a vaga ao dossiê aberto.
      const result = await runDossierMatch({ ...app, dossierId: dossier?.id ?? app.dossierId });
      if (result.ok) {
        setMatch(result.match);
        onChanged?.(loadApps());
      } else {
        toast.error(result.error);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function refresh() {
    if (!dossier) return;
    const current = dossier;
    setBusy(true);
    try {
      const result = await runDossierJob({ company: current.company, lang: app.lang, force: true });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setDossier(result.dossier);
      setMatch((previous) => (previous ? { ...previous, stale: true } : previous));
      saveApps(
        loadApps().map((item) =>
          item.dossierId === current.id
            ? { ...item, dossierMatch: item.dossierMatch ? { ...item.dossierMatch, stale: true } : null }
            : item,
        ),
      );
      onChanged?.(loadApps());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function regenerateLang() {
    if (!dossier) return;
    setError("");
    setStage(null);
    setPhase("busy");
    try {
      const jinaKey = loadSettings().research.jinaKey || undefined;
      const docs: ReadDoc[] = [];
      for (const source of dossier.sources) {
        try {
          docs.push(await jinaRead(source.url, jinaKey));
        } catch {
          /* fonte bloqueada: segue com as demais */
        }
      }
      if (docs.length === 0) {
        setError(tErr(locale, "noUrls"));
        setPhase("ready");
        return;
      }
      const result = await runDossierFromDocs({ company: dossier.company, lang: app.lang, docs, onStage: setStage });
      if (!result.ok) {
        setError(result.error);
        setPhase("ready");
        return;
      }
      setDossier(result.dossier);
      setMatch((previous) => (previous ? { ...previous, stale: true } : previous));
      setPhase("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase("ready");
    }
  }

  function exportMarkdown() {
    if (!dossier) return;
    const blob = new Blob([buildDossierMarkdown(dossier, match)], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = dossierMarkdownFileName(dossier);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  return (
    <Dialog open onClose={onClose} size="wide">
      <DialogHeader>
        <div className="flex items-start justify-between gap-2">
          <DialogTitle>{t("title")}</DialogTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t("close")}
          </Button>
        </div>
        <DialogDescription>{dossier ? dossier.company : company.trim() || app.empresa}</DialogDescription>
      </DialogHeader>

      <div className="py-4">
        {phase === "form" ? (
          <div className="space-y-4">
            <p className="rounded-md border border-border bg-muted p-3 text-xs text-muted-foreground">{t("consentNotice")}</p>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-medium">{t("company")}</span>
                <input
                  value={company}
                  onChange={(event) => setCompany(event.target.value)}
                  placeholder={t("companyPlaceholder")}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">{t("cnpj")}</span>
                <input
                  value={cnpj}
                  onChange={(event) => setCnpj(event.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              {modes.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setMode(option.id)}
                  className={cn(
                    "rounded-md border p-3 text-left text-sm transition-colors",
                    mode === option.id ? "border-primary bg-accent" : "border-border hover:bg-accent/50",
                  )}
                >
                  <span className="block font-medium">{option.title}</span>
                  <span className="block text-xs text-muted-foreground">{option.description}</span>
                </button>
              ))}
            </div>

            {mode === "auto" && !hasTavilyKey ? (
              <a href="#settings" onClick={onClose} className="block text-sm text-destructive underline">
                {tErr(locale, "noResearchKey")}
              </a>
            ) : null}

            {mode === "urls" ? (
              <Textarea
                value={urlsText}
                onChange={(event) => setUrlsText(event.target.value)}
                placeholder={t("manualUrlsDesc")}
              />
            ) : null}

            {mode === "text" ? (
              <Textarea
                value={materialText}
                onChange={(event) => setMaterialText(event.target.value)}
                placeholder={t("manualTextDesc")}
                className="min-h-[160px]"
              />
            ) : null}

            {error ? <p className="whitespace-pre-wrap text-sm text-destructive">{error}</p> : null}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>
                {t("cancel")}
              </Button>
              <Button onClick={build} disabled={!canStart}>
                {t("start")}
              </Button>
            </div>
          </div>
        ) : null}

        {phase === "busy" ? (
          <div className="space-y-3 py-10 text-center">
            <LuLoaderCircle className="mx-auto h-6 w-6 animate-spin" />
            <p className="text-sm">{stage ? t(`stage.${stage}`) : t("stage.search")}</p>
            <p className="text-xs text-muted-foreground">{t("durationNote")}</p>
            <Button variant="outline" onClick={onClose}>
              {t("cancel")}
            </Button>
          </div>
        ) : null}

        {phase === "ready" && dossier ? (
          <div className="space-y-3">
            {dossier.lang !== app.lang ? (
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{t("langBadge", { lang: dossier.lang })}</Badge>
                <Button variant="outline" size="sm" onClick={regenerateLang} disabled={busy}>
                  {t("regenerateLang", { lang: app.lang })}
                </Button>
              </div>
            ) : null}
            {error ? <p className="whitespace-pre-wrap text-sm text-destructive">{error}</p> : null}
            <DossierPanel
              dossier={dossier}
              match={match}
              onAnalyze={analyze}
              onRefresh={refresh}
              onExportMd={exportMarkdown}
              busy={busy}
            />
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}
