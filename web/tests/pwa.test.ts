// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";

describe("pwa", () => {
  it("manifest is valid with required icons", () => {
    const m = JSON.parse(readFileSync("public/manifest.webmanifest", "utf8"));
    expect(m.display).toBe("standalone");
    expect(m.start_url).toBe("/");
    const sizes = m.icons.flatMap((i: { sizes: string }) => i.sizes.split(" "));
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
    expect(m.icons.some((i: { purpose?: string }) => i.purpose === "maskable")).toBe(true);
    for (const i of m.icons) expect(existsSync(`public/${i.src.replace(/^\//, "")}`), i.src).toBe(true);
  });
  it("gemini api is never cached", () => {
    const sw = readFileSync("app/sw.ts", "utf8");
    const gIdx = sw.indexOf("generativelanguage.googleapis.com");
    const spreadIdx = sw.indexOf("...defaultCache");
    expect(gIdx).toBeGreaterThanOrEqual(0);
    expect(spreadIdx).toBeGreaterThan(gIdx);
    expect(sw).toContain("NetworkOnly");
  });
  it("offline fallback route exists", () => {
    expect(existsSync("app/offline/page.tsx")).toBe(true);
  });
  it("seo essentials present", () => {
    const layout = readFileSync("app/layout.tsx", "utf8");
    for (const needle of ["openGraph", "twitter", "robots", "manifest", "application/ld+json", "themeColor"]) {
      expect(layout, needle).toContain(needle);
    }
    expect(existsSync("app/sitemap.ts")).toBe(true);
    expect(existsSync("app/robots.ts")).toBe(true);
    expect(existsSync("public/opengraph-image.png")).toBe(true);
  });
});
