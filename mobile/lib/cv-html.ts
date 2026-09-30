// mobile/lib/cv-html.ts
// Printable HTML CV mirroring the web CVDocument sections (headers,
// summary, experience, education, skills, certifications, languages,
// projects) with per-CV-language titles. Rendered via expo-print.
import { cvSectionTitles, type BaseLang } from "./cv-labels";
import type { Resume } from "./resume-schema";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function periodo(e: Resume["secoes"]["experiencia"][number] | Resume["secoes"]["formacao"][number]): string {
  const p = e.periodo;
  const fim = p.atual ? "atual" : (p.fim ?? "");
  return `${esc(p.inicio)} – ${esc(fim)}`;
}

export function cvHtml(resume: Resume, lang: BaseLang): string {
  const L = cvSectionTitles(lang);
  const h = resume.cabecalho;
  const s = resume.secoes;
  const contacts = h.contatos.map((c) => (c.link ? `<a href="${esc(c.link)}">${esc(c.valor)}</a>` : esc(c.valor))).join(" &nbsp;•&nbsp; ");
  const exp = s.experiencia
    .map(
      (e) => `<div class="job">
        <div class="row"><span class="cargo">${esc(e.cargo)}</span><span class="periodo">${periodo(e)}</span></div>
        <div class="org">${esc(e.empresa)}${e.local ? ` — <em>${esc(e.local)}</em>` : ""}</div>
        ${e.descricao ? `<p>${esc(e.descricao)}</p>` : ""}
        ${e.realizacoes.length ? `<ul>${e.realizacoes.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>` : ""}
        ${e.tecnologias.length ? `<p><strong>Competências:</strong> ${e.tecnologias.map(esc).join(", ")}</p>` : ""}
      </div>`,
    )
    .join("");
  const edu = s.formacao
    .map(
      (f) => `<div class="job">
        <div class="row"><span class="cargo">${esc(f.curso)}</span><span class="periodo">${periodo(f)}</span></div>
        <div class="org">${esc(f.instituicao)}${f.local ? ` — <em>${esc(f.local)}</em>` : ""}</div>
        ${f.descricao ? `<p>${esc(f.descricao)}</p>` : ""}
      </div>`,
    )
    .join("");
  const hab = s.habilidades.map((g) => `<p><strong>${esc(g.nome)}:</strong> ${g.itens.map(esc).join(", ")}</p>`).join("");
  const cert = s.certificacoes.map((c) => `<li>${esc(c.nome)} — ${esc(c.emissor)} (${c.ano})</li>`).join("");
  const idi = s.idiomas.map((l) => `<li>${esc(l.idioma)} — ${esc(l.nivel)}</li>`).join("");
  const proj = s.projetos
    .map(
      (p) => `<div class="job"><span class="cargo">${esc(p.nome)}</span><p>${esc(p.descricao)}</p>${
        p.tecnologias.length ? `<p><strong>Competências:</strong> ${p.tecnologias.map(esc).join(", ")}</p>` : ""
      }</div>`,
    )
    .join("");

  return `<!doctype html>
<html><head><meta charset="utf-8" />
<style>
  @page { size: A4; margin: 56pt; }
  body { font-family: Helvetica, Arial, sans-serif; font-size: 10pt; line-height: 1.4; color: #000; overflow-wrap: break-word; word-break: break-word; }
  h1 { text-align: center; font-size: 21pt; margin: 0 0 4pt; }
  .contacts { text-align: center; font-size: 9pt; color: #0056b3; margin-bottom: 12pt; }
  .contacts a { color: #0056b3; }
  h2 { font-size: 14pt; margin: 14pt 0 6pt; }
  .cargo { font-size: 11pt; font-weight: bold; }
  .periodo { font-size: 10pt; }
  .row { display: flex; justify-content: space-between; }
  .org { font-style: italic; }
  .job { margin-bottom: 8pt; }
  ul { margin: 4pt 0; padding-left: 16pt; }
  p { text-align: justify; margin: 4pt 0; }
</style></head>
<body>
  <h1>${esc(h.nome)}</h1>
  <div class="contacts">${contacts}</div>
  <h2>${esc(h.titulo_profissional)}</h2>
  <p>${esc(s.resumo)}</p>
  ${s.experiencia.length ? `<h2>${esc(L.experiencia)}</h2>${exp}` : ""}
  ${s.formacao.length ? `<h2>${esc(L.formacao)}</h2>${edu}` : ""}
  ${s.habilidades.length ? `<h2>${esc(L.habilidades)}</h2>${hab}` : ""}
  ${s.certificacoes.length ? `<h2>${esc(L.certificacoes)}</h2><ul>${cert}</ul>` : ""}
  ${s.idiomas.length ? `<h2>${esc(L.idiomas)}</h2><ul>${idi}</ul>` : ""}
  ${s.projetos.length ? `<h2>${esc(L.projetos)}</h2>${proj}` : ""}
</body></html>`;
}
