import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { I18nProvider } from "@/lib/i18n/provider";
import { SwRegister } from "./components/SwRegister";
import "./globals.css";

const roboto = Roboto({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Personalize My CV", template: "%s — Personalize My CV" },
  description:
    "Gerador de currículos sob medida com IA: cadastre o CV base, gere versões por vaga com match, email e mensagem. Seus dados ficam no browser.",
  keywords: ["currículo", "CV", "vagas", "emprego", "IA", "Gemini", "resume", "currículum"],
  authors: [{ name: "filipeleonelbatista", url: "https://linkedin.com/in/filipeleonelbatista" }],
  creator: "filipeleonelbatista",
  robots: { index: true, follow: true },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
  openGraph: {
    type: "website",
    locale: "pt_BR",
    alternateLocale: ["en_US", "es_ES"],
    siteName: "Personalize My CV",
    title: "Personalize My CV",
    description: "Currículos sob medida com IA, no seu browser.",
    images: [{ url: "/opengraph-image.png", width: 1200, height: 630, alt: "Personalize My CV" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Personalize My CV",
    description: "Currículos sob medida com IA, no seu browser.",
    images: ["/opengraph-image.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className={roboto.variable}>
      <body className="bg-background text-foreground font-sans antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "Personalize My CV",
              applicationCategory: "BusinessApplication",
              operatingSystem: "Web",
              inLanguage: ["pt-BR", "en-US", "es-ES"],
              offers: { "@type": "Offer", price: "0" },
              description: "Gerador de currículos sob medida com IA. Seus dados ficam no browser.",
            }),
          }}
        />
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <I18nProvider>
          <SwRegister />
          <div className="flex min-h-screen flex-col">
            <div className="flex-1">{children}</div>
            <footer className="border-t border-border py-4 text-center text-xs text-muted-foreground">
              Desenvolvido por{" "}
              <a
                href="https://linkedin.com/in/filipeleonelbatista"
                target="_blank"
                rel="noopener"
                className="underline hover:text-foreground"
              >
                filipeleonelbatista
              </a>
            </footer>
          </div>
          </I18nProvider>
          <Toaster richColors position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
