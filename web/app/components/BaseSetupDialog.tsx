"use client";

import { useState } from "react";
import { LuUpload } from "react-icons/lu";
import { BaseSetup } from "./BaseSetup";
import { Button } from "./ui/button";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";

export function BaseSetupDialog({ label, description }: { label: string; description?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <LuUpload /> {label}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="py-4">
          <BaseSetup />
        </div>
      </Dialog>
    </>
  );
}
