import type { Dossier, DossierMatch } from "./dossier-schema";

const LABELS = {
  "pt-BR": {
    title: "Dossiê",
    generated: "Gerado em",
    language: "idioma",
    overview: "Panorama da candidatura",
    verdict: "Veredito",
    alignment: "alinhamento",
    dimensions: "Dimensões de alinhamento",
    attention: "Pontos de atenção",
    correlations: "Correlações",
    gaps: "Lacunas",
    redFlagSummary: "Resumo dos alertas para esta candidatura",
    company: "Empresa",
    founded: "Fundada em",
    mission: "Missão",
    vision: "Visão",
    values: "Valores",
    timeline: "Histórico",
    legal: "Dados legais",
    registration: "CNPJ",
    openedAt: "Abertura",
    cnae: "CNAE",
    size: "Porte",
    capital: "Capital social",
    partners: "Sócios",
    leadership: "Liderança",
    products: "Produtos",
    reputation: "Reputação",
    redFlags: "Alertas",
    contacts: "Contatos",
    socials: "Redes sociais",
    coverage: "Cobertura da pesquisa",
    questions: "Perguntas para a entrevista",
    outreach: "Plano de abordagem",
    sources: "Fontes",
    noDate: "sem data",
    noUrl: "sem URL",
  },
  en: {
    title: "Company dossier",
    generated: "Generated on",
    language: "language",
    overview: "Application overview",
    verdict: "Verdict",
    alignment: "alignment",
    dimensions: "Alignment dimensions",
    attention: "Points to consider",
    correlations: "Correlations",
    gaps: "Gaps",
    redFlagSummary: "Risk summary for this application",
    company: "Company",
    founded: "Founded",
    mission: "Mission",
    vision: "Vision",
    values: "Values",
    timeline: "Timeline",
    legal: "Legal information",
    registration: "Company registration",
    openedAt: "Registration date",
    cnae: "Industry code",
    size: "Company size",
    capital: "Share capital",
    partners: "Partners",
    leadership: "Leadership",
    products: "Products",
    reputation: "Reputation",
    redFlags: "Red flags",
    contacts: "Contacts",
    socials: "Social media",
    coverage: "Research coverage",
    questions: "Interview questions",
    outreach: "Outreach plan",
    sources: "Sources",
    noDate: "undated",
    noUrl: "no URL",
  },
  es: {
    title: "Dossier de empresa",
    generated: "Generado el",
    language: "idioma",
    overview: "Resumen de la candidatura",
    verdict: "Veredicto",
    alignment: "alineación",
    dimensions: "Dimensiones de alineación",
    attention: "Puntos de atención",
    correlations: "Correlaciones",
    gaps: "Brechas",
    redFlagSummary: "Resumen de alertas para esta candidatura",
    company: "Empresa",
    founded: "Fundada en",
    mission: "Misión",
    vision: "Visión",
    values: "Valores",
    timeline: "Historia",
    legal: "Datos legales",
    registration: "Registro",
    openedAt: "Fecha de apertura",
    cnae: "Actividad económica",
    size: "Tamaño",
    capital: "Capital social",
    partners: "Socios",
    leadership: "Liderazgo",
    products: "Productos",
    reputation: "Reputación",
    redFlags: "Alertas",
    contacts: "Contactos",
    socials: "Redes sociales",
    coverage: "Cobertura de la investigación",
    questions: "Preguntas para la entrevista",
    outreach: "Plan de contacto",
    sources: "Fuentes",
    noDate: "sin fecha",
    noUrl: "sin URL",
  },
} as const;

