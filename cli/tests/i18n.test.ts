import { describe, expect, it } from "vitest";
import pt from "../messages/pt-BR.json" with { type: "json" };
import en from "../messages/en-US.json" with { type: "json" };
import es from "../messages/es-ES.json" with { type: "json" };
import { t } from "../src/lib/i18n.js";
function keys(o: unknown, p = ""): string[] {
  if (typeof o === "string") return [p];
  return Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => keys(v, p ? `${p}.${k}` : k));
}
describe("i18n parity", () => {
  it("same keyset in 3 locales (except pt-only fallback probe)", () => {
    const without = (ks: string[]) => ks.filter((k) => k !== "Cli.onlyInPt").sort();
    expect(without(keys(en))).toEqual(without(keys(pt)));
    expect(without(keys(es))).toEqual(without(keys(pt)));
  });
  it("falls back to pt-BR text when key missing in locale", () => {
    expect(t("en-US", "Cli.onlyInPt")).toContain("somente");
    expect(t("es-ES", "Cli.onlyInPt")).toContain("somente");
  });
});
