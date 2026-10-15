// Ornamen tema MOONIVERSE. Sengaja ringan: dekorasi statis, animasi hanya kepala maskot (transform).
import type { CSSProperties, ReactNode } from "react";
import { cx } from "@/components/ui";

const A = "/images/mooniverse";
const C = "/images/canva";
const B = "/images/brand";

/** Ukuran asli aset (untuk width/height agar tidak terjadi layout shift). */
export const ASSET = {
  // Aset brand terbaru (public/images/*.png → brand/*.webp)
  title: { src: `${B}/mooniverse-title-1200.webp`, w: 819, h: 338 },
  titleSm: { src: `${B}/mooniverse-title-640.webp`, w: 640, h: 264 },
  cowHead: { src: `${B}/kepala-sapi-320.webp`, w: 320, h: 241 },
  cowHeadSm: { src: `${B}/kepala-sapi-96.webp`, w: 96, h: 72 },
  cimory: { src: `${B}/cimory-320.webp`, w: 320, h: 171 },
  cimorySm: { src: `${B}/cimory-160.webp`, w: 160, h: 85 },
  gridFloor: { src: `${B}/grid-floor.webp`, w: 875, h: 197 },
  neonWave: { src: `${B}/neon-wave.webp`, w: 192, h: 153 },
  mascot: { src: `${A}/mascot.webp`, w: 410, h: 392 },
  mascotHead: { src: `${A}/mascot-head.webp`, w: 410, h: 392 },
  mascotBody: { src: `${A}/mascot-body.webp`, w: 410, h: 392 },
  logo: { src: `${A}/logo.webp`, w: 715, h: 280 },
  blimp: { src: `${A}/blimp.webp`, w: 380, h: 210 },
  cowRock: { src: `${A}/cow-rock.webp`, w: 215, h: 172 },
  cowWink: { src: `${A}/cow-wink.webp`, w: 195, h: 172 },
  cowLove: { src: `${A}/cow-love.webp`, w: 175, h: 172 },
  cowChill: { src: `${A}/cow-chill.webp`, w: 192, h: 172 },
  crown: { src: `${A}/crown.webp`, w: 118, h: 110 },
  heart: { src: `${A}/heart.webp`, w: 122, h: 115 },
  sparkle: { src: `${A}/sparkle.webp`, w: 86, h: 92 },
  bolt: { src: `${A}/bolt.webp`, w: 76, h: 104 },
  m: { src: `${A}/m.webp`, w: 118, h: 112 },
  towerMoo: { src: `${A}/tower-moo.webp`, w: 165, h: 515 },
  towerFood: { src: `${A}/tower-food.webp`, w: 172, h: 445 },
  stage: { src: `${A}/stage.webp`, w: 790, h: 352 },
  bannerBolt: { src: `${A}/banner-bolt.webp`, w: 352, h: 132 },
  bannerLogo: { src: `${A}/banner-logo.webp`, w: 352, h: 122 },
  crowd: { src: `${A}/crowd.webp`, w: 548, h: 178 },
  beams: { src: `${A}/beams.webp`, w: 590, h: 182 },
  // Elemen moodboard Canva (scripts/extract-canva.mjs)
  headBig: { src: `${C}/mascot-head-big.webp`, w: 455, h: 360 },
  cowLineLeft: { src: `${C}/cow-line-left.webp`, w: 314, h: 232 },
  cowLineRight: { src: `${C}/cow-line-right.webp`, w: 378, h: 316 },
  stickCyan: { src: `${C}/stick-cyan.webp`, w: 282, h: 154 },
  stickMagenta: { src: `${C}/stick-magenta.webp`, w: 270, h: 154 },
  crownNeon: { src: `${C}/crown-neon.webp`, w: 160, h: 128 },
  boltNeon: { src: `${C}/bolt-neon.webp`, w: 236, h: 240 },
  ledPanels: { src: `${C}/led-panels.webp`, w: 246, h: 308 },
} as const;

export type AssetKey = keyof typeof ASSET;

/** Gambar dari visual stock dengan dimensi asli. Dekoratif bila alt kosong. */
export function MvImg({ name, alt = "", className, style, eager = false, srcSet, sizes }: { name: AssetKey; alt?: string; className?: string; style?: CSSProperties; eager?: boolean; srcSet?: string; sizes?: string }) {
  const a = ASSET[name];
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={a.src}
      srcSet={srcSet}
      sizes={sizes}
      width={a.w}
      height={a.h}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      draggable={false}
      className={cx("select-none", className)}
      style={style}
    />
  );
}

/**
 * Maskot MOO yang hidup: badan diam, kepala bergoyang mengikuti irama (pivot di leher), dan
 * "headbang" saat di-hover/tap. Layer dibuat oleh scripts/split-mascot.mjs dari mascot.webp.
 */
export function MascotLive({ alt = "", className, eager = false }: { alt?: string; className?: string; eager?: boolean }) {
  return (
    <div className={cx("mv-mascot group relative", className)} role={alt ? "img" : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true}>
      <MvImg name="mascotBody" eager={eager} className="block h-auto w-full" />
      <MvImg name="mascotHead" eager={eager} className="mv-mascot-head absolute inset-0 h-auto w-full" />
    </div>
  );
}

