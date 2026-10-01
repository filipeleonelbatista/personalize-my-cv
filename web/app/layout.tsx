import type { Metadata, Viewport } from "next";
import { Roboto } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { I18nProvider } from "@/lib/i18n/provider";
import { SwRegister } from "./components/SwRegister";
import { CookieBanner } from "./components/CookieBanner";
import { Footer } from "./components/Footer";
import pkg from "../package.json";
import "./globals.css";

const roboto = Roboto({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://personalize-my-cv.vercel.app/"),
  alternates: {
    canonical: "/",
    languages: { "pt-BR": "/", "en-US": "/", "es-ES": "/" },
  },
  title: {
    default: "Personalize My CV — Currículos sob medida com IA",
    template: "%s — Personalize My CV",
  },
  description:
    "Gerador gratuito de currículos sob medida com IA: cadastre o CV base em PDF e gere versões otimizadas por vaga com índice de afinidade, email de apresentação e mensagem. Sem conta, sem servidor: seus dados ficam no seu navegador.",
  keywords: [
    "currículo",
    "CV",
    "currículo com IA",
    "vagas",
    "emprego",
    "afinidade de vaga",
    "carta de apresentação",
    "Gemini",
    "resume builder",
    "currículum",
  ],
  authors: [{ name: "filipeleonelbatista", url: "https://linkedin.com/in/filipeleonelbatista" }],
  creator: "filipeleonelbatista",
  category: "productivity",
  robots: { index: true, follow: true },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    url: "/",
    locale: "pt_BR",
    alternateLocale: ["en_US", "es_ES"],
    siteName: "Personalize My CV",
    title: "Personalize My CV — Currículos sob medida com IA",
    description:
      "CV base em PDF + IA por vaga: afinidade, email e mensagem. Grátis, sem conta, no seu browser.",
    images: [{ url: "/opengraph-image.png", width: 1200, height: 630, alt: "Personalize My CV" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Personalize My CV — Currículos sob medida com IA",
    description:
      "CV base em PDF + IA por vaga: afinidade, email e mensagem. Grátis, sem conta, no seu browser.",
    images: ["/opengraph-image.png"],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
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
            <Footer version={pkg.version} />
          </div>
          <CookieBanner />
          </I18nProvider>
          <Toaster richColors position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
