"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function Dropdown({ trigger, children, align = "right" }: { trigger: React.ReactNode; children: React.ReactNode; align?: "left" | "right" }) {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open ]);

  return (
    <div className="relative inline-block">
      <div onClick={() => setOpen((o) => !o)}>{trigger}</div>
      {open ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className={cn(
              "absolute z-50 mt-1 min-w-52 overflow-hidden rounded-md border border-border bg-popover p-1 shadow-md animate-in fade-in zoom-in-95 duration-100",
              align === "right" ? "right-0" : "left-0"
            )}
          >
            {React.Children.map(children, (child) =>
              React.isValidElement(child)
                ? React.cloneElement(child as React.ReactElement<{ onSelect?: () => void }>, {
                    onSelect: () => {
                      (child as React.ReactElement<{ onSelect?: () => void }>).props.onSelect?.();
                      setOpen(false);
                    },
                  })
                : child
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

export function DropdownItem({
  children,
  onSelect,
  href,
  target,
}: {
  children: React.ReactNode;
  onSelect?: () => void;
  href?: string;
  target?: string;
}) {
  const cls =
    "flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground";
  if (href) {
    return (
      <a href={href} target={target} rel={target === "_blank" ? "noopener" : undefined} className={cls} onClick={onSelect}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" className={cn(cls, "text-left")} onClick={onSelect}>
      {children}
    </button>
  );
}
