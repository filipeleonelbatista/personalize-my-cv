import { describe, expect, it } from "vitest";
import { formatMesAno, formatPeriodo } from "@/lib/pdf/format";

describe("formatMesAno", () => {
  it("formats YYYY-MM to 3-letter pt-BR month", () => {
    expect(formatMesAno("2025-08")).toBe("Ago 2025");
    expect(formatMesAno("2022-09")).toBe("Set 2022");
    expect(formatMesAno("2024-01")).toBe("Jan 2024");
  });
  it("passes through invalid input", () => {
    expect(formatMesAno("atual")).toBe("atual");
  });
});

describe("formatPeriodo", () => {
  it("shows atual for current roles", () => {
    expect(formatPeriodo({ inicio: "2025-08", fim: null, atual: true })).toBe("Ago 2025 – atual");
  });
  it("shows inicio and fim", () => {
    expect(formatPeriodo({ inicio: "2021-07", fim: "2022-09", atual: false })).toBe("Jul 2021 – Set 2022");
  });
});
