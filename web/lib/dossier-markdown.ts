// web/lib/dossier-markdown.ts
// Stub da exportação Markdown do dossiê — a Task 9 substitui o corpo.
import type { Dossier, DossierMatch } from "./dossier-schema";

export function buildDossierMarkdown(dossier: Dossier, _match: DossierMatch | null): string {
  return `# ${dossier.company}`;
}

export function dossierMarkdownFileName(dossier: Dossier): string {
  return `dossie-${dossier.companyKey}.md`;
}
