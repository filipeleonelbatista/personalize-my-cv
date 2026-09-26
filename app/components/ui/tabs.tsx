import * as React from "react";
import { cn } from "@/lib/utils";

export function Tabs({ value, onChange, children, className }: { value: string; onChange: (v: string) => void; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-4", className)}>
      {React.Children.map(children, (child) =>
        React.isValidElement(child) ? React.cloneElement(child as React.ReactElement<{ __tabs?: { value: string; onChange: (v: string) => void } }>, { __tabs: { value, onChange } }) : child
      )}
    </div>
  );
}

export function TabsList({ children, className, __tabs }: { children: React.ReactNode; className?: string; __tabs?: { value: string; onChange: (v: string) => void } }) {
  return (
    <div className={cn("inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground", className)}>
      {React.Children.map(children, (child) =>
        React.isValidElement(child) ? React.cloneElement(child as React.ReactElement<{ __tabs?: unknown }>, { __tabs }) : child
      )}
    </div>
  );
}

export function TabsTrigger({ value, children, __tabs }: { value: string; children: React.ReactNode; __tabs?: { value: string; onChange: (v: string) => void } }) {
  const active = __tabs?.value === value;
  return (
    <button
      type="button"
      onClick={() => __tabs?.onChange(value)}
      className={cn(
        "inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
        active ? "bg-background text-foreground shadow" : "hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, children, __tabs }: { value: string; children: React.ReactNode; __tabs?: { value: string; onChange: (v: string) => void } }) {
  if (__tabs?.value !== value) return null;
  return <div>{children}</div>;
}
