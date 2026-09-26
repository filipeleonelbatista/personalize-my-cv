import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Personalize My CV",
  description: "Gerador de currículos otimizados por vaga (MVP)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="bg-background text-foreground antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
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
          <Toaster richColors position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
