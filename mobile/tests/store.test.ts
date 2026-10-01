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

  it("api key lives in SecureStore with example key containing special chars", async () => {
    const { __clear } = await import("./__mocks__/secure-store");
    __clear();
    // Synthetic value covering SecureStore-sensitive chars (".", "_", "-").
    const example = "TEST-KEY_123.ABC-def_GHI.789-test-only";
    expect(await getApiKey()).toBeNull();
    await setApiKey(example);
    expect(await getApiKey()).toBe(example);
    // Storage key must respect SecureStore charset (alnum + . - _), no ":".
    const src = readFileSync("lib/secure-key.ts", "utf8");
    expect(src).toContain("expo-secure-store");
    const keyMatch = src.match(/const\s+KEY\s*=\s*["']([^"']+)["']/);
    expect(keyMatch, "KEY constant").not.toBeNull();
    expect(keyMatch![1]).toMatch(/^[A-Za-z0-9.\-_]+$/);
  });

  it("migrates legacy AsyncStorage key once", async () => {
    const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
    const { __clear } = await import("./__mocks__/secure-store");
    __clear();
    await AsyncStorage.setItem("pmcv:gemini-key", "LEGACY-KEY_123.ABC");
    expect(await getApiKey()).toBe("LEGACY-KEY_123.ABC");
    // After migration the legacy slot is cleared.
    expect(await AsyncStorage.getItem("pmcv:gemini-key")).toBeNull();
  });
});
