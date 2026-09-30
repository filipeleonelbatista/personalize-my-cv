"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { LuUpload, LuFileText, LuX } from "react-icons/lu";
import { cn } from "@/lib/utils";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function Dropzone({
  accept = "application/pdf",
  file,
  onFile,
  onClear,
  disabled,
}: {
  accept?: string;
  file: File | null;
  onFile: (f: File) => void;
  onClear: () => void;
  disabled?: boolean;
}) {
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const t = useTranslations("Dropzone");

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  }

  return (
    <div>
      {!file ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={cn(
            "flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors",
            dragging
              ? "border-primary bg-accent"
              : "border-border bg-muted/30 hover:border-muted-foreground hover:bg-muted/50"
          )}
        >
          <LuUpload className="size-8 text-muted-foreground" />
          <span className="text-sm font-medium">{t("cta")}</span>
          <span className="text-xs text-muted-foreground">{t("onlyPdf")}</span>
        </button>
      ) : (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
          <LuFileText className="size-8 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1 text-left">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">{formatSize(file.size)}</p>
          </div>
          {!disabled ? (
            <button type="button" onClick={onClear} aria-label={t("remove")} className="rounded p-1 hover:bg-accent">
              <LuX className="size-4" />
            </button>
          ) : null}
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
    </div>
  );
}
