// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AllSky — Météores",
  icons: {
    icon: [{ url: "/icon.png", type: "image/png", sizes: "32x32" }],
  },
  description: "Tableau de bord de détection des météores AllSky",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
