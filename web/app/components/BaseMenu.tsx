"use client";

import { useState } from "react";
import { toast } from "sonner";
import { LuSettings, LuPrinter, LuRefreshCw } from "react-icons/lu";
import { loadBase } from "@/lib/store";
import { openResumePdf } from "@/lib/pdf/client";
import { BaseSetup } from "./BaseSetup";
import { Button } from "./ui/button";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Dropdown, DropdownItem } from "./ui/dropdown";

export function BaseMenu() {
  const [dialogOpen, setDialogOpen] = useState(false);

  async function onPrintBase() {
    const base = loadBase();
    if (!base) {
      toast.error("Cadastre o currículo base primeiro.");
      return;
    }
    try {
      await openResumePdf(base.resume, base.lang);
    } catch (err) {
      toast.error("Falha ao abrir PDF", { description: (err as Error).message });
    }
  }

  return (
    <>
      <Dropdown
        trigger={
          <Button variant="outline" size="icon" title="Opções do currículo base" aria-label="Opções do currículo base">
            <LuSettings />
          </Button>
        }
      >
        <DropdownItem onSelect={onPrintBase}>
          <LuPrinter /> Imprimir currículo base
        </DropdownItem>
        <DropdownItem onSelect={() => setDialogOpen(true)}>
          <LuRefreshCw /> Atualizar currículo
        </DropdownItem>
      </Dropdown>
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
        <DialogHeader>
          <DialogTitle>Atualizar currículo</DialogTitle>
          <DialogDescription>A IA vai recatalogar seus dados a partir do novo PDF.</DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <BaseSetup onDone={() => window.location.reload()} />
        </div>
      </Dialog>
    </>
  );
}
