import { describe, expect, it } from "vitest";
import { formatMesAno, formatPeriodo, skillBullets, skillColumns } from "@/lib/pdf/format";

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
  it("localizes to English", () => {
    expect(formatPeriodo({ inicio: "2025-08", fim: null, atual: true }, "en")).toBe("Aug 2025 – Present");
    expect(formatMesAno("2022-09", "en")).toBe("Sep 2022");
  });
  it("localizes to Spanish", () => {
    expect(formatPeriodo({ inicio: "2025-08", fim: null, atual: true }, "es")).toBe("Ago 2025 – actual");
    expect(formatMesAno("2025-01", "es")).toBe("Ene 2025");
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

describe("skillColumns", () => {
  it("splits 6 bullets into 2 columns of 3", () => {
    const skills = Array.from({ length: 19 }, (_, i) => `K${i + 1}`);
    const [c1, c2] = skillColumns(skills);
    expect(c1).toEqual(["K1, K2, K3", "K4, K5, K6", "K7, K8, K9"]);
    expect(c2).toEqual(["K10, K11, K12", "K13, K14, K15", "K16, K17, K18"]);
  });
  it("returns empty second column when few skills", () => {
    expect(skillColumns(["A"])).toEqual([["A"], []]);
  });
});
