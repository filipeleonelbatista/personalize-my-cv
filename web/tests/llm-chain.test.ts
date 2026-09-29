import { describe, expect, it, vi, afterEach } from "vitest";
import { generateJson } from "@/lib/llm/chain";
import { validateGeminiKey } from "@/lib/llm/chain";
import { chatJsonGemini, geminiModels } from "@/lib/llm/gemini";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("geminiModels", () => {
  it("defaults to the 3 free-tier models in quality order", () => {
    expect(geminiModels()).toEqual(["gemini-3-flash-preview", "gemini-2.5-flash", "gemini-2.5-flash-lite"]);
  });
  it("trims and filters a caller-provided list", () => {
    expect(geminiModels([" gemini-2.5-flash ", "", " gemini-2.5-flash-lite "])).toEqual(["gemini-2.5-flash", "gemini-2.5-flash-lite"]);
  });
});

describe("generateJson fallback", () => {
  it("uses the first model when it succeeds", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"ok":1}' }] } }] }) })));
    const r = await generateJson("s", "u", "K");
    expect(r.provider).toBe("gemini:gemini-3-flash-preview");
    expect(r.data).toEqual({ ok: 1 });
  });
  it("falls back across the 3 models", async () => {
    const fetch = vi.fn()
      .mockRejectedValueOnce(new Error("m1 down"))
      .mockResolvedValueOnce({ ok: false, status: 429, text: async () => "quota" } as unknown as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"ok":3}' }] } }] }) } as unknown as Response);
    vi.stubGlobal("fetch", fetch);
    const r = await generateJson("s", "u", "K");
    expect(r.provider).toBe("gemini:gemini-2.5-flash-lite");
    expect(fetch).toHaveBeenCalledTimes(3);
  });
  it("throws with all three model errors", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("down"); }));
    await expect(generateJson("s", "u", "K")).rejects.toThrow(/gemini-3-flash-preview.*gemini-2\.5-flash.*gemini-2\.5-flash-lite/s);
  });
  it("gemini rejects empty candidates with readable error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ candidates: [] }) })));
    await expect(chatJsonGemini("s", "u", "K", "gemini-2.5-flash")).rejects.toThrow(/resposta vazia/);
  });
});

describe("byok", () => {
  it("passes key in query string", async () => {
    const fetch = vi.fn(async (..._a: unknown[]) => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"ok":1}' }] } }] }) }));
    vi.stubGlobal("fetch", fetch);
    await generateJson("s", "u", "KEY123");
    expect(String(fetch.mock.calls[0][0])).toContain("key=KEY123");
    vi.unstubAllGlobals();
  });
  it("validateKey reports 401 as invalid", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 401, text: async () => "bad key" })));
    const r = await validateGeminiKey("BAD");
    expect(r.ok).toBe(false);
    vi.unstubAllGlobals();
  });
});
