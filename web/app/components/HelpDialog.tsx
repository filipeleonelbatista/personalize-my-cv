// web/app/components/HelpDialog.tsx
"use client";
import { useState } from "react";
import { LuCircleHelp } from "react-icons/lu";
import { useTranslations } from "next-intl";
import { Button } from "./ui/button";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";

export function HelpDialog() {
  const [open, setOpen] = useState(false);
  const t = useTranslations("Help");
  return (
    <>
      <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label={t("open")}>
        <LuCircleHelp />
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("desc")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-4 text-sm">
          {["s1", "s2", "s3", "s4"].map((s) => (
            <div key={s}>
              <p className="font-bold">{t(`${s}t`)}</p>
              <p className="text-muted-foreground">{t(`${s}d`)}</p>
            </div>
          ))}
        </div>
      </Dialog>
    </>
  );
}
