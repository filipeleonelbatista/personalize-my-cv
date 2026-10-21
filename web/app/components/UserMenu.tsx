"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { LuChevronDown, LuPrinter, LuRefreshCw, LuSettings2 } from "react-icons/lu";
import { openResumePdf } from "@/lib/pdf/client";
import { loadBase } from "@/lib/store";
import { Button } from "./ui/button";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Dropdown, DropdownItem } from "./ui/dropdown";
import { BaseSetup } from "./BaseSetup";
import { SettingsDialog } from "./SettingsDialog";

export function UserMenu() {
  const t = useTranslations("UserMenu");
  const [baseSetupOpen, setBaseSetupOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const base = loadBase();
  const name = base?.resume?.cabecalho?.nome ?? "Usuário";
  const initials = useMemo(() => {
    const words = name.split(/\s+/).filter(Boolean).slice(0, 2);
    const letters = words.map((word) => word[0]?.toUpperCase() ?? "").join("");
    return letters || "U";
  }, [name]);

  async function printBase() {
    const current = loadBase();
    if (!current) {
      toast.error(t("noBase"));
      return;
    }
    try {
      await openResumePdf(current.resume, current.lang);
    } catch (err) {
      toast.error(t("printFail"), { description: (err as Error).message });
    }
  }

  return (
    <>
      <Dropdown
        trigger={
          <Button variant="outline" className="flex items-center gap-2 rounded-full px-2 py-1.5 shadow-sm">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              {initials}
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 text-sm">
              <span className="font-medium">{t("welcome", { name })}</span>
              <LuChevronDown className="h-4 w-4 opacity-70" />
            </span>
          </Button>
        }
      >
        <DropdownItem onSelect={printBase}>
          <LuPrinter /> {t("printBase")}
        </DropdownItem>
        <DropdownItem onSelect={() => setBaseSetupOpen(true)}>
          <LuRefreshCw /> {t("resendBase")}
        </DropdownItem>
        <DropdownItem onSelect={() => setSettingsOpen(true)}>
          <LuSettings2 /> {t("systemConfig")}
        </DropdownItem>
      </Dropdown>

      <Dialog open={baseSetupOpen} onClose={() => setBaseSetupOpen(false)} className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("resendBase")}</DialogTitle>
          <DialogDescription>{t("resendDesc")}</DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <BaseSetup onDone={() => setBaseSetupOpen(false)} />
        </div>
      </Dialog>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
