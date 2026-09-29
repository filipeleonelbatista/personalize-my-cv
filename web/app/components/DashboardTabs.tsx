"use client";

import { useEffect, useState } from "react";
import { LuFileText, LuChartColumn } from "react-icons/lu";
import { loadApps, type StoredApp } from "@/lib/store";
import { GenerateModal } from "./GenerateModal";
import { VacancyTable } from "./VacancyTable";
import { BaseMenu } from "./BaseMenu";
import { ReportsSection } from "./ReportsSection";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import type { BaseLang } from "../../lib/llm/prompts";

export function DashboardTabs({ apps: initialApps, lang }: { apps: StoredApp[]; lang: BaseLang }) {
  const [tab, setTab] = useState("curriculos");
  const [apps, setApps] = useState<StoredApp[]>(initialApps);

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
            <LuFileText /> Currículos
          </TabsTrigger>
          <TabsTrigger value="relatorios">
            <LuChartColumn /> Relatórios
          </TabsTrigger>
        </TabsList>
        <div className="flex flex-wrap gap-2">
          <GenerateModal defaultLang={lang} onChanged={setApps} />
          <BaseMenu />
        </div>
      </div>
      <TabsContent value="curriculos">
        <VacancyTable apps={apps} onChanged={setApps} />
      </TabsContent>
      <TabsContent value="relatorios">
        <ReportsSection />
      </TabsContent>
    </Tabs>
  );
}
