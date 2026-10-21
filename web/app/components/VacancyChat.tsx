"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { LuArrowLeft, LuCheck, LuCopy, LuLoaderCircle, LuSend, LuTrash2 } from "react-icons/lu";
import { askVacancy, type ChatTurn } from "@/lib/vacancy-chat";
import { getLocale, tErr } from "@/lib/i18n/locale";
import type { StoredApp } from "@/lib/store";
import { Button } from "./ui/button";

/** Chat de consulta sobre a vaga. O histórico vive só no estado do
 *  componente: nada é gravado, fechar/limpar descarta tudo. */
export function VacancyChat({ app, onBack }: { app: StoredApp; onBack: () => void }) {
  const t = useTranslations("VacancyChat");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<number | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [turns, loading]);

  async function onSend() {
    const question = input.trim();
    if (!question || loading) return;
    if (!navigator.onLine) {
      const msg = tErr(getLocale(), "offline");
      setError(msg);
      toast.error(msg);
      return;
    }
    setError("");
    setInput("");
    setLoading(true);
    const history = turns;
    setTurns([...history, { role: "user", content: question }]);
    try {
      const answer = await askVacancy(app, question, history);
      setTurns((cur) => [...cur, { role: "assistant", content: answer }]);
    } catch (e) {
      const msg = ((e instanceof Error ? e.message : String(e)) || t("error")).slice(0, 400);
      setError(msg);
      toast.error(t("error"), { description: msg });
    } finally {
      setLoading(false);
    }
  }

  async function onCopy(index: number, text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(index);
    toast.success(t("copied"));
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="flex h-[70vh] flex-col gap-3 py-4">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <p className="text-sm font-bold">
            {app.cargo} — {app.empresa}
          </p>
          <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button variant="ghost" size="sm" onClick={() => setTurns([])} disabled={!turns.length}>
            <LuTrash2 /> {t("clear")}
          </Button>
          <Button variant="outline" size="sm" onClick={onBack}>
            <LuArrowLeft /> {t("back")}
          </Button>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto rounded-md bg-muted p-3">
        {!turns.length ? <p className="text-sm text-muted-foreground">{t("empty")}</p> : null}
        {turns.map((turn, i) => (
          <div key={i} className={turn.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={
                turn.role === "user"
                  ? "max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
                  : "max-w-[85%] space-y-1 rounded-lg border bg-background px-3 py-2 text-sm"
              }
            >
              <p className="whitespace-pre-wrap">{turn.content}</p>
              {turn.role === "assistant" ? (
                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" onClick={() => onCopy(i, turn.content)}>
                    {copied === i ? <LuCheck /> : <LuCopy />} {t("copy")}
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        ))}
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <LuLoaderCircle className="animate-spin" /> {t("sending")}
          </p>
        ) : null}
        <div ref={bottom} />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void onSend();
            }
          }}
          placeholder={t("placeholder")}
          className="w-full rounded border p-2 text-sm"
          disabled={loading}
        />
        <Button onClick={() => void onSend()} disabled={loading || !input.trim()}>
          {loading ? <LuLoaderCircle className="animate-spin" /> : <LuSend />} {t("send")}
        </Button>
      </div>
    </div>
  );
}
