import { describe, expect, it, vi, afterEach } from "vitest";
import { generateJson } from "@/lib/llm/chain";
import { chatJsonZen } from "@/lib/llm/zen";
import { chatJsonGemini } from "@/lib/llm/gemini";
import { chatJsonOpenrouter } from "@/lib/llm/openrouter";

afterEach(() => vi.unstubAllGlobals());

describe("generateJson fallback", () => {
  it("uses zen when it succeeds", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ output: [{ type: "message", content: [{ type: "output_text", text: '{"ok":1}' }] }] }) })));
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
  it("labels empty provider payloads instead of TypeError", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ choices: [] }) } as unknown as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ candidates: [] }) } as unknown as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ choices: [{ message: { content: null } }] }) } as unknown as Response);
    vi.stubGlobal("fetch", fetch);
    await expect(generateJson("s", "u")).rejects.toThrow(/zen.*gemini.*openrouter/s);
  });
  it("zen rejects empty output with readable error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ output: [] }) })));
    await expect(chatJsonZen("s", "u")).rejects.toThrow(/resposta vazia/);
  });
  it("gemini rejects empty candidates with readable error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ candidates: [] }) })));
    await expect(chatJsonGemini("s", "u")).rejects.toThrow(/resposta vazia/);
  });
  it("openrouter rejects null content with readable error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: null } }] }) })));
    await expect(chatJsonOpenrouter("s", "u")).rejects.toThrow(/resposta vazia/);
  });
});
