"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { BaseSetupDialog } from "./components/BaseSetupDialog";
import { DashboardTabs } from "./components/DashboardTabs";
import { HelpDialog } from "./components/HelpDialog";
import { LocaleSelector } from "./components/LocaleSelector";
import { Onboarding } from "./components/Onboarding";
import { ThemeToggle } from "./components/theme-toggle";
import type { BaseLang } from "@/lib/llm/prompts";
import type { Resume } from "@/lib/resume-schema";
import { isOnboarded, loadApps, loadBase, loadSettings, setOnboarded, type StoredApp } from "@/lib/store";
import Loading from "./loading";

export default function Page() {
  const t = useTranslations("Page");
  const [phase, setPhase] = useState<"loading" | "onboarding" | "dashboard">("loading");
  const [base, setBase] = useState<Resume | null>(null);
  const [apps, setApps] = useState<StoredApp[]>([]);
  const [lang, setLang] = useState<BaseLang>("pt-BR");

  useEffect(() => {
    function refreshFromStore() {
      const stored = loadBase();
      setBase(stored ? stored.resume : null);
      setLang(stored ? stored.lang : "pt-BR");
      setApps(loadApps());
      // Self-heal legado: chave + base válidas sem a flag (estado pré-onboarding).
      if (!isOnboarded() && loadSettings().geminiKey && stored) setOnboarded(true);
      setPhase(isOnboarded() ? "dashboard" : "onboarding");
    }
    refreshFromStore();
    // Cross-tab: outra aba pode concluir o onboarding ou mudar base/apps.
    window.addEventListener("storage", refreshFromStore);
    return () => window.removeEventListener("storage", refreshFromStore);
  }, []);

  if (phase === "loading") return <Loading />;

  if (phase === "onboarding") {
    return (
      <main className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6">
        <header className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Personalize My CV</h1>
            <p className="text-sm text-muted-foreground">{t("tagline")}</p>
          </div>
          <div className="flex items-center gap-1">
            <LocaleSelector />
            <HelpDialog />
            <ThemeToggle />
          </div>
        </header>
        <Onboarding onDone={() => window.location.reload()} />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6">
      <header className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Personalize My CV</h1>
          {base ? (
            <p className="text-sm text-muted-foreground">
              {t("baseLine", { nome: base.cabecalho.nome, titulo: base.cabecalho.titulo_profissional })}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">{t("tagline")}</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <LocaleSelector />
          <HelpDialog />
          <ThemeToggle />
        </div>
      </header>

      {!base ? (
        <div className="space-y-4 pt-10 text-center">
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            {t("noBaseCta")}
          </p>
          <div className="flex justify-center">
            <BaseSetupDialog label={t("sendBase")} description={t("catalogDesc")} />
          </div>
        </div>
      ) : (
        <DashboardTabs apps={apps} lang={lang} />
      )}
    </main>
  );
}
