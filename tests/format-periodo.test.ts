import { describe, expect, it } from "vitest";
import { formatMesAno, formatPeriodo, skillBullets } from "@/lib/pdf/format";

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

describe("skillBullets", () => {
  it("groups up to 3 skills per bullet, max 6 bullets", () => {
    expect(skillBullets(["React", "Next.js", "TypeScript", "Node", "Express", "Jest", "Docker"])).toEqual([
      "React, Next.js, TypeScript",
      "Node, Express, Jest",
      "Docker",
    ]);
  });
  it("splits comma strings into individual skills first", () => {
    expect(skillBullets(["React, Next.js, TypeScript, Node"])).toEqual(["React, Next.js, TypeScript", "Node"]);
  });
  it("caps at 6 bullets", () => {
    const many = Array.from({ length: 20 }, (_, i) => `S${i + 1}`);
    expect(skillBullets(many)).toHaveLength(6);
  });
});
