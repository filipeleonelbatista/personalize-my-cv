"use client";

import { useEffect, useState } from "react";
import { BaseSetupDialog } from "./components/BaseSetupDialog";
import { DashboardTabs } from "./components/DashboardTabs";
import { Onboarding } from "./components/Onboarding";
import { ThemeToggle } from "./components/theme-toggle";
import type { BaseLang } from "@/lib/llm/prompts";
import type { Resume } from "@/lib/resume-schema";
import { loadApps, loadBase, loadSettings, type StoredApp } from "@/lib/store";
import Loading from "./loading";

export default function Page() {
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
    }
    const key = loadSettings().geminiKey;
    const stored = loadBase();
    if (!key || !stored) {
      setPhase("onboarding");
      return;
    }
    refreshFromStore();
    setPhase("dashboard");
    const onStorage = () => refreshFromStore();
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  if (phase === "loading") return <Loading />;

  if (phase === "onboarding") {
    return (
      <main className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6">
        <header className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Personalize My CV</h1>
            <p className="text-sm text-muted-foreground">Currículos sob medida com IA</p>
          </div>
          <ThemeToggle />
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
              Base: {base.cabecalho.nome} — {base.cabecalho.titulo_profissional}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Currículos sob medida com IA</p>
          )}
        </div>
        <ThemeToggle />
      </header>

      {!base ? (
        <div className="space-y-4 pt-10 text-center">
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            Envie seu currículo em PDF para começar. A IA vai catalogar seus dados e criar o JSON base.
          </p>
          <div className="flex justify-center">
            <BaseSetupDialog label="Enviar currículo base" description="A IA vai catalogar seus dados e criar o JSON base." />
          </div>
        </div>
      ) : (
        <DashboardTabs apps={apps} lang={lang} />
      )}
    </main>
  );
}
