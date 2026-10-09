import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Font di-host sendiri: build tidak bergantung pada akses ke Google Fonts.
const inter = localFont({ src: "../fonts/inter-400-700.woff2", weight: "400 700", variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: { default: "E-Ticket Gathering", template: "%s · E-Ticket Gathering" },
  description: "Klaim tiket gratis untuk event favoritmu. Satu akun, satu tiket, atas nama sendiri.",
};

export const viewport: Viewport = { themeColor: "#1B3A6F", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={inter.variable}>
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}
