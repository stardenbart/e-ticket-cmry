"use client";

// Maskot MOO beranimasi (video loop tanpa suara). Latar video hitam dibaurkan ke halaman dengan
// mix-blend-mode: screen + tepi dipudarkan, jadi karakter seolah berdiri langsung di halaman.
// Ringan: video baru diunduh saat terlihat di layar, dijeda saat keluar layar, dan
// pengguna dengan "kurangi animasi" hanya melihat gambar diam (poster).
import { useEffect, useRef } from "react";
import { cx } from "@/components/ui";

const SRC = "/media/mascot-540.mp4";
const POSTER = "/media/mascot-poster.webp";

export function MascotVideo({ alt = "", className }: { alt?: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (!v.src) v.src = SRC;
          v.play().catch(() => {});
        } else {
          v.pause();
        }
      },
      { rootMargin: "120px" },
    );
    io.observe(v);
    return () => io.disconnect();
  }, []);

  return (
    <div className={cx("mv-mascot-video relative aspect-square", className)} role={alt ? "img" : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true}>
      <video ref={ref} poster={POSTER} muted loop playsInline preload="none" disablePictureInPicture className="size-full object-cover" />
    </div>
  );
}
