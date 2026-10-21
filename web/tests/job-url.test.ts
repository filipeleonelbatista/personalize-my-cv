// @vitest-environment jsdom
// web/tests/job-url.test.ts
import { describe, expect, it } from "vitest";
import { isValidJobUrl, normalizeJobUrl } from "@/lib/job-url";

describe("normalizeJobUrl", () => {
  it("returns empty string for blank input", () => {
    expect(normalizeJobUrl("")).toBe("");
    expect(normalizeJobUrl("   ")).toBe("");
  });
  it("adds https:// when the scheme is missing", () => {
    expect(normalizeJobUrl("example.com/job")).toBe("https://example.com/job");
  });
  it("keeps an explicit https:// or http:// url", () => {
    expect(normalizeJobUrl("https://example.com/job")).toBe("https://example.com/job");
    expect(normalizeJobUrl("http://example.com/job")).toBe("http://example.com/job");
  });
  it("trims surrounding whitespace", () => {
    expect(normalizeJobUrl("  https://example.com/job  ")).toBe("https://example.com/job");
  });
  it("rejects non http(s) schemes", () => {
    expect(normalizeJobUrl("javascript:alert(1)")).toBe("");
    expect(normalizeJobUrl("ftp://example.com/file")).toBe("");
    expect(normalizeJobUrl("data:text/html,<h1>x</h1>")).toBe("");
  });
  it("rejects malformed urls", () => {
    expect(normalizeJobUrl("http://")).toBe("");
    expect(normalizeJobUrl("https://")).toBe("");
  });
});

describe("isValidJobUrl", () => {
  it("accepts http(s) urls and rejects anything else", () => {
    expect(isValidJobUrl("https://example.com")).toBe(true);
    expect(isValidJobUrl("example.com")).toBe(true);
    expect(isValidJobUrl("javascript:alert(1)")).toBe(false);
    expect(isValidJobUrl("")).toBe(false);
  });
});
