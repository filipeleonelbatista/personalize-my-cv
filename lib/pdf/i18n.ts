export type PdfLang = "pt-BR" | "en" | "es";

export type PdfLabels = {
  skills: string;
  experience: string;
  education: string;
  projects: string;
  certifications: string;
  languages: string;
  activities: string;
  competencies: string;
  current: string;
};

const LABELS: Record<PdfLang, PdfLabels> = {
  "pt-BR": {
    skills: "Habilidades",
    experience: "Experiências",
    education: "Educação",
    projects: "Projetos",
    certifications: "Certificações",
    languages: "Idiomas",
    activities: "Principais atividades",
    competencies: "Competências",
    current: "atual",
  },
  en: {
    skills: "Skills",
    experience: "Experience",
    education: "Education",
    projects: "Projects",
    certifications: "Certifications",
    languages: "Languages",
    activities: "Key activities",
    competencies: "Skills",
    current: "Present",
  },
  es: {
    skills: "Habilidades",
    experience: "Experiencia",
    education: "Educación",
    projects: "Proyectos",
    certifications: "Certificaciones",
    languages: "Idiomas",
    activities: "Actividades principales",
    competencies: "Competencias",
    current: "actual",
  },
};

export const MONTHS: Record<PdfLang, string[]> = {
  "pt-BR": ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  es: ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"],
};

export function pdfLabels(lang: PdfLang = "pt-BR"): PdfLabels {
  return LABELS[lang] ?? LABELS["pt-BR"];
}
