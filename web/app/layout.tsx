import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { I18nProvider } from "@/lib/i18n/provider";
import { SwRegister } from "./components/SwRegister";
import "./globals.css";

export const metadata: Metadata = {
  title: "Personalize My CV",
  description: "Gerador de currículos otimizados por vaga (MVP)",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="bg-background text-foreground antialiased">
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
