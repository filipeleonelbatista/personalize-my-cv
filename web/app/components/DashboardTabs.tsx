"use client";

import { useEffect, useState } from "react";
import { LuFileText, LuChartColumn } from "react-icons/lu";
import { useTranslations } from "next-intl";
import { loadApps, type StoredApp } from "@/lib/store";
import { DossierDialog } from "./DossierDialog";
import { GenerateModal } from "./GenerateModal";
import { VacancyTable } from "./VacancyTable";
import { BaseMenu } from "./BaseMenu";
import { SettingsDialog } from "./SettingsDialog";
import { ReportsSection } from "./ReportsSection";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import type { BaseLang } from "../../lib/llm/prompts";

export function DashboardTabs({ apps: initialApps, lang }: { apps: StoredApp[]; lang: BaseLang }) {
  const t = useTranslations("Dashboard");
  const [tab, setTab] = useState("curriculos");
  const [apps, setApps] = useState<StoredApp[]>(initialApps);
  const [dossierApp, setDossierApp] = useState<StoredApp | null>(null);

  useEffect(() => {
    setApps(initialApps);
  }, [initialApps]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "pmcv:apps" || e.key === null) setApps(loadApps());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <Tabs value={tab} onChange={setTab} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <TabsList>
          <TabsTrigger value="curriculos">
            <LuFileText /> {t("resumes")}
          </TabsTrigger>
          <TabsTrigger value="relatorios">
            <LuChartColumn /> {t("reports")}
          </TabsTrigger>
        </TabsList>
        <div id="settings" className="flex flex-wrap gap-2">
          <GenerateModal defaultLang={lang} onChanged={setApps} />
          <BaseMenu />
          <SettingsDialog />
        </div>
      </div>
      <TabsContent value="curriculos">
        <VacancyTable apps={apps} onChanged={setApps} onOpenDossier={(app) => setDossierApp(app)} />
        {dossierApp ? <DossierDialog app={dossierApp} onClose={() => setDossierApp(null)} onChanged={setApps} /> : null}
      </TabsContent>
      <TabsContent value="relatorios">
        <ReportsSection />
      </TabsContent>
    </Tabs>
  );
}
