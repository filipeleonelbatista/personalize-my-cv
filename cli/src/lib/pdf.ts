import React from "react";
import { Document, Page, Text, View, Link, StyleSheet, renderToFile, type DocumentProps } from "@react-pdf/renderer";
import type { Resume } from "./schemas.js";
import { MONTHS, pdfLabels, type PdfLang } from "./pdf-labels.js";

export function formatMesAno(yyyyMM: string, lang: PdfLang = "pt-BR"): string {
  const m = yyyyMM.match(/^(\d{4})-(\d{2})$/);
  if (!m) return yyyyMM;
  const idx = Number(m[2]) - 1;
  const months = MONTHS[lang] ?? MONTHS["pt-BR"];
  if (idx < 0 || idx > 11) return yyyyMM;
  return `${months[idx]} ${m[1]}`;
}

export function formatPeriodo(p: { inicio: string; fim: string | null; atual: boolean }, lang: PdfLang = "pt-BR"): string {
  const ini = formatMesAno(p.inicio, lang);
  const fim = p.atual || !p.fim ? pdfLabels(lang).current : formatMesAno(p.fim, lang);
  return `${ini} – ${fim}`;
}

export function skillBullets(itens: string[], perBullet = 3, maxBullets = 6): string[] {
  const skills = itens.flatMap((s) => s.split(/[,;]/).map((x) => x.trim()).filter(Boolean));
  const out: string[] = [];
  for (let i = 0; i < skills.length && out.length < maxBullets; i += perBullet) {
    out.push(skills.slice(i, i + perBullet).join(", "));
  }
  return out;
}

export function skillColumns(itens: string[]): [string[], string[]] {
  const bullets = skillBullets(itens);
  return [bullets.slice(0, 3), bullets.slice(3, 6)];
}

const s = StyleSheet.create({
  page: { padding: 56, fontFamily: "Helvetica", fontSize: 10, lineHeight: 1.4, color: "#000" },
  header: { textAlign: "center", marginBottom: 16 },
  name: { fontSize: 21, fontWeight: "bold", marginBottom: 6 },
  contact: { fontSize: 9, color: "#0056b3", textDecoration: "underline", marginTop: 4 },
  role: { fontSize: 14, fontWeight: "bold", marginTop: 8, marginBottom: 6 },
  body: { textAlign: "justify" },
  h2: { fontSize: 14, fontWeight: "bold", marginTop: 12, marginBottom: 8 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  jobTitle: { fontSize: 11, fontWeight: "bold" },
  org: { fontStyle: "italic", marginVertical: 2 },
  skills: { flexDirection: "row" },
  col: { width: "50%", paddingRight: 8 },
  bullet: { marginLeft: 12, marginBottom: 2 },
  activitiesTitle: { fontWeight: "bold", marginTop: 6, marginBottom: 2 },
  comp: { marginTop: 4 },
  bold: { fontWeight: "bold" },
});

const el = React.createElement;

function skillCol(items: string[], key: string): React.ReactElement | null {
  if (!items.length) return null;
  return el(View, { key, style: s.col }, items.map((item, j) => el(Text, { key: `${key}-${j}`, style: s.bullet }, `• ${item}`)));
}

export function cvElement(resume: Resume, lang: PdfLang = "pt-BR"): React.ReactElement<DocumentProps> {
  const c = resume.cabecalho;
  const sec = resume.secoes;
  const labels = pdfLabels(lang);
  const cols = skillColumns(sec.habilidades.flatMap((g) => g.itens));
  const kids: React.ReactNode[] = [];
  kids.push(
    el(View, { key: "header", style: s.header },
      el(Text, { style: s.name }, c.nome),
      el(Text, { style: s.contact }, c.contatos.map((k) => k.valor).join(" | "))),
    el(Text, { key: "role", style: s.role }, c.titulo_profissional),
    el(Text, { key: "resumo", style: s.body }, sec.resumo),
    el(Text, { key: "h-skills", style: s.h2 }, labels.skills),
    el(View, { key: "skills", style: s.skills }, [skillCol(cols[0], "c0"), skillCol(cols[1], "c1")]),
    el(Text, { key: "h-exp", style: s.h2 }, labels.experience),
    ...sec.experiencia.map((e) =>
      el(View, { key: `${e.cargo}-${e.empresa}-${e.periodo.inicio}`, wrap: false, style: { marginBottom: 10 } },
        el(View, { style: s.row },
          el(Text, { style: s.jobTitle }, e.cargo),
          el(Text, {}, formatPeriodo(e.periodo, lang))),
        el(Text, { style: s.org }, `${e.empresa}${e.local ? `. ${e.local}` : ""}`),
        el(Text, { style: s.body }, e.descricao),
        ...(e.realizacoes.length
          ? [
              el(Text, { key: "at", style: s.activitiesTitle }, labels.activities),
              ...e.realizacoes.map((r, k) => el(Text, { key: k, style: s.bullet }, `• ${r}`)),
            ]
          : []),
        el(Text, { style: s.comp }, el(Text, { style: s.bold }, `${labels.competencies}: `), e.tecnologias.join(", "))),
    ),
    el(Text, { key: "h-edu", style: s.h2 }, labels.education),
    ...sec.formacao.map((f) =>
      el(View, { key: `${f.curso}-${f.instituicao}`, wrap: false, style: { marginBottom: 8 } },
        el(View, { style: s.row },
          el(Text, { style: s.jobTitle }, f.curso),
          el(Text, {}, formatPeriodo(f.periodo, lang))),
        el(Text, { style: s.org }, `${f.instituicao}${f.local ? `. ${f.local}` : ""}`),
        f.descricao ? el(Text, { style: s.body }, f.descricao) : null),
    ),
  );
  if (sec.projetos.length) {
    kids.push(
      el(Text, { key: "h-proj", style: s.h2 }, labels.projects),
      ...sec.projetos.map((p) =>
        el(View, { key: p.nome, style: { marginBottom: 6 } },
          el(Text, { style: s.jobTitle }, p.nome),
          el(Text, { style: s.body }, `${p.descricao}${p.tecnologias.length ? ` (${p.tecnologias.join(", ")})` : ""}`),
          p.link ? el(Link, { style: s.contact, src: p.link }, p.link) : null),
      ),
    );
  }
  if (sec.certificacoes.length) {
    kids.push(
      el(Text, { key: "h-cert", style: s.h2 }, labels.certifications),
      ...sec.certificacoes.map((cert) =>
        el(Text, { key: `${cert.nome}-${cert.ano}`, style: s.bullet }, `• ${cert.nome} — ${cert.emissor} (${cert.ano})`)),
    );
  }
  if (sec.idiomas.length) {
    kids.push(
      el(Text, { key: "h-lang", style: s.h2 }, labels.languages),
      ...sec.idiomas.map((idioma) =>
        el(Text, { key: idioma.idioma, style: s.bullet }, `• ${idioma.idioma}: ${idioma.nivel}`)),
    );
  }
  return el(Document, {}, el(Page, { size: "A4", style: s.page }, ...kids));
}

export async function renderPdf(resume: Resume, lang: PdfLang, outPath: string): Promise<void> {
  await renderToFile(cvElement(resume, lang), outPath);
}
