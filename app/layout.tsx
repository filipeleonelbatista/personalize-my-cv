import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Personalize My CV",
  description: "Gerador de currículos otimizados por vaga (MVP)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-white text-black antialiased">{children}</body>
    </html>
  );
}
