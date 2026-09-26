import React from "react";
import { Document, Page, Text, View, Link, StyleSheet, type DocumentProps } from "@react-pdf/renderer";
import type { Resume } from "@/lib/resume-schema";

const s = StyleSheet.create({
  page: { padding: 56, fontFamily: "Helvetica", fontSize: 10, lineHeight: 1.4, color: "#000" },
  header: { textAlign: "center", marginBottom: 16 },
  name: { fontSize: 21, fontWeight: "bold" },
  contact: { fontSize: 9, color: "#0056b3", textDecoration: "underline", marginTop: 4 },
  role: { fontSize: 14, fontWeight: "bold", marginTop: 8 },
  body: { textAlign: "justify" },
  h2: { fontSize: 14, fontWeight: "bold", marginTop: 12, marginBottom: 4 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  jobTitle: { fontSize: 11, fontWeight: "bold" },
  org: { fontStyle: "italic", marginVertical: 2 },
  skills: { flexDirection: "row" },
  col: { width: "50%", paddingRight: 8 },
  bullet: { marginLeft: 12, marginBottom: 2 },
  comp: { marginTop: 4 },
  bold: { fontWeight: "bold" },
});

export function CVDocument({ resume }: { resume: Resume }) {
  const c = resume.cabecalho;
  const sec = resume.secoes;
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.name}>{c.nome}</Text>
          <Text style={s.contact}>{c.contatos.map((k) => k.valor).join(" | ")}</Text>
        </View>
        <Text style={s.role}>{c.titulo_profissional}</Text>
        <Text style={s.body}>{sec.resumo}</Text>
        <Text style={s.h2}>Habilidades</Text>
        <View style={s.skills}>
          {[0, 1].map((col) => (
            <View key={col} style={s.col}>
              {sec.habilidades
                .flatMap((g) => g.itens)
                .filter((_, i) => i % 2 === col)
                .map((t) => (
                  <Text key={t} style={s.bullet}>• {t}</Text>
                ))}
            </View>
          ))}
        </View>
        <Text style={s.h2}>Experiências</Text>
        {sec.experiencia.map((e) => (
          <View key={`${e.cargo}-${e.empresa}-${e.periodo.inicio}`} wrap={false} style={{ marginBottom: 10 }}>
            <View style={s.row}>
              <Text style={s.jobTitle}>{e.cargo}</Text>
              <Text>{e.periodo.inicio} – {e.periodo.atual ? "atual" : e.periodo.fim}</Text>
            </View>
            <Text style={s.org}>{e.empresa}{e.local ? `. ${e.local}` : ""}</Text>
            <Text style={s.body}>{e.descricao}</Text>
            {e.realizacoes.map((r) => (
              <Text key={r} style={s.bullet}>• {r}</Text>
            ))}
            <Text style={s.comp}><Text style={s.bold}>Competências: </Text>{e.tecnologias.join(", ")}</Text>
          </View>
        ))}
        <Text style={s.h2}>Educação</Text>
        {sec.formacao.map((f) => (
          <View key={`${f.curso}-${f.instituicao}`} wrap={false} style={{ marginBottom: 8 }}>
            <View style={s.row}>
              <Text style={s.jobTitle}>{f.curso}</Text>
              <Text>{f.periodo.inicio} - {f.periodo.atual ? "atual" : f.periodo.fim}</Text>
            </View>
            <Text style={s.org}>{f.instituicao}{f.local ? `. ${f.local}` : ""}</Text>
            {f.descricao ? <Text style={s.body}>{f.descricao}</Text> : null}
          </View>
        ))}
        {sec.projetos.length ? (
          <>
            <Text style={s.h2}>Projetos</Text>
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
            <Text style={s.h2}>Certificações</Text>
            {sec.certificacoes.map((cert) => (
              <Text key={`${cert.nome}-${cert.ano}`} style={s.bullet}>• {cert.nome} — {cert.emissor} ({cert.ano})</Text>
            ))}
          </>
        ) : null}
        {sec.idiomas.length ? (
          <>
            <Text style={s.h2}>Idiomas</Text>
            {sec.idiomas.map((idioma) => (
              <Text key={idioma.idioma} style={s.bullet}>• {idioma.idioma}: {idioma.nivel}</Text>
            ))}
          </>
        ) : null}
      </Page>
    </Document>
  );
}

export function cvElement(resume: Resume): React.ReactElement<DocumentProps> {
  return React.createElement(CVDocument, { resume }) as unknown as React.ReactElement<DocumentProps>;
}
