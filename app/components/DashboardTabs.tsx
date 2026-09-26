"use client";

import { useState } from "react";
import { LuFileText, LuChartColumn } from "react-icons/lu";
import { GenerateModal } from "./GenerateModal";
import { VacancyTable } from "./VacancyTable";
import type { AppRow } from "./DetailDrawer";
import { BaseMenu } from "./BaseMenu";
import { ReportsSection } from "./ReportsSection";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import type { BaseLang } from "../../lib/llm/prompts";

export function DashboardTabs({ apps, lang }: { apps: AppRow[]; lang: BaseLang }) {
  const [tab, setTab] = useState("curriculos");
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
          <GenerateModal defaultLang={lang} />
          <BaseMenu />
        </div>
      </div>
      <TabsContent value="curriculos">
        <VacancyTable apps={apps} />
      </TabsContent>
      <TabsContent value="relatorios">
        <ReportsSection />
      </TabsContent>
    </Tabs>
  );
}
