import Link from "next/link";
import { GridFloor, MvImg, Sparkle } from "./ornaments";
import { BoxCountdown } from "./countdown";

export type HeroSlide = {
  slug: string;
  name: string;
  banner: string | null;
  date: string;
  place: string;
  badge: string;
  /** Countdown fase pemesanan: menuju dibuka, menuju ditutup, atau sudah ditutup (target null). */
  countdown?: { label: string; target: string | null } | null;
};

/**
 * Hero event utama (satu event → tanpa carousel). Sengaja ringan: foto panggung responsif
 * (900 px di HP), lantai grid statis, dan satu-satunya animasi = kepala maskot (desktop).
 */
export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const s = slides[0];
  return (
    <section aria-label="Event utama" className="relative -mt-20 overflow-hidden">
      {/* Latar hero memudar ke transparan di bagian bawah → menyatu halus dengan latar halaman (tanpa garis batas). */}
      <div aria-hidden className="mv-hero-fade pointer-events-none absolute inset-0">
        <picture>
          <source media="(min-width: 900px)" srcSet="/images/mooniverse/stage-hero-1600.webp" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/mooniverse/stage-hero-900.webp"
            alt=""
            aria-hidden
            width={1600}
            height={1067}
            fetchPriority="high"
            decoding="async"
            className="absolute inset-0 size-full object-cover object-[50%_18%] md:object-[50%_30%]"
          />
        </picture>
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,10,23,0.7)_0%,rgba(2,10,23,0.55)_35%,rgba(2,10,23,0.75)_70%,rgba(2,10,23,0.6)_100%)]" />
        <GridFloor className="h-24 opacity-70 sm:h-32" />
      </div>

      <div className="relative mx-auto flex min-h-[600px] max-w-5xl flex-col items-center px-4 pb-24 pt-20 text-center sm:min-h-[700px] sm:pb-32 sm:pt-20">
        <div className="flex animate-fade-up flex-col items-center">
          <div className="flex items-center justify-center lg:gap-4">
            <h1 className="m-0">
              <span className="sr-only">CMD Employee Gathering 2026 — Mooniverse</span>
              <MvImg
                name="title"
                eager
                srcSet="/images/brand/mooniverse-title-640.webp 640w, /images/brand/mooniverse-title-1200.webp 819w"
                sizes="(min-width: 768px) 600px, 90vw"
                className="h-auto w-[min(90vw,600px,62svh)]"
              />
            </h1>
            {/* Maskot hidup di samping judul (desktop saja; lazy → tidak diunduh di HP karena tersembunyi) */}
          </div>

          {s && (
            <>
              <p className="font-hud mt-4 inline-flex items-center gap-2 rounded-full bg-[#f714f7]/15 px-3 py-1 text-sm font-bold uppercase tracking-[0.2em] text-white ring-1 ring-[#f714f7]/60">
                <Sparkle className="size-3 text-[#f714f7]" /> {s.badge}
              </p>
              <p className="font-hud mt-3 text-lg font-semibold tracking-wide text-white sm:text-xl">
                {s.date} <span className="mx-1 text-[#f714f7]">✦</span> {s.place}
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="#tiket"
                  className="font-hud inline-flex h-12 items-center gap-2 rounded-full bg-[linear-gradient(100deg,#f714f7,#9b2cf5_50%,#0827b5)] px-7 text-lg font-bold uppercase tracking-[0.12em] text-white shadow-[0_0_18px_rgba(247,20,247,0.5)] transition hover:brightness-110"
                >
                  Klaim Tiket
                </Link>
                <Link
                  href={`/event/${s.slug}`}
                  className="font-hud inline-flex h-12 items-center rounded-full border-2 border-[#9afcff] bg-[#020a17]/70 px-6 text-lg font-bold uppercase tracking-[0.12em] text-[#9afcff] transition hover:bg-[#9afcff]/15"
                >
                  Detail Acara
                </Link>
              </div>
            </>
          )}
        </div>

        {s?.countdown && (
          <div className="mt-6">
            <h2 className="font-hud text-base font-bold uppercase tracking-[0.3em] text-[#9afcff] sm:text-lg">{s.countdown.label}</h2>
            {s.countdown.target ? (
              <BoxCountdown target={s.countdown.target} className="mt-4 justify-center" />
            ) : (
              <p className="mt-3 text-[#dbe4ff]">Terima kasih atas antusiasmenya. Sampai jumpa di acara!</p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
