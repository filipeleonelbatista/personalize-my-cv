"use client";
import Link from "next/link";
import { useTranslations } from "next-intl";

const SECTIONS = [1, 2, 3, 4, 5, 6];

export default function Termos() {
  const t = useTranslations("Terms");
  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("updated")}</p>
      {SECTIONS.map((n) => (
        <section key={n} className="mt-6">
          <h2 className="text-lg font-semibold">{t(`s${n}h`)}</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t(`s${n}b`)}</p>
        </section>
      ))}
      <Link href="/" className="mt-8 inline-block text-sm underline">
        {t("back")}
      </Link>
    </main>
  );
}
