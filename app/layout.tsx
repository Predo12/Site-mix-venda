import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mixology Drinkeria — Drinks do seu jeito",
  description: "Escolha um clássico ou monte seu próprio drink. Entrega e retirada com preço completo antes de confirmar.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
