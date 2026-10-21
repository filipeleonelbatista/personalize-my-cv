"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { Dossier, DossierMatch, Evidence } from "@/lib/dossier-schema";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { CopyButton } from "./CopyButton";

const SEVERITIES = ["high", "medium", "low"] as const;

function verdictVariant(verdict: "vai" | "cautela" | "desistir") {
  if (verdict === "vai") return "success" as const;
  if (verdict === "desistir") return "destructive" as const;
  return "default" as const;
}

function severityVariant(severity: "high" | "medium" | "low") {
  if (severity === "high") return "destructive" as const;
  if (severity === "low") return "outline" as const;
  return "default" as const;
}

function sentimentVariant(sentiment: "pro" | "contra" | "neutro") {
  if (sentiment === "pro") return "success" as const;
  if (sentiment === "contra") return "destructive" as const;
  return "outline" as const;
}

/** Evidência com URL vira link; sem URL mostra `noSource` e nunca um link. */
function EvidenceList({ items }: { items: Evidence[] }) {
  const t = useTranslations("Dossier");
  if (items.length === 0) return null;
  return (
    <ul className="space-y-1 text-xs">
      {items.map((item, index) => (
        <li key={`${item.claim}-${index}`}>
          {item.date ? <span className="text-muted-foreground">{item.date} · </span> : null}
          {item.sourceUrl ? (
            <a href={item.sourceUrl} target="_blank" rel="noopener" className="underline">
              {item.claim}
            </a>
          ) : (
            <>
              <span>{item.claim}</span> <span className="text-muted-foreground">{t("noSource")}</span>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

export function DossierPanel({
  dossier,
  match,
  onAnalyze,
  onRefresh,
  onExportMd,
  busy,
}: {
  dossier: Dossier;
  match: DossierMatch | null;
  onAnalyze: () => void;
  onRefresh: () => void;
  onExportMd: () => void;
  busy: boolean;
}) {
  const t = useTranslations("Dossier");
  const te = useTranslations("Dossier.enums");
  const [tab, setTab] = useState("panorama");

  const missingCoverage = dossier.coverage.filter((item) => item.status === "ausente" || item.status === "parcial").length;

  function noAnalysis() {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{t("noDossier")}</p>
        <Button onClick={onAnalyze} disabled={busy}>
          {t("analyze")}
        </Button>
      </div>
    );
  }

  return (
    <Tabs value={tab} onChange={setTab}>
      <TabsList className="flex-wrap h-auto">
        <TabsTrigger value="panorama">{t("tabs.panorama")}</TabsTrigger>
        <TabsTrigger value="empresa">{t("tabs.empresa")}</TabsTrigger>
        <TabsTrigger value="lideranca">{t("tabs.lideranca")}</TabsTrigger>
        <TabsTrigger value="produtos">{t("tabs.produtos")}</TabsTrigger>
        <TabsTrigger value="reputacao">{t("tabs.reputacao")}</TabsTrigger>
        <TabsTrigger value="contatos">{t("tabs.contatos")}</TabsTrigger>
        <TabsTrigger value="redes">{t("tabs.redes")}</TabsTrigger>
        <TabsTrigger value="abordagem">{t("tabs.abordagem")}</TabsTrigger>
        <TabsTrigger value="perguntas">{t("tabs.perguntas")}</TabsTrigger>
        <TabsTrigger value="fontes">{t("tabs.fontes")}</TabsTrigger>
      </TabsList>

      <TabsContent value="panorama">
        {match ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant={verdictVariant(match.alignment.verdict)}>{te(`verdict.${match.alignment.verdict}`)}</Badge>
              <span className="text-sm font-medium">{match.alignment.score}%</span>
              <Progress value={match.alignment.score} className="min-w-40 flex-1" />
            </div>
            {match.alignment.dimensions.length > 0 ? (
              <div className="space-y-2">
                {match.alignment.dimensions.map((dimension) => (
                  <div key={dimension.key} className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span>{dimension.note}</span>
                      <span className="text-muted-foreground">{dimension.score}%</span>
                    </div>
                    <Progress value={dimension.score} />
                  </div>
                ))}
              </div>
            ) : null}
            <Badge variant={missingCoverage > 0 ? "destructive" : "success"} className="text-sm font-normal">
              {missingCoverage > 0 ? t("coveragePartial", { n: missingCoverage }) : t("coverageOk")}
            </Badge>
          </div>
        ) : (
          noAnalysis()
        )}
      </TabsContent>

      <TabsContent value="empresa">
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">{t("sections.historia")}</h3>
          {dossier.history.summary ? <p className="text-sm">{dossier.history.summary}</p> : null}
          {dossier.history.founded ? <Badge variant="outline">{dossier.history.founded}</Badge> : null}
          {dossier.history.timeline.length > 0 ? (
            <div className="space-y-1 text-sm">
              {dossier.history.timeline.map((entry) => (
                <p key={`${entry.year}-${entry.event}`}>
                  <span className="font-medium">{entry.year}</span> — {entry.event}
                </p>
              ))}
            </div>
          ) : null}
          {dossier.history.mission ? <p className="border-l-2 border-border pl-3 text-sm">{dossier.history.mission}</p> : null}
          {dossier.history.vision ? <p className="border-l-2 border-border pl-3 text-sm">{dossier.history.vision}</p> : null}
          {dossier.history.values.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {dossier.history.values.map((value) => (
                <Badge key={value} variant="secondary">
                  {value}
                </Badge>
              ))}
            </div>
          ) : null}

          <div className="space-y-1 rounded-md border border-border p-3 text-sm">
            <p className="text-sm font-semibold">{t("sections.cnpj")}</p>
            {dossier.legal.razaoSocial ? <p>{dossier.legal.razaoSocial}</p> : null}
            {dossier.legal.nomeFantasia ? <p className="text-muted-foreground">{dossier.legal.nomeFantasia}</p> : null}
            {[dossier.legal.openedAt, dossier.legal.cnae, dossier.legal.porte, dossier.legal.capitalSocial].some(Boolean) ? (
              <p className="text-muted-foreground">
                {[dossier.legal.openedAt, dossier.legal.cnae, dossier.legal.porte, dossier.legal.capitalSocial].filter(Boolean).join(" · ")}
              </p>
            ) : null}
            {dossier.legal.partners.map((partner) => (
              <p key={`${partner.name}-${partner.role}`} className="text-muted-foreground">
                {partner.name} — {partner.role}
                {partner.since ? ` (${partner.since})` : ""}
              </p>
            ))}
          </div>
        </div>
      </TabsContent>

      <TabsContent value="lideranca">
        {dossier.leadership.ceo ? (
          <div className="space-y-2 rounded-md border border-border p-3">
            <p className="font-medium">{dossier.leadership.ceo.name}</p>
            {dossier.leadership.ceo.role ? <p className="text-sm text-muted-foreground">{dossier.leadership.ceo.role}</p> : null}
            {dossier.leadership.ceo.bio ? <p className="text-sm">{dossier.leadership.ceo.bio}</p> : null}
            <EvidenceList items={dossier.leadership.ceo.highlights} />
          </div>
        ) : null}
      </TabsContent>

      <TabsContent value="produtos">
        <div className="grid gap-3 sm:grid-cols-2">
          {dossier.products.map((product) => (
            <div key={product.name} className="space-y-1 rounded-md border border-border p-3">
              <p className="font-medium">{product.name}</p>
              {product.description ? <p className="text-sm">{product.description}</p> : null}
              {product.customerSignal ? <p className="text-sm text-muted-foreground">{product.customerSignal}</p> : null}
              <EvidenceList items={product.evidence} />
            </div>
          ))}
        </div>
      </TabsContent>

      <TabsContent value="reputacao">
        <div className="space-y-4">
          {SEVERITIES.map((severity) => {
            const flags = dossier.reputation.redFlags.filter((flag) => flag.severity === severity);
            if (flags.length === 0) return null;
            return (
              <div key={severity} className="space-y-2">
                <Badge variant={severityVariant(severity)}>{te(`severity.${severity}`)}</Badge>
                {flags.map((flag) => (
                  <div key={flag.title} className="space-y-1 rounded-md border border-border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{flag.title}</p>
                      <Badge variant="secondary">{te(`category.${flag.category}`)}</Badge>
                    </div>
                    {flag.detail ? <p className="text-sm">{flag.detail}</p> : null}
                    {flag.date ? <p className="text-xs text-muted-foreground">{flag.date}</p> : null}
                    {flag.mitigation ? <p className="text-sm text-muted-foreground">{flag.mitigation}</p> : null}
                    <EvidenceList items={flag.evidence} />
                  </div>
                ))}
              </div>
            );
          })}
          {dossier.reputation.reviews.length > 0 ? (
            <div className="space-y-2">
              {dossier.reputation.reviews.map((review, index) => (
                <div key={`${review.source}-${index}`} className="space-y-1 rounded-md border border-border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{te(`source.${review.source}`)}</Badge>
                    <Badge variant={sentimentVariant(review.sentiment)}>{te(`sentiment.${review.sentiment}`)}</Badge>
                  </div>
                  {review.topic ? <p className="text-sm">{review.topic}</p> : null}
                  {review.date ? <p className="text-xs text-muted-foreground">{review.date}</p> : null}
                  {review.quote ? (
                    review.sourceUrl ? (
                      <a href={review.sourceUrl} target="_blank" rel="noopener" className="text-sm underline">
                        {review.quote}
                      </a>
                    ) : (
                      <p className="text-sm">
                        {review.quote} <span className="text-muted-foreground">{t("noSource")}</span>
                      </p>
                    )
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </TabsContent>

      <TabsContent value="contatos">
        <div className="grid gap-3 sm:grid-cols-2">
          {dossier.contacts.map((contact) => (
            <div key={`${contact.name}-${contact.channel}`} className="space-y-1 rounded-md border border-border p-3">
              <p className="font-medium">{contact.name}</p>
              {contact.role ? <p className="text-xs text-muted-foreground">{contact.role}</p> : null}
              <div className="flex flex-wrap gap-1">
                <Badge variant="secondary">{te(`kind.${contact.kind}`)}</Badge>
                <Badge variant="outline">{te(`channel.${contact.channel}`)}</Badge>
                <Badge variant="outline">{te(`confidence.${contact.confidence}`)}</Badge>
              </div>
              {contact.hint ? <p className="text-sm">{contact.hint}</p> : null}
              {contact.url ? (
                <a href={contact.url} target="_blank" rel="noopener" className="break-all text-xs underline">
                  {contact.url}
                </a>
              ) : null}
            </div>
          ))}
        </div>
      </TabsContent>

      <TabsContent value="redes">
        <div className="space-y-3">
          {dossier.socials.map((social) => (
            <div key={`${social.network}-${social.handle ?? ""}`} className="space-y-1 rounded-md border border-border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{te(`network.${social.network}`)}</Badge>
                {social.handle ? <span className="text-xs text-muted-foreground">{social.handle}</span> : null}
              </div>
              {social.tone ? <p className="text-sm">{social.tone}</p> : null}
              {social.posts.map((post, index) => (
                <p key={`${post.date ?? ""}-${index}`} className="text-sm">
                  {post.date ? <span className="text-muted-foreground">{post.date} — </span> : null}
                  {post.url ? (
                    <a href={post.url} target="_blank" rel="noopener" className="underline">
                      {post.text}
                    </a>
                  ) : (
                    post.text
                  )}
                </p>
              ))}
              {social.url ? (
                <a href={social.url} target="_blank" rel="noopener" className="break-all text-xs underline">
                  {social.url}
                </a>
              ) : null}
            </div>
          ))}
        </div>
      </TabsContent>

      <TabsContent value="abordagem">
        {match ? (
          <div className="space-y-3">
            {match.outreach.map((item) => (
              <div key={`${item.target}-${item.goal}`} className="space-y-1 rounded-md border border-border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{item.target}</p>
                  {item.role ? <span className="text-xs text-muted-foreground">{item.role}</span> : null}
                  <Badge variant="secondary">{te(`goal.${item.goal}`)}</Badge>
                  <Badge variant="outline">{te(`channel.${item.channel}`)}</Badge>
                </div>
                {item.angle ? <p className="text-sm">{item.angle}</p> : null}
                {item.message ? <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">{item.message}</pre> : null}
                {item.message ? <CopyButton text={item.message} label={item.target} /> : null}
                {item.sourceUrl ? (
                  <a href={item.sourceUrl} target="_blank" rel="noopener" className="text-xs underline">
                    {t("source")}
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          noAnalysis()
        )}
      </TabsContent>

      <TabsContent value="perguntas">
        {match ? (
          <div className="space-y-3">
            {match.questions.map((question, index) => (
              <div key={`${question.question}-${index}`} className="space-y-1 rounded-md border border-border p-3">
                <p className="text-sm font-medium">{question.question}</p>
                {question.why ? <p className="text-sm text-muted-foreground">{question.why}</p> : null}
                {question.sourceUrl ? (
                  <a href={question.sourceUrl} target="_blank" rel="noopener" className="text-xs underline">
                    {t("source")}
                  </a>
                ) : (
                  <span className="text-xs text-muted-foreground">{t("noSource")}</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          noAnalysis()
        )}
      </TabsContent>

      <TabsContent value="fontes">
        <div className="space-y-2">
          {dossier.sources.map((source) => (
            <div key={source.url} className="space-y-1 text-sm">
              <a href={source.url} target="_blank" rel="noopener" className="break-all underline">
                {source.title || source.url}
              </a>
              <p className="break-all text-xs text-muted-foreground">
                {[source.url, source.publishedAt, source.provider].filter(Boolean).join(" · ")}
              </p>
            </div>
          ))}
        </div>
      </TabsContent>

      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        <Button onClick={onAnalyze} disabled={busy}>
          {t("analyze")}
        </Button>
        <Button variant="outline" onClick={onRefresh}>
          {t("refresh")}
        </Button>
        <Button variant="outline" onClick={onExportMd}>
          {t("exportMd")}
        </Button>
      </div>
    </Tabs>
  );
}
