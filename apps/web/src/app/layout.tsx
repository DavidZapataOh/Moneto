import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Moneto",
  description: "El neobanco privado para LATAM. Construido en Solana.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
