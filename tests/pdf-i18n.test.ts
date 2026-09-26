import { describe, expect, it } from "vitest";
import { pdfLabels } from "@/lib/pdf/i18n";

describe("pdfLabels", () => {
  it("keeps pt-BR labels", () => {
    const l = pdfLabels("pt-BR");
    expect(l.experience).toBe("Experiências");
    expect(l.activities).toBe("Principais atividades");
    expect(l.current).toBe("atual");
  });
  it("translates labels to English", () => {
    const l = pdfLabels("en");
    expect(l.experience).toBe("Experience");
    expect(l.skills).toBe("Skills");
    expect(l.activities).toBe("Key activities");
    expect(l.current).toBe("Present");
  });
  it("translates labels to Spanish", () => {
    const l = pdfLabels("es");
    expect(l.experience).toBe("Experiencia");
    expect(l.education).toBe("Educación");
    expect(l.activities).toBe("Actividades principales");
    expect(l.current).toBe("actual");
  });
});
