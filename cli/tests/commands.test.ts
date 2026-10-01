import { describe, expect, it } from "vitest";
describe("commands", () => {
  it("help mentions all commands in 3 locales", async () => {
    const { helpText } = await import("../src/index.js");
    for (const l of ["pt-BR", "en-US", "es-ES"] as const)
      for (const w of ["--list", "--show", "--report", "--help"]) expect(helpText(l)).toContain(w);
  });
  it("report renders ascii bars", async () => {
    process.env.PMCV_HOME = "/tmp/opencode/pmcv-report-home";
    const { mkdirSync, writeFileSync } = await import("node:fs");
    mkdirSync(process.env.PMCV_HOME, { recursive: true });
    const resume = {
      cabecalho: { nome: "Teste", titulo_profissional: "Dev", contatos: [{ tipo: "email", valor: "a@b.c", link: null }] },
      secoes: { resumo: "r", experiencia: [], formacao: [], habilidades: [{ nome: "H", itens: ["x"] }], certificacoes: [], idiomas: [], projetos: [] },
    };
    writeFileSync(
      `${process.env.PMCV_HOME}/apps.json`,
      JSON.stringify([
        {
          resume, cargo: "Dev", empresa: "Acme", matchPercent: 90, strengths: ["s"], weaknesses: ["w"],
          emailBody: "m", chatMessage: "c", id: "r1", jobText: "vaga de dev com requisitos xyz 123", fileName: "a.pdf",
          status: "done", errorLog: "", lang: "pt-BR", createdAt: new Date().toISOString(),
        },
      ]),
    );
    const { renderReport } = await import("../src/commands/report.js");
    expect(renderReport("pt-BR", 0)).toMatch(/Total|Média|Seg/);
  });
  it("CLI_VERSION matches package.json and help mentions --version", async () => {
    const { CLI_VERSION, helpText } = await import("../src/index.js");
    const { readFileSync } = await import("node:fs");
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf-8")) as { version: string };
    expect(CLI_VERSION).toBe(pkg.version);
    expect(helpText("pt-BR")).toContain("--version");
  });
  it("missing pdf path throws localized notFound", async () => {
    process.env.PMCV_HOME = "/tmp/opencode/pmcv-missing-home";
    const { mkdirSync, writeFileSync } = await import("node:fs");
    mkdirSync(process.env.PMCV_HOME, { recursive: true });
    writeFileSync(
      `${process.env.PMCV_HOME}/config.json`,
      JSON.stringify({ geminiKey: "seed-key", models: ["m"], locale: "pt-BR" }),
    );
    const { onboardWithPdf } = await import("../src/commands/onboard.js");
    await expect(onboardWithPdf("/tmp/opencode/does-not-exist.pdf", "pt-BR", "pt-BR")).rejects.toThrow(
      "Registro não encontrado",
    );
  });
});
