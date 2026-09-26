import { describe, expect, it } from "vitest";
import { extractJson } from "@/lib/json-text";

describe("extractJson", () => {
  it("unwraps ```json fences", () => {
    expect(JSON.parse(extractJson('```json\n{"a":1}\n```'))).toEqual({ a: 1 });
  });
  it("passes plain json through", () => {
    expect(JSON.parse(extractJson('{"a":2}'))).toEqual({ a: 2 });
  });
});
