"use client";
import { useTranslations } from "next-intl";

export function Footer({ version }: { version: string }) {
  const t = useTranslations("Common");
  return (
    <footer className="border-t border-border py-4 text-center text-xs text-muted-foreground">
      {t("appVersion", { v: version })} · {t("developedBy")}{" "}
      <a
        href="https://linkedin.com/in/filipeleonelbatista"
        target="_blank"
        rel="noopener"
        className="underline hover:text-foreground"
      >
        filipeleonelbatista
      </a>{" "}
      · <a href="/privacidade" className="underline hover:text-foreground">{t("privacy")}</a>{" "}
      · <a href="/termos" className="underline hover:text-foreground">{t("terms")}</a>
    </footer>
  );
}
