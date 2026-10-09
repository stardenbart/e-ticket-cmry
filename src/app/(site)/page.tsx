import Link from "next/link";
import { sql } from "@/lib/db";
import { listFilterOptions, listPublicEvents } from "@/lib/events";
import { fmtDate } from "@/lib/format";
import { HeroCarousel, type HeroSlide } from "@/components/site/hero-carousel";
import { EventCard } from "@/components/site/event-card";
import { EventFilters, parseFilters } from "@/components/site/event-filters";
import { FrameTitle, MascotLive, Marquee, MvImg, StickerNote } from "@/components/site/ornaments";

export const dynamic = "force-dynamic";

/** Waktu buka berikutnya / tutup terdekat per event untuk countdown hero. */
async function heroTargets(eventIds: string[]) {
  if (!eventIds.length) return new Map<string, { opens: Date | null; closes: Date | null }>();
  const rows = await sql<{ event_id: string; opens: Date | null; closes: Date | null }[]>`
    SELECT event_id,
           min(open_at) FILTER (WHERE open_at > now() AND NOT is_closed) AS opens,
           min(close_at) FILTER (WHERE open_at <= now() AND close_at > now() AND NOT is_closed AND claimed < quota) AS closes
    FROM ticket_categories WHERE event_id IN ${sql(eventIds)} GROUP BY event_id`;
  return new Map(rows.map((r) => [r.event_id, { opens: r.opens, closes: r.closes }]));
}

export default async function HomePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { values, query } = parseFilters(await searchParams);
  const filtered = Object.values(values).some(Boolean);
  const [events, featured, opts] = await Promise.all([
    listPublicEvents(query),
    filtered ? listPublicEvents({}) : null,
    listFilterOptions(),
  ]);
  const pool = (featured ?? events).filter((e) => e.badge.key !== "FINISHED" && e.badge.key !== "CANCELLED");
  const order = { OPEN: 0, SOON: 1, SOLD_OUT: 2, CLOSED: 3, FINISHED: 4, CANCELLED: 5 } as const;
  const top = [...pool].sort((a, b) => order[a.badge.key] - order[b.badge.key]).slice(0, 5);
  const targets = await heroTargets(top.map((e) => e.id));
  const slides: HeroSlide[] = top.map((e) => {
    const t = targets.get(e.id);
    const countdown =
      e.badge.key === "OPEN" && t?.closes
        ? { label: "Pemesanan Ditutup Dalam", target: t.closes.toISOString() }
        : t?.opens
          ? { label: "Pemesanan Dibuka Dalam", target: t.opens.toISOString() }
          : { label: "Acara Dimulai Dalam", target: e.start_at.toISOString() };
    return {
      slug: e.slug,
      name: e.name,
      banner: e.banner_url,
      date: fmtDate(e.start_at, e.timezone),
      place: [e.venue, e.city].filter(Boolean).join(", "),
      badge: e.badge.label,
      countdown,
    };
  });

  const openNow = events.filter((e) => e.badge.key === "OPEN");
  const soon = events.filter((e) => e.badge.key === "SOON");
  const others = events.filter((e) => e.badge.key !== "OPEN" && e.badge.key !== "SOON");

  return (
    <div>
      <HeroCarousel slides={slides} />
      <Marquee className="-mt-px" />

      <div className="relative">
        {/* Menara MOO sebagai dekorasi sisi (desktop) */}
        <MvImg name="towerMoo" className="pointer-events-none absolute -left-6 top-24 hidden h-[460px] w-auto opacity-80 drop-shadow-[0_0_24px_rgba(34,229,255,0.4)] 2xl:block" />
        <MvImg name="towerFood" className="pointer-events-none absolute -right-4 top-[520px] hidden h-[400px] w-auto opacity-80 drop-shadow-[0_0_24px_rgba(255,43,214,0.4)] 2xl:block" />

        <div className="mx-auto max-w-6xl space-y-20 px-4 pt-14">
          <section aria-labelledby="cari" className="mv-reveal">
            <h2 id="cari" className="sr-only">Cari event</h2>
            <EventFilters action="/" values={values} cities={opts.cities} types={opts.types} />
          </section>

          {filtered ? (
            <Section title="Hasil Pencarian" count={events.length}>
              {events.length ? <Grid events={events} /> : <NoResult />}
            </Section>
          ) : events.length === 0 ? (
            <NoResult />
          ) : (
            <>
              {openNow.length > 0 && (
                <Section title="Sedang Dibuka" subtitle="Kuota terbatas — klaim sebelum habis." count={openNow.length}>
                  <Grid events={openNow} />
                </Section>
              )}
              {soon.length > 0 && (
                <Section title="Segera Dibuka" subtitle="Siapkan akun & profil identitas sebelum war dimulai." count={soon.length} icon="bolt">
                  <Grid events={soon} />
                </Section>
              )}
              {others.length > 0 && (
                <Section title="Event Lainnya" count={others.length} icon="heart">
                  <Grid events={others} />
                </Section>
              )}
            </>
          )}

          <HowItWorks />
        </div>
      </div>
    </div>
  );
}

