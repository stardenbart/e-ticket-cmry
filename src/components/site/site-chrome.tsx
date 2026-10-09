"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { cx } from "@/components/ui";

const NAV = [
  { href: "/", label: "Beranda", match: (p: string) => p === "/" },
  { href: "/event", label: "Jelajah Event", match: (p: string) => p.startsWith("/event") },
  { href: "/tiket-saya", label: "Tiket Saya", match: (p: string) => p.startsWith("/tiket-saya") },
  { href: "/faq", label: "FAQ", match: (p: string) => p.startsWith("/faq") },
];

/** Navigasi pil kaca; item aktif berupa pil putih. */
export function PillNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Navigasi utama" className="hidden items-center gap-1 rounded-full border border-[#22e5ff]/40 bg-white/[0.07] p-1 shadow-[0_0_24px_rgba(34,229,255,0.18),inset_0_0_12px_rgba(255,43,214,0.12)] backdrop-blur-md md:flex">
      {NAV.map((n) => {
        const active = n.match(pathname);
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "font-hud rounded-full px-4 py-1.5 text-[15px] font-bold uppercase tracking-[0.08em] transition",
              active ? "bg-[#ffffff] text-[#1b0b4d] shadow-[0_0_14px_rgba(255,255,255,0.55)]" : "text-white hover:bg-white/10 hover:text-[#22e5ff]",
            )}
          >
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Tandai header saat halaman sudah di-scroll (warna teks nav menyesuaikan latar). */
export function ScrollFlag() {
  useEffect(() => {
    const el = document.documentElement;
    const on = () => el.classList.toggle("mv-scrolled", window.scrollY > 120);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => {
      window.removeEventListener("scroll", on);
      el.classList.remove("mv-scrolled");
    };
  }, []);
  return null;
}

/**
 * Munculkan elemen .mv-reveal saat masuk viewport.
 * Elemen hanya disembunyikan setelah skrip aktif (html.mv-js), jadi konten tetap tampil bila JS gagal.
 */
export function RevealOnScroll() {
  const pathname = usePathname();
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("mv-js");
    let raf = 0;
    const check = () => {
      raf = 0;
      const limit = window.innerHeight * 0.95;
      document.querySelectorAll<HTMLElement>(".mv-reveal:not(.is-visible)").forEach((el) => {
        if (el.getBoundingClientRect().top < limit) el.classList.add("is-visible");
      });
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(check);
    };
    check();
    // Konten yang dirender belakangan (navigasi klien) ikut diperiksa.
    const mo = new MutationObserver(onScroll);
    mo.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      mo.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [pathname]);
  return null;
}

/** Tombol bulat mengambang ke halaman bantuan. */
export function HelpBubble() {
  const pathname = usePathname();
  if (pathname.startsWith("/faq") || pathname.startsWith("/antrean") || pathname.startsWith("/konfirmasi")) return null;
  return (
    <Link
      href="/faq"
      aria-label="Bantuan & FAQ"
      className={`fixed bottom-5 right-5 z-30 grid size-14 place-items-center rounded-full bg-gradient-to-br from-[#ff2bd6] to-[#2d6bff] text-white shadow-[0_0_24px_rgba(255,43,214,0.6)] ring-2 ring-white/40 transition hover:scale-105 ${pathname.startsWith("/event/") ? "max-lg:bottom-24" : ""}`}
    >
      <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M21 12a8 8 0 0 1-8 8H7l-4 3V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8z" />
      </svg>
      <span className="absolute right-1 top-1 size-3 rounded-full border-2 border-[#2d6bff] bg-[#22e5ff]" />
    </Link>
  );
}
