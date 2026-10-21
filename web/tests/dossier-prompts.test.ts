import { describe, expect, it } from "vitest";
import { buildDossierSystem, buildDossierUser, buildMatchSystem, buildMatchUser } from "@/lib/llm/prompts";

describe("prompts do dossiê", () => {
  it("exige URL do corpus e proíbe data inventada", () => {
    const s = buildDossierSystem("pt-BR");
    expect(s).toMatch(/corpus/i);
    expect(s).toMatch(/nunca invente|nao invente|invent/i);
    expect(s).toMatch(/sourceUrl/);
  });

  it("lista os literais exatos dos enums", () => {
    const s = buildDossierSystem("pt-BR");
    for (const lit of ["high", "medium", "low", "rh", "gestor", "dpo", "recrutador", "executivo", "pro", "contra", "neutro"]) expect(s).toContain(lit);
  });

  it("descreve o shape completo da segunda chamada e todos os literais", () => {
    const s = buildDossierSystem("pt-BR");
    for (const field of ["reputation", "reviews", "redFlags", "contacts", "socials"]) expect(s).toContain(field);
    expect(s).toContain("source=");
    expect(s).toContain("category=");
    for (const lit of ["glassdoor", "jusbrasil", "reclameaqui", "indeed", "reddit", "processo_trabalhista", "financeiro", "reputacao", "outro", "confidence", "linkedin", "instagram", "youtube"]) expect(s).toContain(lit);
  });

  it("pede o texto no idioma do dossiê", () => {
    expect(buildDossierSystem("en")).toMatch(/English/i);
    expect(buildDossierSystem("es")).toMatch(/Español|Espanol/i);
  });

  it("o prompt do match exige âncora no resume e mensagem pronta", () => {
    const s = buildMatchSystem("pt-BR");
    expect(s).toMatch(/resume/i);
    expect(s).toMatch(/message/i);
    expect(s).toMatch(/outreach/i);
  });

  it("o user do dossiê recebe o corpus verbatim", () => {
    expect(buildDossierUser("CORPUS_AQUI")).toContain("CORPUS_AQUI");
    expect(buildMatchUser("PAYLOAD")).toContain("PAYLOAD");
  });
});
