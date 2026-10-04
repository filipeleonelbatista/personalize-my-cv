import { describe, expect, it, vi, afterEach } from "vitest";
import { generateJson, validateGeminiKey } from "../lib/llm/chain";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("mobile llm chain", () => {
  it("uses the first model when it succeeds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"ok":1}' }] } }] }) })),
    );
    const r = await generateJson("s", "u", "KEY");
    expect(r.provider).toBe("gemini:gemini-3.8-flash");
    expect(r.data).toEqual({ ok: 1 });
  });
  it("falls back across models", async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("m1 down"))
      .mockRejectedValueOnce(new Error("m2 down"))
      .mockRejectedValueOnce(new Error("m3 down"))
      .mockRejectedValueOnce(new Error("m4 down"))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ candidates: [{ content: { parts: [{ text: '{"ok":5}' }] } }] }),
      } as unknown as Response);
    vi.stubGlobal("fetch", fetch);
    const r = await generateJson("s", "u", "KEY");
    expect(r.provider).toBe("gemini:gemini-3.5-flash-lite");
    expect(fetch).toHaveBeenCalledTimes(5);
  });
  it("validate empty key in UI locale", async () => {
    const r = await validateGeminiKey("", "en-US");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Paste a key/);
  });
});
