"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useTranslations } from "next-intl";
import { LuChevronLeft, LuChevronRight, LuTrendingUp } from "react-icons/lu";
import { loadApps } from "@/lib/store";
import { getLocale } from "@/lib/i18n/locale";
import { bucketByWeekday, weekLabel, weekRange } from "@/lib/report";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Skeleton } from "./ui/skeleton";

type ClientWeekStats = {
  label: string;
  total: number;
  counts: number[];
  bestDay: string;
  avgPerDay: number;
};

const WEEKDAYS: Record<string, string[]> = {
  "pt-BR": ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"],
  "en-US": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  "es-ES": ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"],
};

function weekdayLabels(): string[] {
  return WEEKDAYS[getLocale()] ?? WEEKDAYS["pt-BR"];
}

function computeWeekStats(offset: number): ClientWeekStats {
  const { start, end } = weekRange(new Date(), offset);
  const endExclusive = new Date(end);
  endExclusive.setDate(endExclusive.getDate() + 1);
  const dates = loadApps()
    .map((a) => new Date(a.createdAt))
    .filter((d) => !Number.isNaN(d.getTime()) && d >= start && d < endExclusive);
  const counts = bucketByWeekday(dates);
  const total = dates.length;
  const best = counts.indexOf(Math.max(...counts));
  const labels = weekdayLabels();
  return {
    label: weekLabel(start, end),
    total,
    counts,
    bestDay: total ? labels[best] : "—",
    avgPerDay: Math.round((total / 7) * 10) / 10,
  };
}

export function ReportsSection() {
  const t = useTranslations("Reports");
  const [offset, setOffset] = useState(0);
  const [stats, setStats] = useState<ClientWeekStats | null>(null);

  useEffect(() => {
    setStats(computeWeekStats(offset));
    const onStorage = (e: StorageEvent) => {
      if (e.key === "pmcv:apps" || e.key === null) setStats(computeWeekStats(offset));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [offset]);

  const data = (stats?.counts ?? []).map((count, i) => ({ dia: weekdayLabels()[i], total: count }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" size="sm" onClick={() => setOffset((o) => o - 1)}>
          <LuChevronLeft /> {t("prevWeek")}
        </Button>
        <p className="text-sm font-medium">{stats ? stats.label : "…"}</p>
        <Button variant="outline" size="sm" disabled={offset >= 0} onClick={() => setOffset((o) => o + 1)}>
          {t("nextWeek")} <LuChevronRight />
        </Button>
      </div>

      {!stats ? (
        <Card>
          <CardContent className="space-y-2 pt-6">
            <Skeleton className="h-40 w-full" />
          </CardContent>
        </Card>
      ) : stats.total === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <LuTrendingUp className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader>
                <CardDescription>{t("totalWeek")}</CardDescription>
                <CardTitle className="text-3xl">{stats.total}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>{t("avgDay")}</CardDescription>
                <CardTitle className="text-3xl">{stats.avgPerDay}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>{t("bestDay")}</CardDescription>
                <CardTitle className="text-3xl">{stats.bestDay}</CardTitle>
              </CardHeader>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("chartTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data}>
                    <XAxis dataKey="dia" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} axisLine={false} tickLine={false} width={30} />
                    <Tooltip
                      cursor={{ fill: "var(--muted)" }}
                      contentStyle={{ background: "var(--popover)", color: "var(--popover-foreground)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                    />
                    <Bar dataKey="total" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