function markdownText(value: string): string {
  return value.replace(/([\\`*_{}\[\]()#+.!|>~-])/g, "\\$1");
}

function markdownLink(url: string | null | undefined, label: string): string {
  if (!url) return markdownText(label);
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return markdownText(label);
    return `[${markdownText(label || url)}](<${parsed.href}>)`;
  } catch {
    return markdownText(label || url);
  }
}

function section(lines: string[], title: string): void {
  lines.push("", `## ${title}`, "");
}

function bullet(lines: string[], value: string): void {
  lines.push(`- ${value}`);
}

export function dossierMarkdownFileName(dossier: Dossier): string {
  const safeCompanyKey = dossier.companyKey.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "empresa";
  return `dossie-${safeCompanyKey}.md`;
}

export function buildDossierMarkdown(dossier: Dossier, match: DossierMatch | null): string {
  const t = LABELS[dossier.lang];
  const lines: string[] = [
    `# ${t.title} — ${markdownText(dossier.company)}`,
    "",
    `${t.generated} ${dossier.createdAt.slice(0, 10)} · ${t.language}: ${dossier.lang}`,
  ];

  if (match) {
    section(lines, t.overview);
    bullet(lines, `${t.verdict}: **${match.alignment.verdict}** · ${t.alignment}: ${match.alignment.score}%`);
    if (match.alignment.dimensions.length) {
      lines.push("", `### ${t.dimensions}`, "");
      for (const dimension of match.alignment.dimensions) {
        bullet(lines, `**${dimension.key} — ${dimension.score}%**${dimension.note ? `: ${markdownText(dimension.note)}` : ""}`);
      }
    }
    if (match.attentionPoints.length) {
      lines.push("", `### ${t.attention}`, "");
      match.attentionPoints.forEach((point) => bullet(lines, markdownText(point)));
    }
    if (match.correlations.length) {
      lines.push("", `### ${t.correlations}`, "");
      match.correlations.forEach((item) => bullet(lines, `**${markdownText(item.theme)}** — ${markdownText(item.theirs)} / ${markdownText(item.mine)}`));
    }
    if (match.gaps.length) {
      lines.push("", `### ${t.gaps}`, "");
      match.gaps.forEach((gap) => bullet(lines, markdownText(gap)));
    }
    if (match.redFlagSummary.length) {
      lines.push("", `### ${t.redFlagSummary}`, "");
      match.redFlagSummary.forEach((flag) => bullet(lines, markdownText(flag)));
    }
  }

  section(lines, t.company);
  if (dossier.history.summary) lines.push(markdownText(dossier.history.summary), "");
  if (dossier.history.founded) bullet(lines, `${t.founded}: ${markdownText(dossier.history.founded)}`);
  if (dossier.history.mission) bullet(lines, `${t.mission}: ${markdownText(dossier.history.mission)}`);
  if (dossier.history.vision) bullet(lines, `${t.vision}: ${markdownText(dossier.history.vision)}`);
  if (dossier.history.values.length) bullet(lines, `${t.values}: ${dossier.history.values.map(markdownText).join(", ")}`);
  if (dossier.history.timeline.length) {
    lines.push("", `### ${t.timeline}`, "");
    dossier.history.timeline.forEach((item) => bullet(lines, `**${markdownText(item.year)}** — ${markdownText(item.event)}`));
  }

  const legal = dossier.legal;
  const legalEntries = [
    legal.razaoSocial,
    legal.nomeFantasia,
    legal.openedAt && `${t.openedAt}: ${legal.openedAt}`,
    legal.cnae && `${t.cnae}: ${legal.cnae}`,
    legal.porte && `${t.size}: ${legal.porte}`,
    legal.capitalSocial && `${t.capital}: ${legal.capitalSocial}`,
  ].filter((entry): entry is string => Boolean(entry));
  if (dossier.cnpj || legalEntries.length || legal.partners.length) {
    lines.push("", `### ${t.legal}`, "");
    if (dossier.cnpj) bullet(lines, `${t.registration}: ${markdownText(dossier.cnpj)}`);
    legalEntries.forEach((entry) => bullet(lines, markdownText(entry)));
    legal.partners.forEach((partner) => bullet(lines, `${markdownText(partner.name)}${partner.role ? ` — ${markdownText(partner.role)}` : ""}${partner.since ? ` (${markdownText(partner.since)})` : ""}`));
  }

  section(lines, t.leadership);
  const ceo = dossier.leadership.ceo;
  if (ceo) {
    lines.push(`**${markdownText(ceo.name)}**${ceo.role ? ` — ${markdownText(ceo.role)}` : ""}`, "");
    if (ceo.bio) lines.push(markdownText(ceo.bio), "");
    ceo.highlights.forEach((highlight) => {
      bullet(lines, `${markdownText(highlight.claim)}${highlight.date ? ` (${markdownText(highlight.date)})` : ""}${highlight.sourceUrl ? ` · ${markdownLink(highlight.sourceUrl, highlight.sourceTitle || highlight.sourceUrl)}` : ""}`);
      if (highlight.quote) lines.push(`  > ${markdownText(highlight.quote)}`);
    });
  }

  section(lines, t.products);
  dossier.products.forEach((product) => {
    bullet(lines, `**${markdownText(product.name)}**${product.description ? ` — ${markdownText(product.description)}` : ""}${product.customerSignal ? ` · ${markdownText(product.customerSignal)}` : ""}`);
    product.evidence.forEach((evidence) => {
      lines.push(`  - ${markdownText(evidence.claim)}${evidence.date ? ` (${markdownText(evidence.date)})` : ""}${evidence.sourceUrl ? ` · ${markdownLink(evidence.sourceUrl, evidence.sourceTitle || evidence.sourceUrl)}` : ""}`);
    });
  });

  section(lines, t.reputation);
  dossier.reputation.redFlags.forEach((flag) => {
    bullet(lines, `**[${flag.severity}] ${markdownText(flag.title)}**${flag.detail ? ` — ${markdownText(flag.detail)}` : ""}${flag.date ? ` (${markdownText(flag.date)})` : ""}`);
    if (flag.mitigation) lines.push(`  - ${markdownText(flag.mitigation)}`);
    flag.evidence.forEach((evidence) => {
      lines.push(`  - ${markdownText(evidence.claim)}${evidence.sourceUrl ? ` · ${markdownLink(evidence.sourceUrl, evidence.sourceTitle || evidence.sourceUrl)}` : ""}`);
    });
  });
  dossier.reputation.reviews.forEach((review) => {
    bullet(lines, `**${markdownText(review.source)} · ${review.sentiment} · ${markdownText(review.date || t.noDate)}**${review.topic ? ` — ${markdownText(review.topic)}` : ""}`);
    if (review.quote) lines.push(`  > ${markdownText(review.quote)}`);
    if (review.sourceUrl) lines.push(`  ${markdownLink(review.sourceUrl, review.sourceUrl)}`);
  });

  section(lines, t.contacts);
  dossier.contacts.forEach((contact) => {
    bullet(lines, `**${markdownText(contact.name)}**${contact.role ? ` — ${markdownText(contact.role)}` : ""} (${contact.kind}, ${contact.channel})${contact.hint ? ` · ${markdownText(contact.hint)}` : ""}${contact.url ? ` · ${markdownLink(contact.url, contact.url)}` : ""}`);
  });

  section(lines, t.socials);
  dossier.socials.forEach((social) => {
    bullet(lines, `**${social.network}**${social.handle ? ` · ${markdownText(social.handle)}` : ""}${social.tone ? ` — ${markdownText(social.tone)}` : ""}${social.url ? ` · ${markdownLink(social.url, social.url)}` : ""}`);
    social.posts.forEach((post) => {
      lines.push(`  - ${markdownText(post.date || t.noDate)}: ${markdownText(post.text)}${post.url ? ` · ${markdownLink(post.url, post.url)}` : ""}`);
    });
  });

  if (dossier.coverage.length) {
    section(lines, t.coverage);
    dossier.coverage.forEach((item) => bullet(lines, `${item.section}: ${item.status}`));
  }

  if (match) {
    if (match.outreach.length) {
      section(lines, t.outreach);
      match.outreach.forEach((item) => {
        bullet(lines, `**${markdownText(item.target)}**${item.role ? ` — ${markdownText(item.role)}` : ""} (${item.goal}, ${item.channel})${item.angle ? ` · ${markdownText(item.angle)}` : ""}${item.sourceUrl ? ` · ${markdownLink(item.sourceUrl, item.sourceUrl)}` : ""}`);
        if (item.message) lines.push("", `> ${markdownText(item.message)}`, "");
      });
    }
    if (match.questions.length) {
      section(lines, t.questions);
      match.questions.forEach((item) => {
        bullet(lines, `${markdownText(item.question)}${item.why ? ` — ${markdownText(item.why)}` : ""}${item.sourceUrl ? ` · ${markdownLink(item.sourceUrl, item.sourceUrl)}` : ""}`);
      });
    }
  }

  section(lines, t.sources);
  dossier.sources.forEach((source) => {
    const date = source.publishedAt || source.retrievedAt.slice(0, 10) || t.noDate;
    bullet(lines, `${markdownLink(source.url, source.title || source.url)} (${markdownText(date)}, ${source.provider})`);
  });

  return lines.join("\n").trimEnd() + "\n";
}
