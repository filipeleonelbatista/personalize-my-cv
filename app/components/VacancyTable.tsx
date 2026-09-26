"use client";

import { useState } from "react";
import { toast } from "sonner";
import { LuEye, LuDownload, LuPrinter, LuRotateCcw, LuLoaderCircle, LuTrash2 } from "react-icons/lu";
import { retryTailor, deleteApplication } from "../actions";
import { Button, buttonVariants } from "./ui/button";
import { Badge } from "./ui/badge";
import { Card, CardContent } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Progress } from "./ui/progress";
import { DetailDrawer, type AppRow } from "./DetailDrawer";
import { cn } from "@/lib/utils";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR");
}

export function VacancyTable({ apps }: { apps: AppRow[] }) {
  const [selected, setSelected] = useState<AppRow | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  async function onDelete(id: number) {
    if (!window.confirm("Excluir este currículo? O PDF também será apagado.")) return;
    setBusyId(id);
    try {
      const r = await deleteApplication(id);
      if (r.ok) {
        toast.success("Currículo excluído!");
        window.location.reload();
      } else {
        toast.error("Falha ao excluir", { description: r.error });
      }
    } catch (err) {
      toast.error("Falha ao excluir", { description: (err as Error).message });
    } finally {
      setBusyId(null);
    }
  }

  async function onRetry(id: number) {
    setBusyId(id);
    try {
      const r = await retryTailor(id);
      if (r.ok) {
        toast.success("Currículo regenerado!");
        window.location.reload();
      } else {
        toast.error("Retry falhou", { description: r.error });
      }
    } catch (err) {
      toast.error("Retry falhou", { description: (err as Error).message });
    } finally {
      setBusyId(null);
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
          {apps.map((app) => (
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
                  {app.pdfPath ? (
                    <>
                      <a
                        href={app.pdfPath}
                        download={app.fileName}
                        title="Baixar"
                        className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
                      >
                        <LuDownload />
                      </a>
                      <a
                        href={`/api/applications/${app.id}/pdf`}
                        target="_blank"
                        rel="noopener"
                        title="Imprimir"
                        className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
                      >
                        <LuPrinter />
                      </a>
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
      {selected ? <DetailDrawer app={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}
