"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { cx } from "@/components/ui";
import { GridFloor, Lasers, LightStick, MascotLive, MvImg, Sparkle } from "./ornaments";
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
      <div aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,10,23,0.55)_0%,rgba(2,10,23,0.35)_30%,rgba(2,10,23,0.78)_68%,#020a17_100%)]" />
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,transparent_30%,rgba(2,10,23,0.7)_100%)]" />
      {/* Tekstur laser (moodboard) di bagian atas hero */}
      <div aria-hidden className="mv-texture mv-texture-lasers mv-texture-top inset-x-0 top-0 h-[60%] opacity-70" />
      <GridFloor className="top-auto h-[38%] opacity-60" />
      <LightStick color="magenta" className="absolute bottom-40 left-[4%] hidden w-40 md:block" />
      <LightStick color="cyan" className="absolute bottom-48 right-[5%] hidden w-44 md:block" />
      <Lasers />
      <div aria-hidden className="mv-scanlines" />

      {/* Blimp MOO melayang */}
      <div aria-hidden className="mv-drift pointer-events-none absolute left-[1%] top-[64px] hidden w-[220px] md:block lg:w-[270px]">
        <MvImg name="blimp" eager className="mv-float-slow h-auto w-full drop-shadow-[0_0_20px_rgba(247,20,247,0.55)]" />
      </div>

      <div className="relative mx-auto flex min-h-[640px] max-w-5xl flex-col items-center px-4 pb-44 pt-28 text-center sm:min-h-[760px] sm:pb-52 sm:pt-32">
        {n === 0 ? (
          <h1 className="sr-only">Mooniverse 2026</h1>
        ) : null}
        <div key={s?.slug ?? "brand"} className="flex animate-fade-up flex-col items-center">
          <p className="font-hud inline-flex items-center gap-2 rounded-full border border-[#9afcff]/60 bg-[#020a17]/70 px-4 py-1.5 text-sm font-bold uppercase tracking-[0.24em] text-[#9afcff] shadow-[0_0_16px_rgba(154,252,255,0.35)] backdrop-blur">
            <Sparkle className="size-3 text-[#f714f7]" /> {s && !brand ? s.badge : "Mooniverse 2026 · by Cimory"}
          </p>

          {brand ? (
            <div className="mt-4 flex items-center justify-center lg:gap-2">
              <h1>
                <span className="sr-only">{s?.name ?? "Mooniverse 2026"}</span>
                <MvImg
                  name="logo"
                  eager
                  className="mv-flicker h-auto w-[min(88vw,600px)] drop-shadow-[0_0_24px_rgba(247,20,247,0.55)]"
                />
              </h1>
              {/* Maskot hidup di samping logo (desktop) */}
              <MascotLive eager className="hidden w-44 shrink-0 drop-shadow-[0_0_24px_rgba(247,20,247,0.45)] lg:block xl:w-52" />
            </div>
          ) : (
            <h1 className="mx-auto mt-6 max-w-4xl text-3xl leading-tight sm:text-6xl">{s.name}</h1>
          )}

          {s && (
            <>
              {brand && (
                <>
                  <p className="mv-neon mt-2 max-w-3xl text-base leading-snug sm:text-2xl">{s.name}</p>
                  <p className="mv-brush mt-2 text-xl sm:text-3xl">Moo Brings Us Together</p>
                  <p className="font-hud mt-3 rounded-sm bg-[#f714f7]/15 px-3 py-0.5 text-base font-bold uppercase tracking-[0.2em] text-white ring-1 ring-[#f714f7]/60">
                    ● {s.badge}
                  </p>
                </>
              )}
              <p className="font-hud mt-4 text-lg font-semibold tracking-wide text-white sm:text-xl">
                {s.date} <span className="mx-1 text-[#f714f7]">✦</span> {s.place}
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="#tiket"
                  className="font-hud inline-flex h-12 items-center gap-2 rounded-full bg-[linear-gradient(100deg,#f714f7,#9b2cf5_50%,#0827b5)] px-7 text-lg font-bold uppercase tracking-[0.12em] text-white shadow-[0_0_24px_rgba(247,20,247,0.65),inset_0_0_0_1px_rgba(255,255,255,0.35)] transition hover:brightness-115"
                >
                  <MvImg name="bolt" className="h-6 w-auto" /> Klaim Tiket
                </Link>
                <Link
                  href={`/event/${s.slug}`}
                  className="font-hud inline-flex h-12 items-center rounded-full border-2 border-[#9afcff] bg-[#020a17]/60 px-6 text-lg font-bold uppercase tracking-[0.12em] text-[#9afcff] shadow-[0_0_16px_rgba(154,252,255,0.4)] backdrop-blur transition hover:bg-[#9afcff]/15"
                >
                  Detail Acara
                </Link>
              </div>
            </>
          )}
        </div>

        {s?.countdown && (
          <div className="mt-9">
            <h2 className="font-hud text-base font-bold uppercase tracking-[0.3em] text-[#9afcff] mv-glow-cyan sm:text-lg">{s.countdown.label}</h2>
            <BoxCountdown target={s.countdown.target} className="mt-4 justify-center" />
          </div>
        )}

        {n > 1 && (
          <div className="mt-8 flex items-center justify-center gap-2">
            <button type="button" onClick={() => go(i - 1)} aria-label="Event sebelumnya" className="grid size-11 place-items-center rounded-full border border-[#9afcff]/50 bg-[#020a17]/60 text-[#9afcff] hover:bg-[#9afcff]/15">‹</button>
            {slides.map((sl, k) => (
              <button key={sl.slug} type="button" onClick={() => go(k)} aria-label={`Tampilkan ${sl.name}`} aria-current={k === i} className="grid size-11 place-items-center">
                {k === i ? (
                  <Sparkle className="size-6 text-[#f714f7] drop-shadow-[0_0_8px_rgba(247,20,247,0.95)]" />
                ) : (
                  <span className="size-2.5 rounded-full bg-[#9afcff]/60 transition hover:bg-[#9afcff]" />
                )}
              </button>
            ))}
            <button type="button" onClick={() => go(i + 1)} aria-label="Event berikutnya" className="grid size-11 place-items-center rounded-full border border-[#9afcff]/50 bg-[#020a17]/60 text-[#9afcff] hover:bg-[#9afcff]/15">›</button>
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
        <span className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#020a17] to-transparent" />
      </div>
    </section>
  );
}
