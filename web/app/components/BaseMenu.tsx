"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { LuSettings, LuPrinter, LuRefreshCw } from "react-icons/lu";
import { loadBase } from "@/lib/store";
import { openResumePdf } from "@/lib/pdf/client";
import { BaseSetup } from "./BaseSetup";
import { Button } from "./ui/button";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Dropdown, DropdownItem } from "./ui/dropdown";

export function BaseMenu() {
  const t = useTranslations("Base");
  const te = useTranslations("Errors");
  const [dialogOpen, setDialogOpen] = useState(false);

  async function onPrintBase() {
    const base = loadBase();
    if (!base) {
      toast.error(te("noBase"));
      return;
    }
    try {
      await openResumePdf(base.resume, base.lang);
    } catch (err) {
      toast.error(t("openPdfFail"), { description: (err as Error).message });
    }
  }

  return (
    <>
      <Dropdown
        trigger={
          <Button variant="outline" size="icon" title={t("options")} aria-label={t("options")}>
            <LuSettings />
          </Button>
        }
      >
        <DropdownItem onSelect={onPrintBase}>
          <LuPrinter /> {t("print")}
        </DropdownItem>
        <DropdownItem onSelect={() => setDialogOpen(true)}>
          <LuRefreshCw /> {t("update")}
        </DropdownItem>
      </Dropdown>
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
        <DialogHeader>
          <DialogTitle>{t("updateTitle")}</DialogTitle>
          <DialogDescription>{t("updateDesc")}</DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <BaseSetup onDone={() => window.location.reload()} />
        </div>
      </Dialog>
    </>
  );
}
