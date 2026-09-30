import { describe, expect, it } from "vitest";
import ptBR from "../lib/messages/pt-BR.json";
import enUS from "../lib/messages/en-US.json";
import esES from "../lib/messages/es-ES.json";

function keys(o: unknown, p = ""): string[] {
  if (typeof o !== "object" || o === null) return [p];
  return Object.entries(o as Record<string, unknown>).flatMap(([k, v]) =>
    typeof v === "object" && v !== null ? keys(v, p ? `${p}.${k}` : k) : [p ? `${p}.${k}` : k],
  );
}

describe("mobile i18n", () => {
  it("3 locales share the same keyset", () => {
    expect(keys(enUS).sort()).toEqual(keys(ptBR).sort());
    expect(keys(esES).sort()).toEqual(keys(ptBR).sort());
  });
});
