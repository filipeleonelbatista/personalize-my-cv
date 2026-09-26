import { LuPrinter } from "react-icons/lu";
import { getBase, getBaseLang, listApplications } from "./actions";
import { BaseSetupDialog } from "./components/BaseSetupDialog";
import { VacancyTable } from "./components/VacancyTable";
import { GenerateModal } from "./components/GenerateModal";
import { ThemeToggle } from "./components/theme-toggle";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";
import { buttonVariants } from "./components/ui/button";
import { cn } from "@/lib/utils";

export default async function Page() {
  const base = await getBase();
  const rows = base ? await listApplications() : [];
  const apps = rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
  const lang = base ? await getBaseLang() : "pt-BR";

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6">
      <header className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Personalize My CV</h1>
          {base ? (
            <p className="text-sm text-muted-foreground">
              Base: {base.cabecalho.nome} — {base.cabecalho.titulo_profissional}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Currículos sob medida com IA</p>
          )}
        </div>
        <ThemeToggle />
      </header>

      {!base ? (
        <div className="space-y-4 pt-10 text-center">
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            Envie seu currículo em PDF para começar. A IA vai catalogar seus dados e criar o JSON base.
          </p>
          <div className="flex justify-center">
            <BaseSetupDialog label="Enviar currículo base" description="A IA vai catalogar seus dados e criar o JSON base." />
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <GenerateModal defaultLang={lang} />
            <a
              href="/api/base/pdf"
              target="_blank"
              rel="noopener"
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              <LuPrinter /> Imprimir currículo base
            </a>
          </div>
          <VacancyTable apps={apps} />
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Currículo base</CardTitle>
              <CardDescription>Re-envie o PDF para atualizar os dados (novo idioma ou conteúdo).</CardDescription>
            </CardHeader>
            <CardContent>
              <BaseSetupDialog label="Atualizar base" description="A IA vai recatalogar seus dados a partir do novo PDF." />
            </CardContent>
          </Card>
        </>
      )}
    </main>
  );
}
