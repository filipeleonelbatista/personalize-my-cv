"use client";

import { useState } from "react";
import { LuPrinter, LuFileText, LuChartColumn } from "react-icons/lu";
import { GenerateModal } from "./GenerateModal";
import { VacancyTable } from "./VacancyTable";
import type { AppRow } from "./DetailDrawer";
import { BaseSetupDialog } from "./BaseSetupDialog";
import { ReportsSection } from "./ReportsSection";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { buttonVariants } from "./ui/button";
import { cn } from "@/lib/utils";
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
          <a href="/api/base/pdf" target="_blank" rel="noopener" className={cn(buttonVariants({ variant: "outline" }))}>
            <LuPrinter /> Imprimir currículo base
          </a>
          <BaseSetupDialog label="Atualizar currículo" description="A IA vai recatalogar seus dados a partir do novo PDF." />
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
