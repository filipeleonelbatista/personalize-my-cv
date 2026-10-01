import { describe, expect, it, vi } from "vitest";
describe("llm fallback", () => {
  it("maps offline fetch failure to localized offline hint", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    try {
      const { validateGeminiKey, generateJson } = await import("../src/lib/chain.js");
      const v = await validateGeminiKey("some-key", "pt-BR");
      expect(v.ok).toBe(false);
      if (!v.ok) expect(v.error).toContain("Sem conexão");
      await expect(generateJson("sys", "user", "key", ["m1"], "pt-BR")).rejects.toThrow("Sem conexão");
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("tries 3 models in order", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("500"))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ candidates: [{ content: { parts: [{ text: '{"a":1}' }] } }] }),
      });
    vi.stubGlobal("fetch", fetchMock);
    try {
      const { generateJson } = await import("../src/lib/chain.js");
      await generateJson("sys", "user", "key", ["m1", "m2"], "pt-BR");
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
