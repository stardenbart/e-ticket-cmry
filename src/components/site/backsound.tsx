"use client";

// Musik latar situs peserta. Browser umumnya memblokir audio bersuara sebelum ada interaksi,
// jadi: coba putar saat halaman dibuka; bila diblokir, mulai pada sentuhan/klik/tombol pertama.
// Tombol speaker mematikan/menyalakan musik dan pilihannya diingat di browser ini.
// Komponen ini ada di layout (site) sehingga musik tidak terputus saat pindah halaman.
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const SRC = "/media/backsound-128k.mp3";
const OFF_KEY = "bgm-off";
const VOLUME = 0.35;

function readOff() {
  try {
    return localStorage.getItem(OFF_KEY) === "1";
  } catch {
    return false;
  }
}

export function Backsound() {
  const ref = useRef<HTMLAudioElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const muted = useRef(false); // true setelah pengguna mematikan musik
  const [playing, setPlaying] = useState(false);
  const [off, setOff] = useState(true); // diisi dari localStorage setelah mount
  const pathname = usePathname();

  useEffect(() => {
    const a = ref.current;
    if (!a) return;
    a.volume = VOLUME;
    const userOff = readOff();
    setOff(userOff);
    if (userOff) return;

    const start = (e?: Event) => {
      // Sentuhan pertama pada tombol speaker ditangani oleh toggle(), bukan di sini.
      if (muted.current || (e && btn.current?.contains(e.target as Node))) return;
      a.play().then(
        () => cleanup(),
        () => {},
      );
    };
    const events = ["pointerdown", "keydown", "touchstart"] as const;
    const cleanup = () => events.forEach((e) => window.removeEventListener(e, start));
    events.forEach((e) => window.addEventListener(e, start, { passive: true }));
    start();
    return cleanup;
  }, []);

  // Jeda saat tab/aplikasi disembunyikan, lanjut saat kembali.
  useEffect(() => {
    const a = ref.current;
    if (!a) return;
    let resume = false;
    const onVis = () => {
      if (document.hidden) {
        resume = !a.paused;
        a.pause();
      } else if (resume) {
        a.play().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  function toggle() {
    const a = ref.current;
    if (!a) return;
    if (a.paused) {
      muted.current = false;
      a.play().catch(() => {});
      setOff(false);
      try {
        localStorage.removeItem(OFF_KEY);
      } catch {}
    } else {
      muted.current = true;
      a.pause();
      setOff(true);
      try {
        localStorage.setItem(OFF_KEY, "1");
      } catch {}
    }
  }

  // Di beranda & halaman event (HP) ada bar "Pilih Tiket" di bawah: tombol dinaikkan.
  const lifted = pathname === "/" || pathname.startsWith("/event/");

  return (
    <>
      <audio ref={ref} src={SRC} loop preload="none" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} />
      <button
        ref={btn}
        type="button"
        onClick={toggle}
        aria-pressed={playing}
        aria-label={playing ? "Matikan musik" : "Putar musik"}
        title={playing ? "Matikan musik" : "Putar musik"}
        className={`fixed bottom-5 left-4 z-30 grid size-11 place-items-center rounded-full border border-[#9afcff]/50 bg-[#031726]/90 text-[#9afcff] shadow-[0_0_16px_rgba(154,252,255,0.35)] backdrop-blur transition hover:scale-105 ${lifted ? "max-lg:bottom-24" : ""}`}
      >
        {playing ? (
          <span aria-hidden className="mv-eq flex h-4 items-end gap-[3px]">
            <i />
            <i />
            <i />
            <i />
          </span>
        ) : (
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M11 5 6 9H3v6h3l5 4V5z" />
            {off ? <path d="m16 9 5 6m0-6-5 6" /> : <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />}
          </svg>
        )}
      </button>
    </>
  );
}
