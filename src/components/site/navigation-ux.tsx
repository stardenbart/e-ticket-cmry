"use client";

// Perilaku navigasi situs peserta:
//  - ScrollReset: halaman baru selalu dibuka dari atas. Bawaan Next.js mempertahankan posisi scroll
//    selama halaman baru "terlihat" di viewport — dengan header sticky + hero, itu hampir selalu terjadi.
//    Tombol Back/Forward tetap memulihkan posisi lama (ditangani browser), dan link ke #anchor tidak diganggu.
//  - LogoutNotice: setelah keluar, tampilkan konfirmasi "Anda sudah keluar" (dipicu ?keluar=1).
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

export function ScrollReset() {
  const pathname = usePathname();
  const first = useRef(true);
  const historyNav = useRef(false);

  useEffect(() => {
    const onPop = () => {
      historyNav.current = true;
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (historyNav.current) {
      historyNav.current = false;
      return;
    }
    const hash = window.location.hash.slice(1);
    if (hash) {
      // Link ke #anchor (mis. kembali ke panel tiket setelah login): gulir setelah konten halaman tergambar.
      const go = () => document.getElementById(decodeURIComponent(hash))?.scrollIntoView({ block: "start" });
      requestAnimationFrame(go);
      const t = setTimeout(go, 400);
      return () => clearTimeout(t);
    }
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);

  return null;
}

export const LOGOUT_PARAM = "keluar";

export function LogoutNotice() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get(LOGOUT_PARAM) !== "1") return;
    setShow(true);
    // Bersihkan URL agar notifikasi tidak muncul lagi saat halaman dimuat ulang.
    url.searchParams.delete(LOGOUT_PARAM);
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    const t = setTimeout(() => setShow(false), 5000);
    return () => clearTimeout(t);
  }, []);

  if (!show) return null;
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 top-20 z-50 flex justify-center px-4">
      <div className="pointer-events-auto flex max-w-md animate-fade-up items-center gap-3 rounded-2xl border border-[#9afcff]/50 bg-[#031726]/95 px-4 py-3 text-white shadow-[0_0_24px_rgba(154,252,255,0.35)] backdrop-blur">
        <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-[#9afcff] text-sm font-black text-[#020a17]">
          ✓
        </span>
        <div className="min-w-0">
          <p className="font-bold">Anda sudah keluar</p>
          <p className="text-sm text-[#cbd5e1]">Sampai jumpa! Masuk lagi kapan saja untuk melihat tiket Anda.</p>
        </div>
        <button type="button" onClick={() => setShow(false)} aria-label="Tutup" className="grid size-8 shrink-0 place-items-center rounded-full text-[#cbd5e1] hover:bg-white/10">
          ✕
        </button>
      </div>
    </div>
  );
}
