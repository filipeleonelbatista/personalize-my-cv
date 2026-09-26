import { getBase, getBaseLang, listApplications } from "./actions";
import { BaseSetup } from "./components/BaseSetup";
import { VacancyTable } from "./components/VacancyTable";
import { GenerateModal } from "./components/GenerateModal";

export default async function Page() {
  const base = await getBase();
  const rows = base ? await listApplications() : [];
  const lang = base ? await getBaseLang() : "pt-BR";
  const apps = rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));

  if (!base) {
    return (
      <main className="mx-auto max-w-3xl space-y-4 p-6">
        <h1 className="text-2xl font-bold">Personalize My CV</h1>
        <p className="text-sm text-gray-600">Envie seu currículo em PDF para começar. A IA vai catalogar seus dados e criar o JSON base.</p>
        <BaseSetup />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Personalize My CV</h1>
          <p className="text-sm text-gray-600">Base: {base.cabecalho.nome} — {base.cabecalho.titulo_profissional}</p>
        </div>
        <div className="flex gap-2">
          <a href="/api/base/pdf" target="_blank" rel="noopener" className="rounded border px-4 py-2 text-sm">
            Imprimir currículo base
          </a>
          <GenerateModal defaultLang={lang} />
        </div>
      </header>
      <VacancyTable apps={apps} />
      <details>
        <summary className="cursor-pointer text-sm">Re-enviar currículo base</summary>
        <div className="mt-2"><BaseSetup /></div>
      </details>
    </main>
  );
}
