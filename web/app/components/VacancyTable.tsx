"use client";

import { useState } from "react";
import { toast } from "sonner";
import { LuEye, LuDownload, LuPrinter, LuRotateCcw, LuLoaderCircle, LuTrash2, LuChevronLeft, LuChevronRight } from "react-icons/lu";
import { loadApps, saveApps, type StoredApp } from "@/lib/store";
import { retryStoredApp } from "@/lib/tailor-client";
import { resumeToBlob, openResumePdf } from "@/lib/pdf/client";
import { paginate, PAGE_SIZES, DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Card, CardContent } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Select } from "./ui/select";
import { Progress } from "./ui/progress";
import { DetailDrawer } from "./DetailDrawer";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR");
}

export function VacancyTable({ apps, onChanged }: { apps: StoredApp[]; onChanged?: (apps: StoredApp[]) => void }) {
  const [selected, setSelected] = useState<StoredApp | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const { page: current, pageCount, start, end } = paginate(apps.length, page, pageSize);
  const visible = apps.slice(start - 1, end);

  function refresh() {
    onChanged?.(loadApps());
  }

  async function onDelete(id: string) {
    if (!window.confirm("Excluir este currículo?")) return;
    setBusyId(id);
    try {
      saveApps(loadApps().filter((a) => a.id !== id));
      toast.success("Currículo excluído!");
      refresh();
    } catch (err) {
      toast.error("Falha ao excluir", { description: (err as Error).message });
    } finally {
      setBusyId(null);
    }
  }

  async function onRetry(id: string) {
    setBusyId(id);
    try {
      const r = await retryStoredApp(id);
      if (r.ok) {
        toast.success("Currículo regenerado!");
      } else {
        toast.error("Retry falhou", { description: r.error });
      }
      refresh();
    } catch (err) {
      toast.error("Retry falhou", { description: (err as Error).message });
    } finally {
      setBusyId(null);
    }
  }

  async function onDownload(app: StoredApp) {
    try {
      const blob = await resumeToBlob(app.resume, app.lang);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = app.fileName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (err) {
      toast.error("Falha ao gerar PDF", { description: (err as Error).message });
    }
  }

  async function onPrint(app: StoredApp) {
    try {
      await openResumePdf(app.resume, app.lang);
    } catch (err) {
      toast.error("Falha ao abrir PDF", { description: (err as Error).message });
    }
  }

  if (!apps.length) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Nenhum currículo gerado ainda. Clique em “Personalizar com IA”.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cargo</TableHead>
            <TableHead>Empresa</TableHead>
            <TableHead>Match</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Data</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.map((app) => (
            <TableRow key={app.id}>
              <TableCell className="font-medium">{app.cargo}</TableCell>
              <TableCell>{app.empresa}</TableCell>
              <TableCell>
                {app.status === "done" ? (
                  <div className="flex min-w-24 items-center gap-2">
                    <Progress value={app.matchPercent} className="w-16" />
                    <span className="text-xs">{app.matchPercent}%</span>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                <Badge variant={app.status === "done" ? "success" : "destructive"}>
                  {app.status === "done" ? "Pronto" : "Falhou"}
                </Badge>
              </TableCell>
              <TableCell className="whitespace-nowrap text-xs">{fmtDate(app.createdAt)}</TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" title="Ver" onClick={() => setSelected(app)}>
                    <LuEye />
                  </Button>
                  {app.status === "done" ? (
                    <>
                      <Button variant="ghost" size="icon" title="Baixar" onClick={() => onDownload(app)}>
                        <LuDownload />
                      </Button>
                      <Button variant="ghost" size="icon" title="Imprimir" onClick={() => onPrint(app)}>
                        <LuPrinter />
                      </Button>
                    </>
                  ) : null}
                  {app.status === "failed" ? (
                    <Button variant="ghost" size="icon" title="Tentar novamente" disabled={busyId === app.id} onClick={() => onRetry(app.id)}>
                      {busyId === app.id ? <LuLoaderCircle className="animate-spin" /> : <LuRotateCcw />}
                    </Button>
                  ) : null}
                  <Button variant="ghost" size="icon" title="Excluir" disabled={busyId === app.id} onClick={() => onDelete(app.id)}>
                    <LuTrash2 />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="text-xs text-muted-foreground">
          Mostrando {start}–{end} de {apps.length}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={current <= 1} onClick={() => setPage(current - 1)}>
            <LuChevronLeft /> Anterior
          </Button>
          <span className="text-xs text-muted-foreground">
            Página {current} de {Math.max(pageCount, 1)}
          </span>
          <Button variant="outline" size="sm" disabled={current >= pageCount} onClick={() => setPage(current + 1)}>
            Próxima <LuChevronRight />
          </Button>
          <label className="flex items-center gap-1 text-xs text-muted-foreground">
            <Select
              value={String(pageSize)}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
            >
              {PAGE_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
            por página
          </label>
        </div>
      </div>
      {selected ? <DetailDrawer app={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}
