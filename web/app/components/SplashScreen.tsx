// web/app/components/SplashScreen.tsx
"use client";
import { useTranslations } from "next-intl";
import { LuLoaderCircle } from "react-icons/lu";

export function SplashScreen() {
  const t = useTranslations("Splash");
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center gap-4 p-6 text-center" aria-busy="true" aria-label={t("loading")}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon-192.png" alt="" width={96} height={96} className="rounded-3xl" />
      <h1 className="text-2xl font-bold tracking-tight">Personalize My CV</h1>
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <LuLoaderCircle className="animate-spin" /> {t("loading")}
      </p>
    </main>
  );
}
