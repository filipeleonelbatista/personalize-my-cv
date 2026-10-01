#!/usr/bin/env node
// Auto-bump patch versions based on staged paths.
// Never fails the commit: any error warns to stderr and exits 0.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function bumpPatch(version) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(version).trim());
  if (!m) return null;
  return `${m[1]}.${m[2]}.${Number(m[3]) + 1}`;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
}

try {
  const out = execFileSync("git", ["diff", "--cached", "--name-only"], {
    encoding: "utf8",
  });
  const staged = out
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const touches = (prefix) => staged.some((f) => f === prefix || f.startsWith(prefix + "/"));

  const wantWeb = touches("web");
  const wantMobile = touches("mobile");
  const wantCli = touches("cli");

  if (!wantWeb && !wantMobile && !wantCli) process.exit(0);

  const touched = [];

  if (wantWeb) {
    const p = join("web", "package.json");
    try {
      const pkg = readJson(p);
      const next = bumpPatch(pkg.version);
      if (next) {
        pkg.version = next;
        writeJson(p, pkg);
        touched.push(p);
      }
    } catch (e) {
      console.error(`[bump-versions] web/package.json: ${e?.message ?? e}`);
    }
  }

  if (wantMobile) {
    const p = join("mobile", "package.json");
    try {
      const pkg = readJson(p);
      const next = bumpPatch(pkg.version);
      if (next) {
        pkg.version = next;
        writeJson(p, pkg);
        touched.push(p);
        const appPath = join("mobile", "app.json");
        try {
          const app = readJson(appPath);
          app.expo = app.expo ?? {};
          app.expo.version = next;
          app.expo.android = app.expo.android ?? {};
          const cur = Number(app.expo.android.versionCode);
          app.expo.android.versionCode = Number.isFinite(cur) ? cur + 1 : 1;
          writeJson(appPath, app);
          touched.push(appPath);
        } catch (e) {
          console.error(`[bump-versions] mobile/app.json: ${e?.message ?? e}`);
        }
      }
    } catch (e) {
      console.error(`[bump-versions] mobile/package.json: ${e?.message ?? e}`);
    }
  }

  if (wantCli) {
    const p = join("cli", "package.json");
    try {
      const pkg = readJson(p);
      const next = bumpPatch(pkg.version);
      if (next) {
        pkg.version = next;
        writeJson(p, pkg);
        touched.push(p);
      }
    } catch (e) {
      console.error(`[bump-versions] cli/package.json: ${e?.message ?? e}`);
    }
  }

  if (touched.length > 0) {
    execFileSync("git", ["add", "--", ...touched], { encoding: "utf8" });
  }
  process.exit(0);
} catch (e) {
  console.error(`[bump-versions] warning: ${e?.message ?? e}`);
  process.exit(0);
}
