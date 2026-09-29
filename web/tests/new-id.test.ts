import { describe, expect, it, vi, afterEach } from "vitest";
import { newId } from "@/lib/tailor-client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("newId (crypto.randomUUID fallback)", () => {
  it("returns uuid-shaped ids when randomUUID exists", () => {
    expect(newId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
  it("falls back to getRandomValues when randomUUID is missing", () => {
    const c = globalThis.crypto;
    vi.stubGlobal("crypto", { getRandomValues: c.getRandomValues.bind(c) } as unknown as Crypto);
    const a = newId();
    const b = newId();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(b).toMatch(/^[0-9a-f-]{36}$/);
    expect(a).not.toBe(b);
  });
  it("falls back to a counter id with no crypto at all", () => {
    vi.stubGlobal("crypto", undefined as unknown as Crypto);
    const a = newId();
    const b = newId();
    expect(a).toMatch(/^pmcv-/);
    expect(a).not.toBe(b);
  });
});
