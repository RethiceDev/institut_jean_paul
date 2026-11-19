import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { getAppUrl } from "@/lib/config";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(getAppUrl()),
  title: "Paiement en ligne – Institut Jean-Paul II",
  description: "Paiement sécurisé des frais de l'Institut Jean-Paul II (Trésorerie du Décanat, exercice 2026-2027).",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
