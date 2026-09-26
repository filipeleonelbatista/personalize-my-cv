import { describe, expect, it, vi, afterEach } from "vitest";
import { generateJson } from "@/lib/llm/chain";

afterEach(() => vi.unstubAllGlobals());

describe("generateJson fallback", () => {
  it("uses zen when it succeeds", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: '{"ok":1}' } }] }) })));
    const r = await generateJson("s", "u");
    expect(r.provider).toBe("zen");
    expect(r.data).toEqual({ ok: 1 });
  });
  it("falls back zen→gemini→openrouter", async () => {
    const fetch = vi.fn()
      .mockRejectedValueOnce(new Error("zen down"))
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => "gemini err" } as unknown as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ choices: [{ message: { content: '{"ok":3}' } }] }) } as unknown as Response);
    vi.stubGlobal("fetch", fetch);
    const r = await generateJson("s", "u");
    expect(r.provider).toBe("openrouter");
  });
  it("throws with all three errors", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("down"); }));
    await expect(generateJson("s", "u")).rejects.toThrow(/zen.*gemini.*openrouter/s);
  });
});