function Section({ title, subtitle, count, children, icon = "crown" }: { title: string; subtitle?: string; count: number; children: React.ReactNode; icon?: "crown" | "bolt" | "heart" }) {
  return (
    <section className="space-y-10">
      <FrameTitle sub={subtitle} icon={icon}>
        {title} <span className="font-hud align-middle text-lg font-bold text-[#22e5ff]">[{count}]</span>
      </FrameTitle>
      {children}
      <div className="flex justify-center">
        <Link href="/event" className="font-hud inline-flex h-11 items-center gap-2 rounded-full px-6 text-base font-bold uppercase tracking-[0.12em] text-[#22e5ff] ring-1 ring-[#22e5ff]/60 transition hover:bg-[#22e5ff]/10 hover:shadow-[0_0_16px_rgba(34,229,255,0.45)]">
          Lihat semua event →
        </Link>
      </div>
    </section>
  );
}

function Grid({ events }: { events: Awaited<ReturnType<typeof listPublicEvents>> }) {
  return (
    <div className="grid justify-center gap-7 [grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),360px))]">
      {events.map((e, i) => (
        <EventCard key={e.id} e={e} index={i} />
      ))}
    </div>
  );
}

function NoResult() {
  return (
    <StickerNote sticker="cowWink" title="Event tidak ditemukan">
      Coba ubah kata kunci atau filter. <Link href="/" className="font-semibold text-[#22e5ff] underline">Reset filter</Link>
    </StickerNote>
  );
}

const STEPS = [
  ["Daftar & Lengkapi Profil", "Buat akun dengan email aktif, lalu lengkapi profil identitas (KTP/SIM/Paspor)."],
  ["Masuk Antrean", "Antrean dibuka 10 menit sebelum war. Urutan diacak saat dibuka agar adil bagi semua."],
  ["Klaim Tiket", "Saat giliran tiba, konfirmasi data dan klaim. Kuota dijamin tidak pernah terlampaui."],
  ["Datang ke Gate", "QR dikirim ke email dan tersedia di Tiket Saya. Bawa identitas asli untuk dicocokkan."],
];

/** Cara kerja: maskot sebagai pemandu + timeline neon. */
function HowItWorks() {
  return (
    <section className="space-y-12" aria-labelledby="cara-kerja">
      <FrameTitle sub="Empat langkah dari daftar sampai masuk venue." icon="m">
        <span id="cara-kerja">Cara Kerja</span>
      </FrameTitle>
      <div className="grid items-center gap-10 lg:grid-cols-[360px_1fr]">
        <div className="mv-reveal relative mx-auto w-full max-w-[300px] lg:max-w-none">
          <div aria-hidden className="absolute inset-[12%] rounded-full bg-[radial-gradient(circle,rgba(255,43,214,0.45),transparent_65%)] blur-2xl" />
          <MascotLive alt="Maskot MOO dengan kacamata VR melambai" className="mv-float relative mx-auto w-full max-w-[340px]" />
          <div className="mv-card relative -mt-4 px-4 py-3 text-center">
            <p className="font-hud text-lg font-bold uppercase tracking-wider text-white">&ldquo;Moo! Ikuti langkahnya, ya!&rdquo;</p>
          </div>
        </div>
        <ol className="relative space-y-6 pl-16 sm:pl-28">
          <span aria-hidden className="mv-timeline-line absolute bottom-0 left-12 top-0 w-0.5 sm:left-20" />
          {STEPS.map(([t, d], i) => (
            <li key={t} className="mv-reveal relative" style={{ transitionDelay: `${i * 80}ms` }}>
              <span aria-hidden className="font-display absolute -left-16 top-4 w-9 text-right text-3xl font-black text-[#22e5ff] mv-glow-cyan sm:-left-28 sm:w-[68px] sm:text-5xl">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span aria-hidden className="absolute -left-4 top-10 h-0.5 w-4 bg-[#ff2bd6] shadow-[0_0_8px_#ff2bd6] sm:-left-8 sm:w-8" />
              <span aria-hidden className="absolute -left-[19px] top-[36px] size-2.5 rotate-45 bg-[#ff2bd6] shadow-[0_0_10px_#ff2bd6] sm:-left-[35px]" />
              <div className="mv-frame mv-frame-sm px-6 py-5 sm:px-8">
                <h3 className="mv-title text-base font-extrabold tracking-wider text-white sm:text-xl">{t}</h3>
                <p className="mt-1.5 text-sm text-[#dbe4ff] sm:text-base">{d}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
      <p className="flex justify-center">
        <Link
          href="/daftar"
          className="font-hud inline-flex h-12 items-center gap-2 rounded-full bg-[linear-gradient(100deg,#ff2bd6,#b026ff_50%,#2d6bff)] px-7 text-lg font-bold uppercase tracking-[0.12em] text-white shadow-[0_0_24px_rgba(255,43,214,0.6)] ring-1 ring-white/30 transition hover:brightness-110"
        >
          <MvImg name="sparkle" className="h-6 w-auto" /> Daftar Sekarang
        </Link>
      </p>
    </section>
  );
}
