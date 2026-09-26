"use client";

import { useState } from "react";
import { LuSettings, LuPrinter, LuRefreshCw } from "react-icons/lu";
import { BaseSetup } from "./BaseSetup";
import { Button } from "./ui/button";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Dropdown, DropdownItem } from "./ui/dropdown";

export function BaseMenu() {
  const [dialogOpen, setDialogOpen] = useState(false);
  return (
    <>
      <Dropdown
        trigger={
          <Button variant="outline" size="icon" title="Opções do currículo base" aria-label="Opções do currículo base">
            <LuSettings />
          </Button>
        }
      >
        <DropdownItem href="/api/base/pdf" target="_blank">
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
          <BaseSetup />
        </div>
      </Dialog>
    </>
  );
}
