"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { cx } from "@/components/ui";
import { GridFloor, Lasers, MvImg, Sparkle } from "./ornaments";
import { BoxCountdown } from "./countdown";

export type HeroSlide = {
  slug: string;
  name: string;
  banner: string | null;
  date: string;
  place: string;
  badge: string;
  /** Countdown di bawah judul: pembukaan berikutnya / penutupan pemesanan. */
  countdown?: { label: string; target: string } | null;
};

const isMooniverse = (slug: string) => slug.startsWith("mooniverse");

/** Hero panggung MOONIVERSE: foto panggung full-bleed, logo neon, countdown, blimp, laser, kerumunan. */
export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = slides.length;
  const go = useCallback((k: number) => setI(((k % n) + n) % n), [n]);

  useEffect(() => {
    if (paused || n < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setI((x) => (x + 1) % n), 8000);
    return () => clearInterval(id);
  }, [paused, n]);

  const s = slides[i];
  const brand = !s || isMooniverse(s.slug);

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Event unggulan"
      className="relative -mt-20 overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {/* Foto panggung (mobile: crop potret ke maskot) */}
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
          className="absolute inset-0 size-full object-cover object-[50%_18%] md:object-[50%_30%]"
        />
      </picture>
      <div aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,6,26,0.55)_0%,rgba(5,6,26,0.35)_30%,rgba(5,6,26,0.78)_68%,#05061a_100%)]" />
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,transparent_30%,rgba(5,6,26,0.7)_100%)]" />
      <GridFloor className="top-auto h-[38%] opacity-60" />
      <Lasers />
      <div aria-hidden className="mv-scanlines" />

      {/* Blimp MOO melayang */}
      <div aria-hidden className="mv-drift pointer-events-none absolute left-[1%] top-[64px] hidden w-[220px] md:block lg:w-[270px]">
        <MvImg name="blimp" eager className="mv-float-slow h-auto w-full drop-shadow-[0_0_20px_rgba(255,43,214,0.55)]" />
      </div>

      <div className="relative mx-auto flex min-h-[640px] max-w-5xl flex-col items-center px-4 pb-44 pt-28 text-center sm:min-h-[760px] sm:pb-52 sm:pt-32">
        {n === 0 ? (
          <h1 className="sr-only">Mooniverse 2026</h1>
        ) : null}
        <div key={s?.slug ?? "brand"} className="flex animate-fade-up flex-col items-center">
          <p className="font-hud inline-flex items-center gap-2 rounded-full border border-[#22e5ff]/60 bg-[#05061a]/70 px-4 py-1.5 text-sm font-bold uppercase tracking-[0.24em] text-[#22e5ff] shadow-[0_0_16px_rgba(34,229,255,0.35)] backdrop-blur">
            <Sparkle className="size-3 text-[#ff2bd6]" /> {s && !brand ? s.badge : "Mooniverse 2026 · by Cimory"}
          </p>

          {brand ? (
            <h1 className="mt-4">
              <span className="sr-only">{s?.name ?? "Mooniverse 2026"}</span>
              <MvImg
                name="logo"
                eager
                className="mv-flicker h-auto w-[min(88vw,620px)] drop-shadow-[0_0_24px_rgba(255,43,214,0.55)]"
              />
            </h1>
          ) : (
            <h1 className="mx-auto mt-6 max-w-4xl text-3xl leading-tight sm:text-6xl">{s.name}</h1>
          )}

          {s && (
            <>
              {brand && (
                <p className="font-hud mt-1 rounded-sm bg-[#ff2bd6]/15 px-3 py-0.5 text-base font-bold uppercase tracking-[0.2em] text-white ring-1 ring-[#ff2bd6]/60">
                  ● {s.badge}
                </p>
              )}
              <p className="font-hud mt-4 text-lg font-semibold tracking-wide text-white sm:text-xl">
                {s.date} <span className="mx-1 text-[#ff2bd6]">✦</span> {s.place}
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href={`/event/${s.slug}`}
                  className="font-hud inline-flex h-12 items-center gap-2 rounded-full bg-[linear-gradient(100deg,#ff2bd6,#b026ff_50%,#2d6bff)] px-7 text-lg font-bold uppercase tracking-[0.12em] text-white shadow-[0_0_24px_rgba(255,43,214,0.65),inset_0_0_0_1px_rgba(255,255,255,0.35)] transition hover:brightness-115"
                >
                  <MvImg name="bolt" className="h-6 w-auto" /> Klaim Tiket
                </Link>
                <Link
                  href="/event"
                  className="font-hud inline-flex h-12 items-center rounded-full border-2 border-[#22e5ff] bg-[#05061a]/60 px-6 text-lg font-bold uppercase tracking-[0.12em] text-[#22e5ff] shadow-[0_0_16px_rgba(34,229,255,0.4)] backdrop-blur transition hover:bg-[#22e5ff]/15"
                >
                  Jelajah Event
                </Link>
              </div>
            </>
          )}
        </div>

        {s?.countdown && (
          <div className="mt-9">
            <h2 className="font-hud text-base font-bold uppercase tracking-[0.3em] text-[#22e5ff] mv-glow-cyan sm:text-lg">{s.countdown.label}</h2>
            <BoxCountdown target={s.countdown.target} className="mt-4 justify-center" />
          </div>
        )}

        {n > 1 && (
          <div className="mt-8 flex items-center justify-center gap-2">
            <button type="button" onClick={() => go(i - 1)} aria-label="Event sebelumnya" className="grid size-11 place-items-center rounded-full border border-[#22e5ff]/50 bg-[#05061a]/60 text-[#22e5ff] hover:bg-[#22e5ff]/15">‹</button>
            {slides.map((sl, k) => (
              <button key={sl.slug} type="button" onClick={() => go(k)} aria-label={`Tampilkan ${sl.name}`} aria-current={k === i} className="grid size-11 place-items-center">
                {k === i ? (
                  <Sparkle className="size-6 text-[#ff2bd6] drop-shadow-[0_0_8px_rgba(255,43,214,0.95)]" />
                ) : (
                  <span className="size-2.5 rounded-full bg-[#22e5ff]/60 transition hover:bg-[#22e5ff]" />
                )}
              </button>
            ))}
            <button type="button" onClick={() => go(i + 1)} aria-label="Event berikutnya" className="grid size-11 place-items-center rounded-full border border-[#22e5ff]/50 bg-[#05061a]/60 text-[#22e5ff] hover:bg-[#22e5ff]/15">›</button>
            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              aria-label={paused ? "Putar otomatis" : "Jeda putar otomatis"}
              className={cx("grid size-11 place-items-center rounded-full text-xs text-[#dbe4ff] hover:bg-white/10")}
            >
              {paused ? "▶" : "❚❚"}
            </button>
          </div>
        )}
      </div>

      {/* Kerumunan dengan light stick di tepi bawah */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 flex h-28 justify-center overflow-hidden sm:h-40">
        {[0, 1, 2, 3].map((k) => (
          <MvImg key={k} name="crowd" eager className={cx("h-full w-auto max-w-none", k > 1 && "hidden lg:block", k === 1 && "hidden sm:block")} />
        ))}
        <span className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#05061a] to-transparent" />
      </div>
    </section>
  );
}
