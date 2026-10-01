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
  it("same keyset in 3 locales", () => {
    expect(keys(en).sort()).toEqual(keys(pt).sort());
    expect(keys(es).sort()).toEqual(keys(pt).sort());
  });
  it("falls back to pt-BR without crashing", () => {
    expect(t("pt-BR", "Cli.onlyInPt")).toContain("somente");
    expect(t("en-US" as never, "Cli.__missing_key__" as never)).toBe("Cli.__missing_key__");
  });
});
