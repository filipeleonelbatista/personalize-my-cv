import React from "react";
import { Document, Page, Text, View, Link, StyleSheet, type DocumentProps } from "@react-pdf/renderer";
import type { Resume } from "@/lib/resume-schema";
import { formatPeriodo, skillColumns } from "./format";
import { pdfLabels, type PdfLang } from "./i18n";

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

export const cvStyles = s;

export function CVDocument({ resume, lang = "pt-BR" }: { resume: Resume; lang?: PdfLang }) {
  const c = resume.cabecalho;
  const sec = resume.secoes;
  const t = pdfLabels(lang);
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.name}>{c.nome}</Text>
          <Text style={s.contact}>{c.contatos.map((k) => k.valor).join(" | ")}</Text>
        </View>
        <Text style={s.role}>{c.titulo_profissional}</Text>
        <Text style={s.body}>{sec.resumo}</Text>
        <Text style={s.h2}>{t.skills}</Text>
        <View style={s.skills}>
          {skillColumns(sec.habilidades.flatMap((g) => g.itens)).map((items, col) =>
            items.length ? (
              <View key={col} style={s.col}>
                {items.map((t, j) => (
                  <Text key={`${col}-${j}`} style={s.bullet}>• {t}</Text>
                ))}
              </View>
            ) : null
          )}
        </View>
        <Text style={s.h2}>{t.experience}</Text>
        {sec.experiencia.map((e) => (
          <View key={`${e.cargo}-${e.empresa}-${e.periodo.inicio}`} wrap={false} style={{ marginBottom: 10 }}>
            <View style={s.row}>
              <Text style={s.jobTitle}>{e.cargo}</Text>
              <Text>{formatPeriodo(e.periodo, lang)}</Text>
            </View>
            <Text style={s.org}>{e.empresa}{e.local ? `. ${e.local}` : ""}</Text>
            <Text style={s.body}>{e.descricao}</Text>
            {e.realizacoes.length ? (
              <>
                <Text style={s.activitiesTitle}>{t.activities}</Text>
                {e.realizacoes.map((r, k) => (
                  <Text key={k} style={s.bullet}>• {r}</Text>
                ))}
              </>
            ) : null}
            <Text style={s.comp}><Text style={s.bold}>{t.competencies}: </Text>{e.tecnologias.join(", ")}</Text>
          </View>
        ))}
        <Text style={s.h2}>{t.education}</Text>
        {sec.formacao.map((f) => (
          <View key={`${f.curso}-${f.instituicao}`} wrap={false} style={{ marginBottom: 8 }}>
            <View style={s.row}>
              <Text style={s.jobTitle}>{f.curso}</Text>
              <Text>{formatPeriodo(f.periodo, lang)}</Text>
            </View>
            <Text style={s.org}>{f.instituicao}{f.local ? `. ${f.local}` : ""}</Text>
            {f.descricao ? <Text style={s.body}>{f.descricao}</Text> : null}
          </View>
        ))}
        {sec.projetos.length ? (
          <>
            <Text style={s.h2}>{t.projects}</Text>
            {sec.projetos.map((p) => (
              <View key={p.nome} style={{ marginBottom: 6 }}>
                <Text style={s.jobTitle}>{p.nome}</Text>
                <Text style={s.body}>{p.descricao}{p.tecnologias.length ? ` (${p.tecnologias.join(", ")})` : ""}</Text>
                {p.link ? <Link style={s.contact} src={p.link}>{p.link}</Link> : null}
              </View>
            ))}
          </>
        ) : null}
        {sec.certificacoes.length ? (
          <>
            <Text style={s.h2}>{t.certifications}</Text>
            {sec.certificacoes.map((cert) => (
              <Text key={`${cert.nome}-${cert.ano}`} style={s.bullet}>• {cert.nome} — {cert.emissor} ({cert.ano})</Text>
            ))}
          </>
        ) : null}
        {sec.idiomas.length ? (
          <>
            <Text style={s.h2}>{t.languages}</Text>
            {sec.idiomas.map((idioma) => (
              <Text key={idioma.idioma} style={s.bullet}>• {idioma.idioma}: {idioma.nivel}</Text>
            ))}
          </>
        ) : null}
      </Page>
    </Document>
  );
}

export function cvElement(resume: Resume, lang: PdfLang = "pt-BR"): React.ReactElement<DocumentProps> {
  return React.createElement(CVDocument, { resume, lang }) as unknown as React.ReactElement<DocumentProps>;
}
