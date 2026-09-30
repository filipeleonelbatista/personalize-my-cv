// web/app/offline/page.tsx
"use client";
import { useTranslations } from "next-intl";
import { Button } from "../components/ui/button";

export default function Offline() {
  const t = useTranslations("Offline");
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-xl font-bold">{t("title")}</h1>
      <p className="text-sm text-muted-foreground">{t("desc")}</p>
      <Button onClick={() => window.location.reload()}>{t("retry")}</Button>
    </main>
  );
}
