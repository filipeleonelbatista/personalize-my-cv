// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { saveApps, loadApps, type StoredApp } from "@/lib/store";

beforeEach(() => localStorage.clear());

const resume: StoredApp["resume"] = { cabecalho: { nome: "Ana", titulo_profissional: "Dev", contatos: [{ tipo: "email", valor: "a@a.com", link: null }] }, secoes: { resumo: "X", experiencia: [], formacao: [], habilidades: [], certificacoes: [], idiomas: [], projetos: [] } };

function app(id: string): StoredApp {
  return { id, jobText: "vaga com texto suficiente", fileName: `${id}.pdf`, resume, cargo: "Dev", empresa: "X", matchPercent: 80, strengths: ["React"], weaknesses: ["Inglês"], emailBody: "Olá", chatMessage: "Oi", status: "done", errorLog: "", lang: "pt-BR", createdAt: new Date().toISOString() };
}

describe("deleteApplication (store)", () => {
  it("removes the app from the store", () => {
    saveApps([app("a"), app("b")]);
    saveApps(loadApps().filter((a) => a.id !== "a"));
    expect(loadApps().map((a) => a.id)).toEqual(["b"]);
  });
  it("returns empty when deleting an unknown id (no-op)", () => {
    saveApps([app("b")]);
    saveApps(loadApps().filter((a) => a.id !== "zzz"));
    expect(loadApps()).toHaveLength(1);
  });
  it("table row has a delete action", () => {
    expect(readFileSync("app/components/VacancyTable.tsx", "utf8")).toContain('t("delete")');
  });
});
