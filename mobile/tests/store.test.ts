// mobile/tests/store.test.ts
// Native modules (@react-native-async-storage/async-storage) are aliased
// to in-memory mocks in vitest.config.ts.
import { describe, expect, it, beforeEach } from "vitest";
import { readFileSync } from "node:fs";

import { saveBase, loadBase } from "../lib/store";
import { setApiKey, getApiKey } from "../lib/secure-key";

describe("mobile store", () => {
  beforeEach(async () => {
    const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
    await AsyncStorage.removeItem("pmcv:base");
    await AsyncStorage.removeItem("pmcv:apps");
  });

  it("round-trips base", async () => {
    const base = {
      resume: {
        cabecalho: {
          nome: "Ana",
          titulo_profissional: "Dev",
          contatos: [{ tipo: "email" as const, valor: "a@a.com", link: null }],
        },
        secoes: {
          resumo: "X",
          experiencia: [],
          formacao: [],
          habilidades: [],
          certificacoes: [],
          idiomas: [],
          projetos: [],
        },
      },
      lang: "pt-BR" as const,
      updatedAt: new Date().toISOString(),
    };
    await saveBase(base);
    const loaded = (await loadBase())?.resume as typeof base.resume;
    expect(loaded?.cabecalho.nome).toBe("Ana");
  });

  it("api key lives in AsyncStorage (no secure-store)", async () => {
    expect(await getApiKey()).toBeNull();
    await setApiKey("K");
    expect(await getApiKey()).toBe("K");
    const src = readFileSync("lib/secure-key.ts", "utf8");
    expect(src).not.toContain("expo-secure-store");
    expect(readFileSync("lib/store.ts", "utf8")).not.toContain("expo-secure-store");
  });
});
