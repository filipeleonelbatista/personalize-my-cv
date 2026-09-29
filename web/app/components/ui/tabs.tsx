"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const TabsCtx = React.createContext<{ value: string; onChange: (v: string) => void } | null>(null);

export function Tabs({ value, onChange, children, className }: { value: string; onChange: (v: string) => void; children: React.ReactNode; className?: string }) {
  const ctx = React.useMemo(() => ({ value, onChange }), [value, onChange]);
  return (
    <TabsCtx.Provider value={ctx}>
      <div className={cn("space-y-4", className)}>{children}</div>
    </TabsCtx.Provider>
  );
}

export function TabsList({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground", className)}>
      {children}
    </div>
  );
}

export function TabsTrigger({ value, children }: { value: string; children: React.ReactNode }) {
  const ctx = React.useContext(TabsCtx);
  const active = ctx?.value === value;
  return (
    <button
      type="button"
      onClick={() => ctx?.onChange(value)}
      className={cn(
        "inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
        active ? "bg-background text-foreground shadow" : "hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, children }: { value: string; children: React.ReactNode }) {
  const ctx = React.useContext(TabsCtx);
  if (ctx?.value !== value) return null;
  return <div>{children}</div>;
}
