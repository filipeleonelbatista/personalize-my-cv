// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from "vitest";
import ptBR from "@/messages/pt-BR.json";
import enUS from "@/messages/en-US.json";
import esES from "@/messages/es-ES.json";
import { DEFAULT_LOCALE, LOCALES } from "@/lib/i18n/config";
import { getLocale, tErr } from "@/lib/i18n/locale";
import { loadLocale, saveLocale } from "@/lib/store";

function keys(o: unknown, prefix = ""): string[] {
  if (typeof o !== "object" || o === null) return [prefix];
  return Object.entries(o as Record<string, unknown>).flatMap(([k, v]) =>
    typeof v === "object" && v !== null ? keys(v, prefix ? `${prefix}.${k}` : k) : [prefix ? `${prefix}.${k}` : k],
  );
}
beforeEach(() => localStorage.clear());

describe("i18n", () => {
  it("supports exactly the 3 locales with pt-BR default", () => {
    expect([...LOCALES].sort()).toEqual(["en-US", "es-ES", "pt-BR"]);
    expect(DEFAULT_LOCALE).toBe("pt-BR");
  });
  it("all locales share the same keyset", () => {
    expect(keys(enUS).sort()).toEqual(keys(ptBR).sort());
    expect(keys(esES).sort()).toEqual(keys(ptBR).sort());
  });
  it("loads pt-BR on garbage locale", () => {
    localStorage.setItem("pmcv:locale", "xx");
    expect(loadLocale()).toBe("pt-BR");
    expect(getLocale()).toBe("pt-BR");
  });
  it("round-trips locale", () => {
    saveLocale("es-ES");
    expect(loadLocale()).toBe("es-ES");
  });
  it("lib errors translate per locale with pt-BR fallback", () => {
    expect(tErr("en-US", "noKey")).toMatch(/Gemini key/i);
    expect(tErr("es-ES", "noKey")).toMatch(/clave/i);
    expect(tErr("pt-BR", "noKey")).toMatch(/chave/i);
    expect(tErr("en-US", "missing.key" as never)).toBe(tErr("pt-BR", "missing.key" as never));
  });
});
