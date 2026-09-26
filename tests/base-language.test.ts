import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildBaseExtractSystem, parseBaseLang } from "@/lib/llm/prompts";

describe("parseBaseLang", () => {
  it("accepts pt-BR, en and es", () => {
    expect(parseBaseLang("en")).toBe("en");
    expect(parseBaseLang("es")).toBe("es");
    expect(parseBaseLang("pt-BR")).toBe("pt-BR");
  });
  it("defaults unknown to pt-BR", () => {
    expect(parseBaseLang("fr")).toBe("pt-BR");
    expect(parseBaseLang(null)).toBe("pt-BR");
  });
});

describe("buildBaseExtractSystem", () => {
  it("instructs English output for en", () => {
    const s = buildBaseExtractSystem("en");
    expect(s).toContain("English");
    expect(s).toContain("ResumeSchema");
  });
  it("instructs Spanish output for es", () => {
    expect(buildBaseExtractSystem("es")).toContain("Español");
  });
  it("instructs Brazilian Portuguese by default", () => {
    expect(buildBaseExtractSystem("pt-BR")).toContain("Português do Brasil");
  });
});

describe("base setup language select", () => {
  it("offers pt-BR, en and es", () => {
    const src = readFileSync("app/components/BaseSetup.tsx", "utf8");
    expect(src).toContain('name="lang"');
    expect(src).toContain('value="en"');
    expect(src).toContain('value="es"');
  });
});
