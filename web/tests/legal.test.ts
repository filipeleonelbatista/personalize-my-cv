// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import ptBR from "@/messages/pt-BR.json";
import enUS from "@/messages/en-US.json";
import esES from "@/messages/es-ES.json";
import pkg from "../package.json";

const LOCALES = { "pt-BR": ptBR, "en-US": enUS, "es-ES": esES } as const;

describe("legal (LGPD)", () => {
  it("privacy and terms routes exist as static pages", () => {
    for (const f of ["app/privacidade/page.tsx", "app/termos/page.tsx"]) {
      expect(existsSync(f), f).toBe(true);
      const src = readFileSync(f, "utf8");
      expect(src).toContain('"use client"');
      expect(src).toContain('useTranslations("');
    }
    expect(readFileSync("app/privacidade/page.tsx", "utf8")).toContain('useTranslations("Privacy")');
    expect(readFileSync("app/termos/page.tsx", "utf8")).toContain('useTranslations("Terms")');
  });
  it("privacy/terms sections share the same keyset in the 3 locales", () => {
    for (const sec of ["Privacy", "Terms"] as const) {
      const pt = Object.keys(ptBR[sec]).sort();
      expect(Object.keys(enUS[sec]).sort()).toEqual(pt);
      expect(Object.keys(esES[sec]).sort()).toEqual(pt);
      expect(pt).toContain("title");
      expect(pt).toContain("s1h");
      expect(pt).toContain("s6b");
    }
  });
  it("cookie banner declares no first-party cookies and links the policy", () => {
    const src = readFileSync("app/components/CookieBanner.tsx", "utf8");
    expect(src).toContain("react-cookie-consent");
    expect(src).toContain("pmcv-consent");
    expect(src).toContain("/privacidade");
    expect(src).toContain("pmcv:consent");
    for (const [loc, m] of Object.entries(LOCALES)) {
      expect(m.Cookie.message, loc).toMatch(/cookie/i);
      expect(m.Cookie.accept, loc).toBeTruthy();
      expect(m.Cookie.decline, loc).toBeTruthy();
    }
  });
  it("footer shows the app version with legal links", () => {
    const src = readFileSync("app/components/Footer.tsx", "utf8");
    expect(src).toContain("linkedin.com/in/filipeleonelbatista");
    expect(src).toContain("/privacidade");
    expect(src).toContain("/termos");
    expect(src).toContain("appVersion");
    expect(readFileSync("app/layout.tsx", "utf8")).toContain("pkg.version");
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+$/);
  });
  it("sitemap lists the legal pages", () => {
    const src = readFileSync("app/sitemap.ts", "utf8");
    expect(src).toContain("/privacidade");
    expect(src).toContain("/termos");
  });
});