/** Bintang empat sudut (SVG kecil, warna mengikuti currentColor). */
export function Sparkle({ className, filled = true }: { className?: string; filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={cx("inline-block", className)} aria-hidden>
      <path d="M12 0 C13 7 17 11 24 12 C17 13 13 17 12 24 C11 17 7 13 0 12 C7 11 11 7 12 0 Z" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={filled ? 0 : 1.2} />
    </svg>
  );
}

/** Latar bintang statis (tanpa animasi, demi ringan di HP). */
export function StarSky({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cx("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <div className="mv-stars" />
    </div>
  );
}

/** Lantai grid neon perspektif (gambar statis vistock1). */
export function GridFloor({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cx("pointer-events-none absolute inset-x-0 bottom-0 flex justify-center overflow-hidden", className)}>
      <MvImg name="gridFloor" className="h-full w-full max-w-none object-cover object-top opacity-80" />
    </div>
  );
}

/** Sinar laser — dinonaktifkan agar halaman ringan (ekspor dipertahankan untuk kompatibilitas). */
export function Lasers(_props: { className?: string }) {
  return null;
}

/** Pembatas section: garis neon dengan ikon di tengah. */
export function NeonBand({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cx("relative flex h-10 items-center justify-center", className)}>
      <span className="absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-[#f714f7] to-transparent shadow-[0_0_10px_#f714f7]" />
      <span className="absolute inset-x-[20%] top-[calc(50%+4px)] h-px bg-gradient-to-r from-transparent via-[#9afcff] to-transparent opacity-80" />
      <MvImg name="crown" className="relative h-8 w-auto drop-shadow-[0_0_10px_rgba(255,255,255,0.6)]" />
    </div>
  );
}

/** Pita tagline statis (tanpa animasi berjalan). */
export function Marquee({ className }: { className?: string }) {
  return (
    <div className={cx("relative border-y border-[#9afcff]/25 bg-[#01030c]/80 py-3 text-center", className)}>
      <p className="mv-neon px-4 text-sm font-semibold sm:text-base">Good Food Good Mood · 1 NIK · 1 Tiket</p>
    </div>
  );
}

/** Judul section: tulisan tabung neon putih (gaya moodboard) dengan garis siku & aksen. */
export function FrameTitle({ children, sub, as: Tag = "h2", className, icon = "crownNeon" }: { children: ReactNode; sub?: ReactNode; as?: "h1" | "h2"; className?: string; icon?: AssetKey | null }) {
  return (
    <div className={cx("mv-reveal relative mx-auto w-fit max-w-full px-2 text-center", className)}>
      {icon && <MvImg name={icon} className="pointer-events-none mx-auto mb-1 h-10 w-auto drop-shadow-[0_0_10px_rgba(255,255,255,0.55)]" />}
      <Tag className="mv-title text-2xl leading-tight sm:text-4xl">{children}</Tag>
      <div aria-hidden className="mx-auto mt-3 w-[min(280px,70vw)] mv-tube-rule" />
      {sub && <p className="font-hud mt-3 text-base font-semibold tracking-wide text-[#e3edfa] sm:text-lg">{sub}</p>}
    </div>
  );
}

/** Judul halaman (untuk halaman selain beranda): judul tabung neon di atas tekstur laser. */
export function PageHero({ title, subtitle, children }: { title: ReactNode; subtitle?: ReactNode; children?: ReactNode }) {
  return (
    <div className="relative px-4 pb-6 pt-10 text-center sm:pt-12">
      <MvImg name="crownNeon" className="relative mx-auto mb-2 h-9 w-auto drop-shadow-[0_0_10px_rgba(255,255,255,0.55)]" />
      <h1 className="relative text-2xl leading-tight sm:text-4xl">{title}</h1>
      <div aria-hidden className="relative mx-auto mt-3 w-[min(240px,60vw)] mv-tube-rule" />
      {subtitle && <div className="font-hud relative mx-auto mt-3 max-w-2xl text-lg font-semibold text-[#e3edfa]">{subtitle}</div>}
      {children}
    </div>
  );
}

/** Stiker maskot + pesan (untuk empty state, ruang tunggu, hasil klaim). */
export function StickerNote({ sticker = "cowChill", title, children, action, className }: { sticker?: AssetKey; title: ReactNode; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cx("mv-card relative flex flex-col items-center gap-3 overflow-hidden px-6 py-10 text-center", className)}>
      <MvImg name={sticker} className="relative h-32 w-auto" />
      <p className="mv-neon relative text-lg">{title}</p>
      {children && <div className="relative max-w-md text-[#d3e2f5]">{children}</div>}
      {action && <div className="relative">{action}</div>}
    </div>
  );
}

/** Light stick — dinonaktifkan agar halaman ringan (ekspor dipertahankan). */
export function LightStick(_props: { color: "cyan" | "magenta"; className?: string }) {
  return null;
}

/** Sapi garis neon (dekorasi statis). */
export function LineCow({ side, className }: { side: "left" | "right"; className?: string }) {
  return <MvImg name={side === "left" ? "cowLineLeft" : "cowLineRight"} className={cx("pointer-events-none h-auto", className)} />;
}

/** Tagline kuas "MOO BRINGS US TOGETHER". */
export function BrushTagline({ children = "Moo Brings Us Together", className }: { children?: ReactNode; className?: string }) {
  // span (bukan p): sering dipakai di dalam <p> subjudul FrameTitle — p di dalam p merusak hydration.
  return <span className={cx("mv-brush block text-2xl sm:text-4xl", className)}>{children}</span>;
}
