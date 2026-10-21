"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { LuCopy, LuCheck } from "react-icons/lu";
import { Button } from "./ui/button";

export function CopyButton({ text, label }: { text: string; label: string }) {
  const t = useTranslations("Detail");
  const [done, setDone] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setDone(true);
    toast.success(t("copied", { label }));
    setTimeout(() => setDone(false), 1500);
  }
  return (
    <Button variant="ghost" size="sm" onClick={copy}>
      {done ? <LuCheck /> : <LuCopy />} {t("copy")}
    </Button>
  );
}
