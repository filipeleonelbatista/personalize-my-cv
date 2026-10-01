"use client";
import CookieConsent from "react-cookie-consent";
import { useTranslations } from "next-intl";

function remember(choice: "accepted" | "declined") {
  try {
    localStorage.setItem("pmcv:consent", choice);
  } catch {
    /* storage cheio/bloqueado: o cookie pmcv-consent já registra a escolha */
  }
}

export function CookieBanner() {
  const t = useTranslations("Cookie");
  return (
    <CookieConsent
      cookieName="pmcv-consent"
      expires={365}
      enableDeclineButton
      flipButtons
      buttonText={t("accept")}
      declineButtonText={t("decline")}
      onAccept={() => remember("accepted")}
      onDecline={() => remember("declined")}
      style={{
        background: "var(--background)",
        color: "var(--foreground)",
        borderTop: "1px solid var(--border)",
        fontSize: "13px",
        alignItems: "center",
      }}
      contentStyle={{ flex: "1 1 auto", margin: "8px 16px" }}
      buttonStyle={{
        background: "var(--primary)",
        color: "var(--primary-foreground)",
        borderRadius: "8px",
        fontSize: "13px",
        fontWeight: 600,
        padding: "8px 16px",
      }}
      declineButtonStyle={{
        background: "transparent",
        color: "var(--foreground)",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        fontSize: "13px",
        padding: "8px 16px",
      }}
    >
      {t("message")}{" "}
      <a href="/privacidade" className="underline">
        {t("learnMore")}
      </a>
    </CookieConsent>
  );
}
