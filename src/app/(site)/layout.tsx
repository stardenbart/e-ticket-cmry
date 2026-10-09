import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "@/components/site/site.css";
import "@/components/site/theme.css";
import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { StarSky } from "@/components/site/ornaments";
import { HelpBubble, RevealOnScroll } from "@/components/site/site-chrome";

// Font di-host sendiri (next/font/local): build tidak bergantung pada akses ke Google Fonts.
const jakarta = localFont({ src: "../../fonts/plus-jakarta-sans-400-800.woff2", weight: "400 800", variable: "--font-jakarta", display: "swap" });
const orbitron = localFont({ src: "../../fonts/orbitron-500-900.woff2", weight: "500 900", variable: "--font-orbitron", display: "swap" });
const rajdhani = localFont({
  src: [
    { path: "../../fonts/rajdhani-500.woff2", weight: "500" },
    { path: "../../fonts/rajdhani-600.woff2", weight: "600" },
    { path: "../../fonts/rajdhani-700.woff2", weight: "700" },
  ],
  variable: "--font-rajdhani",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Mooniverse 2026 · by Cimory", template: "%s · Mooniverse" },
  description: "Mooniverse by Cimory — Good Food Good Mood. Klaim tiket gratis: satu akun, satu tiket, atas nama sendiri.",
};

export const viewport: Viewport = { themeColor: "#05061A" };

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`theme-mooniverse relative flex min-h-dvh flex-col overflow-x-clip ${jakarta.variable} ${orbitron.variable} ${rajdhani.variable}`}>
      <a href="#konten" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-[#22e5ff] focus:px-4 focus:py-2 focus:text-[#05061a]">
        Lewati ke konten
      </a>
      {/* Langit berbintang + scanline menetap di belakang seluruh halaman */}
      <div aria-hidden className="pointer-events-none fixed inset-0">
        <StarSky />
      </div>
      <SiteHeader />
      <main id="konten" className="relative z-10 flex-1">
        {children}
      </main>
      <SiteFooter />
      <HelpBubble />
      <RevealOnScroll />
    </div>
  );
}
