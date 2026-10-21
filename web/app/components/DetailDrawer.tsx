"use client";

import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { LuDownload, LuPrinter, LuBuilding2 } from "react-icons/lu";
import { resumeToBlob, openResumePdf } from "@/lib/pdf/client";
import { getLocale } from "@/lib/i18n/locale";
import { verdictVariant } from "@/lib/dossier";
import type { StoredApp } from "@/lib/store";
import { Button } from "./ui/button";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
import { CopyButton } from "./CopyButton";

export type AppRow = StoredApp;

export function DetailDrawer({ app, onClose, onOpenDossier }: { app: AppRow; onClose: () => void; onOpenDossier?: (app: StoredApp) => void }) {
  const t = useTranslations("Detail");
  const td = useTranslations("Dossier");
  async function onDownload() {
    try {
      const blob = await resumeToBlob(app.resume, app.lang);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = app.fileName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (err) {
      toast.error(t("downloadFail"), { description: (err as Error).message });
    }
  }

  async function onPrint() {
    try {
      await openResumePdf(app.resume, app.lang);
    } catch (err) {
      toast.error(t("printFail"), { description: (err as Error).message });
    }
  }

  return (
    <Dialog open onClose={onClose}>
      <DialogHeader>
        <DialogTitle>
          {app.cargo} — {app.empresa}
        </DialogTitle>
        <DialogDescription>
          {t("generatedAt", { date: new Date(app.createdAt).toLocaleString(getLocale()), file: app.fileName })}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-4">
        {app.status === "done" ? (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={onDownload}>
              <LuDownload /> {t("download")}
            </Button>
            <Button variant="outline" size="sm" onClick={onPrint}>
              <LuPrinter /> {t("print")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => onOpenDossier?.(app)}>
              <LuBuilding2 /> {td("open")}
            </Button>
            <Badge variant="success">{t("done")}</Badge>
          </div>
        ) : (
          <p className="text-sm text-destructive">{t("noPdf", { error: app.errorLog })}</p>
        )}

        {app.status === "done" ? (
          <>
            <div className="space-y-1">
              <p className="text-sm font-bold">{t("affinity", { n: app.matchPercent })}</p>
              <Progress value={app.matchPercent} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm font-bold">{t("strengths")}</p>
                <ul className="list-disc pl-5 text-sm">
                  {app.strengths.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-sm font-bold">{t("weaknesses")}</p>
                <ul className="list-disc pl-5 text-sm">
                  {app.weaknesses.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            </div>
            {app.dossierMatch ? (
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={verdictVariant(app.dossierMatch.alignment.verdict)}>
                  {td(`enums.verdict.${app.dossierMatch.alignment.verdict}`)}
                </Badge>
                <Badge variant="outline">{app.dossierMatch.alignment.score}%</Badge>
                <Badge variant="destructive">
                  {td("match.redFlagCount", { n: app.dossierMatch.redFlagSummary.length })}
                </Badge>
                {app.dossierMatch.stale ? <Badge variant="outline">{td("stale")}</Badge> : null}
              </div>
            ) : null}
            <div>
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold">{t("email")}</p>
                <CopyButton text={app.emailBody} label={t("emailShort")} />
              </div>
              <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">{app.emailBody}</pre>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold">{t("chat")}</p>
                <CopyButton text={app.chatMessage} label={t("chatShort")} />
              </div>
              <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">{app.chatMessage}</pre>
            </div>
          </>
        ) : null}

        <details>
          <summary className="cursor-pointer text-sm text-muted-foreground">{t("viewJob")}</summary>
          <pre className="mt-2 whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">{app.jobText}</pre>
        </details>
      </div>
    </Dialog>
  );
}
