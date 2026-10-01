#!/usr/bin/env node
import { Command } from "commander";
import { confirm, editor, input, password, select } from "@inquirer/prompts";
import { copyFileSync } from "node:fs";
import { loadApps, loadBase, loadConfig, saveApps, saveConfig, isQuotaError } from "./lib/store.js";
import { createRequire } from "node:module";
import { parseLocale, t, type UiLocale } from "./lib/i18n.js";
import { parseBaseLang } from "./lib/prompts.js";
import { retryStoredApp } from "./lib/tailor.js";
import { renderPdf } from "./lib/pdf.js";
import { ensureApiKey, onboardWithPdf } from "./commands/onboard.js";
import { generateForJob } from "./commands/generate.js";
import { formatTable } from "./commands/list.js";
import { formatAnalysis } from "./commands/show.js";
import { renderReport } from "./commands/report.js";

const _require = createRequire(import.meta.url);
function loadPkgVersion(): string {
  for (const p of ["../package.json", "../../package.json"]) {
    try {
      return (_require(p) as { version: string }).version;
    } catch {
      continue;
    }
  }
  throw new Error("Cannot find cli/package.json");
}

export const CLI_VERSION: string = loadPkgVersion();

export function helpText(locale: UiLocale): string {
  const L = [
    "personalize-cv",
    t(locale, "Help.desc"),
    "",
    `  personalize-cv                       — ${t(locale, "Generate.title")}`,
    `  personalize-cv --list                — ${t(locale, "Dashboard.resumes")}`,
    `  personalize-cv --show <id>           — ${t(locale, "Vacancy.view")}`,
    `  personalize-cv --report [--week -1]  — ${t(locale, "Dashboard.reports")}`,
    `  personalize-cv --help                — ${t(locale, "Help.title")}`,
    `  personalize-cv --version              — ${CLI_VERSION}`,
    "",
    `  --locale pt-BR|en-US|es-ES   (${t(locale, "Locale.label")})`,
    `  --cv-lang pt-BR|en|es        (${t(locale, "Onboarding.cvLang")})`,
    `  --out <path>                 (${t(locale, "Vacancy.download")})`,
  ];
  return L.join("\n");
}

function resolveLocale(flag: unknown): UiLocale {
  const cfg = loadConfig();
  if (typeof flag === "string" && flag) return parseLocale(flag);
  return parseLocale(cfg.locale ?? undefined);
}

async function interactive(locale: UiLocale, cvLangFlag: unknown, outDir: string): Promise<void> {
  const key = await ensureApiKey(locale, () => password({ message: t(locale, "Cli.enterKey") }));
  void key;
  if (!loadBase()) {
    const pdfPath = await input({ message: t(locale, "Cli.enterPdf") });
    const cvLang = parseBaseLang(
      typeof cvLangFlag === "string" && cvLangFlag ? cvLangFlag : await select({ message: t(locale, "Onboarding.cvLang"), choices: [{ value: "pt-BR" }, { value: "en" }, { value: "es" }] }),
    );
    await onboardWithPdf(pdfPath.trim(), locale, cvLang);
    console.log(t(locale, "Onboarding.baseCreated"));
  }
  const jobText = await editor({ message: t(locale, "Cli.enterJob") });
  const base = loadBase()!;
  const cvLang = parseBaseLang(typeof cvLangFlag === "string" && cvLangFlag ? cvLangFlag : base.lang);
  const { result, analysis, pdfPath } = await generateForJob(jobText, locale, cvLang, outDir);
  console.log(`\n=== ${t(locale, "Cli.analysis")} ===\n${analysis}`);
  if (result.ok) {
    console.log(t(locale, "Cli.savedPdf", { file: pdfPath }));
  } else {
    console.error(result.error);
    process.exitCode = 1;
  }
}

async function listFlow(locale: UiLocale, out: string | undefined): Promise<void> {
  const apps = loadApps();
  console.log(formatTable(apps, locale));
  if (!apps.length) return;
  const idx = await select({
    message: `# (1-${apps.length})`,
    choices: [...apps.map((a, i) => ({ name: `${i + 1}. ${a.cargo} — ${a.empresa}`, value: i })), { name: "q", value: -1 }],
  });
  if (idx === -1) return;
  const app = apps[idx];
  const action = await select({
    message: app.fileName,
    choices: [
      { name: t(locale, "Vacancy.view"), value: "view" },
      { name: t(locale, "Vacancy.download"), value: "dl" },
      { name: t(locale, "Vacancy.retry"), value: "retry" },
      { name: t(locale, "Vacancy.delete"), value: "del" },
    ],
  });
  if (action === "view") {
    console.log(formatAnalysis(app, locale));
  } else if (action === "dl") {
    const dest = out ?? `${process.cwd()}/${app.fileName}`;
    await renderPdf(app.resume, app.lang, dest);
    console.log(t(locale, "Cli.savedPdf", { file: dest }));
  } else if (action === "retry") {
    const r = await retryStoredApp(app.id, locale);
    console.log(r.ok ? t(locale, "Vacancy.regenerated") : r.error);
  } else if (action === "del") {
    if (await confirm({ message: t(locale, "Vacancy.confirmDelete") })) {
      saveApps(loadApps().filter((a) => a.id !== app.id));
      console.log(t(locale, "Vacancy.deleted"));
    }
  }
}

const program = new Command();
program
  .name("personalize-cv")
  .version(CLI_VERSION)
  .allowUnknownOption(false)
  .option("--locale <l>")
  .option("--cv-lang <l>")
  .option("--out <path>")
  .option("--list")
  .option("--show <id>")
  .option("--report")
  .option("--week <n>", "0")
  .option("--json");

async function main(): Promise<void> {
  program.parse(process.argv);
  const o = program.opts();
  const locale = resolveLocale(o.locale);
  if (o.locale) saveConfig({ ...loadConfig(), locale });
  if (o.list) {
    if (o.json) console.log(JSON.stringify(loadApps(), null, 2));
    else await listFlow(locale, o.out);
    return;
  }
  if (o.show) {
    const app = loadApps().find((a) => a.id === o.show || a.id.startsWith(o.show));
    if (!app) {
      console.error(t(locale, "Errors.notFound"));
      process.exitCode = 2;
      return;
    }
    if (o.json) console.log(JSON.stringify(app, null, 2));
    else console.log(formatAnalysis(app, locale));
    if (o.out) {
      await renderPdf(app.resume, app.lang, o.out);
      console.log(t(locale, "Cli.savedPdf", { file: o.out }));
    }
    return;
  }
  if (o.report) {
    const week = Number.parseInt(o.week ?? "0", 10) || 0;
    if (o.json) {
      console.log(JSON.stringify({ week, report: renderReport(locale, week) }));
    } else {
      console.log(renderReport(locale, week));
    }
    return;
  }
  await interactive(locale, o.cvLang, o.out ? String(o.out) : process.cwd());
}

if (process.env.PMCV_NO_RUN !== "1") {
  program.configureHelp({ formatHelp: () => helpText(parseLocale(process.env.PMCV_LOCALE)) });
  main().catch((e) => {
    const locale = parseLocale(process.env.PMCV_LOCALE ?? loadConfig().locale);
    console.error(isQuotaError(e) ? t(locale, "Errors.quota") : e instanceof Error ? e.message : String(e));
    process.exitCode = 1;
  });
}
