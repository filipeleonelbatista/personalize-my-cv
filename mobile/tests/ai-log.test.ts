import { describe, expect, it, beforeEach } from "vitest";
import { appendAiLog, clearAiLog, loadAiLog } from "../lib/ai-log";

describe("ai log", () => {
  beforeEach(async () => {
    await clearAiLog();
  });

  it("round-trips entries newest-first", async () => {
    await appendAiLog({ label: "tailor", provider: "gemini:m1", ms: 1200, ok: true });
    await appendAiLog({ label: "base", provider: "gemini:m2", ms: 800, ok: false, error: "boom" });
    const log = await loadAiLog();
    expect(log).toHaveLength(2);
    expect(log[0].label).toBe("base");
    expect(log[1].provider).toBe("gemini:m1");
  });

  it("caps at 100 entries", async () => {
    for (let i = 0; i < 105; i++) {
      await appendAiLog({ label: "tailor", provider: "gemini:m1", ms: 1, ok: true });
    }
    expect((await loadAiLog())).toHaveLength(100);
  });

  it("generateJson logs each attempt", async () => {
    const { generateJson } = await import("../lib/llm/chain");
    const { default: fetchMock } = await import("./__mocks__/fetch-ok");
    const g = globalThis as unknown as { fetch: unknown };
    const prev = g.fetch;
    g.fetch = fetchMock;
    try {
      await generateJson("s", "u", "KEY", undefined, "pt-BR", "tailor");
      const log = await loadAiLog();
      expect(log).toHaveLength(1);
      expect(log[0].label).toBe("tailor");
      expect(log[0].provider).toContain("gemini:");
      expect(log[0].ms).toBeGreaterThanOrEqual(0);
    } finally {
      g.fetch = prev;
    }
  });
});
