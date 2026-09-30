// mobile/lib/cv-labels.ts
// CV-content language labels (section titles, fallbacks). Equivalent values
// to the web PDF i18n; owned here so mobile/ imports nothing from web/.

export type BaseLang = "pt-BR" | "en" | "es";

export function parseBaseLang(v: unknown): BaseLang {
  return v === "en" || v === "es" || v === "pt-BR" ? v : "pt-BR";
}

export type CvSectionTitles = {
  resumo: string;
  experiencia: string;
  formacao: string;
  habilidades: string;
  certificacoes: string;
  idiomas: string;
  projetos: string;
};

const TITLES: Record<BaseLang, CvSectionTitles> = {
  "pt-BR": {
    resumo: "Resumo",
    experiencia: "Experiência",
    formacao: "Formação",
    habilidades: "Habilidades",
    certificacoes: "Certificações",
    idiomas: "Idiomas",
    projetos: "Projetos",
  },
  en: {
    resumo: "Summary",
    experiencia: "Experience",
    formacao: "Education",
    habilidades: "Skills",
    certificacoes: "Certifications",
    idiomas: "Languages",
    projetos: "Projects",
  },
  es: {
    resumo: "Resumen",
    experiencia: "Experiencia",
    formacao: "Formación",
    habilidades: "Habilidades",
    certificacoes: "Certificaciones",
    idiomas: "Idiomas",
    projetos: "Proyectos",
  },
};

export function cvSectionTitles(lang: BaseLang = "pt-BR"): CvSectionTitles {
  return TITLES[lang] ?? TITLES["pt-BR"];
}

const MISSING: Record<BaseLang, { cargo: string; empresa: string }> = {
  "pt-BR": { cargo: "Vaga", empresa: "Empresa" },
  en: { cargo: "Position", empresa: "Company" },
  es: { cargo: "Puesto", empresa: "Empresa" },
};

export function missingJob(lang: BaseLang = "pt-BR"): { cargo: string; empresa: string } {
  return MISSING[lang] ?? MISSING["pt-BR"];
}
