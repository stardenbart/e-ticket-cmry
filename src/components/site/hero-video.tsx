"use client";

// Latar hero beranimasi (dari bg_landing_page.gif, dikonversi ke MP4: ±0,36 MB vs 4 MB GIF).
// `muted` di-set lewat JS karena React tidak selalu merender atribut muted saat SSR, padahal
// autoplay hanya diizinkan untuk video tanpa suara. "Kurangi animasi" → hanya gambar diam.
import { useEffect, useRef } from "react";

export function HeroVideo({ className }: { className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = true;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      v.pause();
      return;
    }
    // Percobaan pertama bisa kalah balapan dengan pemuatan halaman → ulangi saat video siap diputar.
    const tryPlay = () => {
      if (v.paused) v.play().catch(() => {});
    };
    tryPlay();
    v.addEventListener("canplay", tryPlay);
    v.addEventListener("loadeddata", tryPlay);
    return () => {
      v.removeEventListener("canplay", tryPlay);
      v.removeEventListener("loadeddata", tryPlay);
    };
  }, []);
  return (
    <video
      ref={ref}
      src="/media/bg-landing.mp4"
      poster="/media/bg-landing-poster.webp"
      muted
      autoPlay
      loop
      playsInline
      preload="auto"
      disablePictureInPicture
      aria-hidden
      tabIndex={-1}
      className={className}
    />
  );
}
