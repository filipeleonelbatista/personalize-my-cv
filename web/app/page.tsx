import { getBase, getBaseLang, listApplications } from "./actions";
import { BaseSetupDialog } from "./components/BaseSetupDialog";
import { DashboardTabs } from "./components/DashboardTabs";
import { ThemeToggle } from "./components/theme-toggle";

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
        <DashboardTabs apps={apps} lang={lang} />
      )}
    </main>
  );
}
