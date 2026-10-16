import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "@/components/site/site.css";
import "@/components/site/theme.css";
import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { StarSky } from "@/components/site/ornaments";
import { HelpBubble, RevealOnScroll } from "@/components/site/site-chrome";
import { PwaSetup } from "@/components/site/pwa";
import { Backsound } from "@/components/site/backsound";

// Font di-host sendiri (next/font/local): build tidak bergantung pada akses ke Google Fonts.
const jakarta = localFont({ src: "../../fonts/plus-jakarta-sans-400-800.woff2", weight: "400 800", variable: "--font-jakarta", display: "swap" });
// Orbitron (angka countdown) & Permanent Marker (aksen kuas) jarang dipakai: tidak di-preload,
// hanya diunduh browser bila ada teks yang memakainya.
const orbitron = localFont({ src: "../../fonts/orbitron-500-900.woff2", weight: "500 900", variable: "--font-orbitron", display: "swap", preload: false });
// Judul bergaya tabung neon (moodboard) & tagline kuas.
const quicksand = localFont({ src: "../../fonts/quicksand-400-700.woff2", weight: "400 700", variable: "--font-quicksand", display: "swap" });
const marker = localFont({ src: "../../fonts/permanent-marker-400.woff2", weight: "400", variable: "--font-marker", display: "swap", preload: false });
const rajdhani = localFont({
  src: [
    { path: "../../fonts/rajdhani-600.woff2", weight: "600" },
    { path: "../../fonts/rajdhani-700.woff2", weight: "700" },
  ],
  variable: "--font-rajdhani",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "CMD Employee Gathering 2026", template: "%s · CMD Employee Gathering 2026" },
  description: "Mooniverse — CMD Employee Gathering 2026 by Cimory. Klaim tiket gratis khusus karyawan: satu NIK, satu tiket.",
  // PWA: bisa dipasang ke layar utama (Android: dialog "Pasang aplikasi"; iPhone: Bagikan → Tambah ke Layar Utama).
  manifest: "/app.webmanifest",
  icons: { icon: [{ url: "/icons/app-192.png", sizes: "192x192", type: "image/png" }], apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Mooniverse", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = { themeColor: "#020A17" };

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`theme-mooniverse relative flex min-h-dvh flex-col overflow-x-clip ${jakarta.variable} ${orbitron.variable} ${rajdhani.variable} ${quicksand.variable} ${marker.variable}`}>
      <a href="#konten" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-[#9afcff] focus:px-4 focus:py-2 focus:text-[#020a17]">
        Lewati ke konten
      </a>
      {/* Latar gradien + bintang statis di belakang seluruh halaman (tanpa animasi) */}
      <div aria-hidden className="mv-backdrop pointer-events-none fixed inset-0">
        <StarSky />
      </div>
      <SiteHeader />
      <main id="konten" className="relative z-10 flex-1">
        {children}
      </main>
      <SiteFooter />
      <HelpBubble />
      <RevealOnScroll />
      <PwaSetup />
      <Backsound />
    </div>
  );
}
