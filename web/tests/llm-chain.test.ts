import { describe, expect, it, vi, afterEach } from "vitest";
import { generateJson } from "@/lib/llm/chain";
import { generateText } from "@/lib/llm/chain";
import { validateGeminiKey } from "@/lib/llm/chain";
import { chatJsonGemini, chatTextGemini, geminiModels } from "@/lib/llm/gemini";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("geminiModels", () => {
  it("defaults to the 5 free-tier models in quality order", () => {
    expect(geminiModels()).toEqual(["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite"]);
  });
  it("trims and filters a caller-provided list", () => {
    expect(geminiModels([" gemini-3.8-flash ", "", " gemini-3.5-flash-lite "])).toEqual(["gemini-3.8-flash", "gemini-3.5-flash-lite"]);
  });
  it("falls back to defaults when the list is empty after filtering", () => {
    expect(geminiModels(["", "   ", ""])).toEqual(["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite"]);
  });
  it("migrates deprecated models to defaults", () => {
    expect(geminiModels(["gemini-3-flash-preview", "gemini-2.5-flash", "gemini-2.5-flash-lite"])).toEqual(["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite"]);
    expect(geminiModels(["gemini-2.5-flash", " gemini-3.6-flash "])).toEqual(["gemini-3.6-flash"]);
  });
});

describe("generateJson fallback", () => {
  it("uses the first model when it succeeds", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"ok":1}' }] } }] }) })));
    const r = await generateJson("s", "u", "K");
    expect(r.provider).toBe("gemini:gemini-3.8-flash");
    expect(r.data).toEqual({ ok: 1 });
  });
  it("falls back across the 5 models", async () => {
    const fetch = vi.fn()
      .mockRejectedValueOnce(new Error("m1 down"))
      .mockRejectedValueOnce(new Error("m2 down"))
      .mockRejectedValueOnce(new Error("m3 down"))
      .mockRejectedValueOnce(new Error("m4 down"))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"ok":5}' }] } }] }) } as unknown as Response);
    vi.stubGlobal("fetch", fetch);
    const r = await generateJson("s", "u", "K");
    expect(r.provider).toBe("gemini:gemini-3.5-flash-lite");
    expect(fetch).toHaveBeenCalledTimes(5);
  });
  it("throws with all five model errors", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("down"); }));
    await expect(generateJson("s", "u", "K")).rejects.toThrow(/gemini-3\.8-flash.*gemini-3\.7-flash.*gemini-3\.6-flash.*gemini-3\.5-flash.*gemini-3\.5-flash-lite/s);
  });
  it("gemini rejects empty candidates with readable error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ candidates: [] }) })));
    await expect(chatJsonGemini("s", "u", "K", "gemini-3.8-flash")).rejects.toThrow(/resposta vazia/);
  });
});

describe("generateText fallback", () => {
  it("returns the plain text answer", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: "olá, tudo certo" }] } }] }) })));
    const r = await generateText("s", "u", "K");
    expect(r.text).toBe("olá, tudo certo");
    expect(r.provider).toBe("gemini:gemini-3.8-flash");
  });
  it("does not ask the API for a JSON answer", async () => {
    const fetch = vi.fn(async (..._a: unknown[]) => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: "texto" }] } }] }) }));
    vi.stubGlobal("fetch", fetch);
    await generateText("s", "u", "K");
    const init = fetch.mock.calls[0][1] as RequestInit | undefined;
    const body = JSON.parse(String(init?.body));
    expect(body.generationConfig?.responseMimeType).toBeUndefined();
  });
  it("falls back across the models", async () => {
    const fetch = vi.fn()
      .mockRejectedValueOnce(new Error("m1 down"))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: "segunda" }] } }] }) } as unknown as Response);
    vi.stubGlobal("fetch", fetch);
    const r = await generateText("s", "u", "K");
    expect(r.provider).toBe("gemini:gemini-3.7-flash");
    expect(r.text).toBe("segunda");
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("rejects an empty answer with a readable error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ candidates: [] }) })));
    await expect(chatTextGemini("s", "u", "K", "gemini-3.8-flash")).rejects.toThrow(/resposta vazia/);
  });
});

describe("byok", () => {  it("passes key in query string", async () => {
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
