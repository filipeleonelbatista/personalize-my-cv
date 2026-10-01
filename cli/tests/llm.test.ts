import { describe, expect, it, vi } from "vitest";
describe("llm fallback", () => {
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
