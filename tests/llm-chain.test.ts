import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { generateJson } from "@/lib/llm/chain";
import { chatJsonGemini, geminiModels } from "@/lib/llm/gemini";

const OLD_ENV = process.env.GEMINI_MODELS;

beforeEach(() => {
  delete process.env.GEMINI_MODELS;
});
afterEach(() => {
  vi.unstubAllGlobals();
  if (OLD_ENV === undefined) delete process.env.GEMINI_MODELS;
  else process.env.GEMINI_MODELS = OLD_ENV;
});

describe("geminiModels", () => {
  it("defaults to the 3 free-tier models in quality order", () => {
    expect(geminiModels()).toEqual(["gemini-3-flash-preview", "gemini-2.5-flash", "gemini-2.5-flash-lite"]);
  });
  it("parses GEMINI_MODELS env list", () => {
    process.env.GEMINI_MODELS = " gemini-2.5-flash ,, gemini-2.5-flash-lite ";
    expect(geminiModels()).toEqual(["gemini-2.5-flash", "gemini-2.5-flash-lite"]);
  });
});

describe("generateJson fallback", () => {
  it("uses the first model when it succeeds", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"ok":1}' }] } }] }) })));
    const r = await generateJson("s", "u");
    expect(r.provider).toBe("gemini:gemini-3-flash-preview");
    expect(r.data).toEqual({ ok: 1 });
  });
  it("falls back across the 3 models", async () => {
    const fetch = vi.fn()
      .mockRejectedValueOnce(new Error("m1 down"))
      .mockResolvedValueOnce({ ok: false, status: 429, text: async () => "quota" } as unknown as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"ok":3}' }] } }] }) } as unknown as Response);
    vi.stubGlobal("fetch", fetch);
    const r = await generateJson("s", "u");
    expect(r.provider).toBe("gemini:gemini-2.5-flash-lite");
    expect(fetch).toHaveBeenCalledTimes(3);
  });
  it("throws with all three model errors", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("down"); }));
    await expect(generateJson("s", "u")).rejects.toThrow(/gemini-3-flash-preview.*gemini-2\.5-flash.*gemini-2\.5-flash-lite/s);
  });
  it("gemini rejects empty candidates with readable error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ candidates: [] }) })));
    await expect(chatJsonGemini("s", "u", "gemini-2.5-flash")).rejects.toThrow(/resposta vazia/);
  });
});
