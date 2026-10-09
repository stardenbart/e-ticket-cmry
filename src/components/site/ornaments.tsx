// Ornamen tema MOONIVERSE: lantai grid, laser, marquee, bingkai HUD, aset visual stock.
import type { CSSProperties, ReactNode } from "react";
import { cx } from "@/components/ui";

const A = "/images/mooniverse";

/** Ukuran asli aset (untuk width/height agar tidak terjadi layout shift). */
export const ASSET = {
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
} as const;

export type AssetKey = keyof typeof ASSET;

/** Gambar dari visual stock dengan dimensi asli. Dekoratif bila alt kosong. */
export function MvImg({ name, alt = "", className, style, eager = false }: { name: AssetKey; alt?: string; className?: string; style?: CSSProperties; eager?: boolean }) {
  const a = ASSET[name];
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={a.src}
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

/** Latar bintang berkedip + scanline. */
export function StarSky({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cx("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <div className="mv-stars" />
      <div className="mv-stars-2" />
      <div className="mv-scanlines" />
    </div>
  );
}

/** Lantai grid neon perspektif. */
export function GridFloor({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cx("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <div className="mv-grid-floor" />
    </div>
  );
}

/** Beberapa sinar laser yang menyapu dari bawah. */
export function Lasers({ className }: { className?: string }) {
  const beams: { left: string; c: "pink" | "cyan"; from: string; to: string; delay: string }[] = [
    { left: "8%", c: "cyan", from: "-30deg", to: "-8deg", delay: "0s" },
    { left: "22%", c: "pink", from: "-18deg", to: "12deg", delay: "-2s" },
    { left: "78%", c: "pink", from: "10deg", to: "-16deg", delay: "-1s" },
    { left: "92%", c: "cyan", from: "28deg", to: "6deg", delay: "-3s" },
  ];
  return (
    <div aria-hidden className={cx("pointer-events-none absolute inset-0 overflow-hidden opacity-70", className)}>
      {beams.map((b, i) => (
        <span key={i} className={cx("mv-laser", b.c)} style={{ left: b.left, "--from": b.from, "--to": b.to, animationDelay: b.delay } as CSSProperties} />
      ))}
    </div>
  );
}

/** Pembatas section: garis neon dengan ikon di tengah. */
export function NeonBand({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cx("relative flex h-10 items-center justify-center", className)}>
      <span className="absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-[#ff2bd6] to-transparent shadow-[0_0_10px_#ff2bd6]" />
      <span className="absolute inset-x-[20%] top-[calc(50%+4px)] h-px bg-gradient-to-r from-transparent via-[#22e5ff] to-transparent opacity-80" />
      <MvImg name="crown" className="relative h-8 w-auto drop-shadow-[0_0_10px_rgba(255,255,255,0.6)]" />
    </div>
  );
}

/** Pita teks berjalan "GOOD FOOD GOOD MOOD · MOO BRINGS US TOGETHER". */
export function Marquee({ className }: { className?: string }) {
  const items = ["GOOD FOOD GOOD MOOD", "MOO BRINGS US TOGETHER", "MOONIVERSE 2026", "1 AKUN · 1 TIKET"];
  const row = (
    <div className="flex shrink-0 items-center">
      {items.map((t, i) => (
        <span key={t} className="flex items-center">
          <span className={cx("font-display px-6 text-lg font-black tracking-[0.12em] sm:text-2xl", i % 2 ? "text-[#22e5ff] mv-glow-cyan" : "text-[#ff2bd6] mv-glow")}>{t}</span>
          <MvImg name={i % 2 ? "heart" : "bolt"} className="h-7 w-auto sm:h-8" />
        </span>
      ))}
    </div>
  );
  return (
    <div className={cx("relative overflow-hidden border-y border-[#ff2bd6]/50 bg-[#07081f]/90 py-3 shadow-[0_0_24px_rgba(255,43,214,0.25)]", className)} aria-label="Good Food Good Mood — Moo Brings Us Together">
      <div className="mv-marquee-track" aria-hidden>
        {row}
        {row}
      </div>
    </div>
  );
}

/** Judul section di dalam bingkai HUD bersudut potong. */
export function FrameTitle({ children, sub, as: Tag = "h2", className, icon = "crown" }: { children: ReactNode; sub?: ReactNode; as?: "h1" | "h2"; className?: string; icon?: AssetKey | null }) {
  return (
    <div className={cx("mv-reveal mv-halo relative mx-auto w-fit max-w-full", className)}>
      <div className="mv-frame px-8 py-4 text-center sm:px-14 sm:py-5">
        {icon && <MvImg name={icon} className="pointer-events-none absolute -top-5 left-1/2 h-9 w-auto -translate-x-1/2 drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" />}
        <Tag className="mv-title text-xl font-extrabold leading-tight text-white sm:text-3xl">{children}</Tag>
        {sub && <p className="font-hud mt-1 text-base font-semibold tracking-wide text-[#dbe4ff] sm:text-lg">{sub}</p>}
        <span aria-hidden className="absolute bottom-1.5 left-6 flex gap-1">
          {[0, 1, 2].map((k) => <span key={k} className="h-1 w-3 -skew-x-[30deg] bg-[#22e5ff]/80" />)}
        </span>
      </div>
    </div>
  );
}

/** Judul halaman (untuk halaman selain beranda). */
export function PageHero({ title, subtitle, children }: { title: ReactNode; subtitle?: ReactNode; children?: ReactNode }) {
  return (
    <div className="relative px-4 pb-6 pt-8 text-center sm:pt-10">
      <p className="mv-divider mb-3 text-xs"><Sparkle className="size-3.5" /></p>
      <h1 className="text-2xl leading-tight sm:text-4xl">{title}</h1>
      {subtitle && <div className="font-hud mx-auto mt-3 max-w-2xl text-lg font-medium text-[#dbe4ff]">{subtitle}</div>}
      {children}
    </div>
  );
}

/** Stiker maskot + pesan (untuk empty state, ruang tunggu, hasil klaim). */
export function StickerNote({ sticker = "cowChill", title, children, action, className }: { sticker?: AssetKey; title: ReactNode; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cx("mv-card flex flex-col items-center gap-3 px-6 py-10 text-center", className)}>
      <MvImg name={sticker} className="mv-float h-32 w-auto drop-shadow-[0_0_18px_rgba(232,28,255,0.45)]" />
      <p className="font-display text-lg font-bold uppercase tracking-wider text-white">{title}</p>
      {children && <div className="max-w-md text-[#c9d3ff]">{children}</div>}
      {action}
    </div>
  );
}
