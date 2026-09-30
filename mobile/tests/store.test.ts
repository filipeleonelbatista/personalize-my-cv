// mobile/tests/store.test.ts
import { describe, expect, it, beforeEach, vi } from "vitest";

vi.mock("@react-native-async-storage/async-storage", () => {
  const mem = new Map<string, string>();
  return {
    default: {
      getItem: async (k: string) => mem.get(k) ?? null,
      setItem: async (k: string, v: string) => {
        mem.set(k, v);
      },
      removeItem: async (k: string) => {
        mem.delete(k);
      },
    },
  };
});

vi.mock("expo-secure-store", () => {
  const mem = new Map<string, string>();
  return {
    getItemAsync: async (k: string) => mem.get(k) ?? null,
    setItemAsync: async (k: string, v: string) => {
      mem.set(k, v);
    },
    deleteItemAsync: async (k: string) => {
      mem.delete(k);
    },
  };
});

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
          contatos: [{ tipo: "email", valor: "a@a.com", link: null }],
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

  it("api key lives in SecureStore", async () => {
    expect(await getApiKey()).toBeNull();
    await setApiKey("K");
    expect(await getApiKey()).toBe("K");
  });
});
