import { sql } from "@/lib/db";
import { getEventBySlug, listPublicEvents, type EventRow } from "@/lib/events";
import { fmtDate } from "@/lib/format";
import { HeroCarousel, type HeroSlide } from "@/components/site/hero-carousel";
import { EventCard } from "@/components/site/event-card";
import { About, Highlights, HowItWorks } from "@/components/site/landing";
import { loadCategoryPanel } from "@/components/site/event-panel-data";
import { FEATURED_SLUG } from "@/components/site/config";
import { FrameTitle, Marquee, StickerNote } from "@/components/site/ornaments";

export const dynamic = "force-dynamic";

/** Waktu buka berikutnya / tutup terdekat untuk countdown hero. */
async function heroCountdown(e: EventRow, open: boolean) {
  const [t] = await sql<{ opens: Date | null; closes: Date | null }[]>`
    SELECT min(open_at) FILTER (WHERE open_at > now() AND NOT is_closed) AS opens,
           min(close_at) FILTER (WHERE open_at <= now() AND close_at > now() AND NOT is_closed AND claimed < quota) AS closes
    FROM ticket_categories WHERE event_id = ${e.id}`;
  if (open && t?.closes) return { label: "Pemesanan Ditutup Dalam", target: t.closes.toISOString() };
  if (t?.opens) return { label: "Pemesanan Dibuka Dalam", target: t.opens.toISOString() };
  if (e.start_at.getTime() > Date.now()) return { label: "Acara Dimulai Dalam", target: e.start_at.toISOString() };
  return null;
}

export default async function HomePage() {
  const events = await listPublicEvents({});
  const featuredRow = (await getEventBySlug(FEATURED_SLUG)) ?? (events[0] ? await getEventBySlug(events[0].slug) : null);
  const featuredCard = featuredRow ? events.find((e) => e.id === featuredRow.id) : undefined;
  const others = events.filter((e) => e.id !== featuredRow?.id && e.badge.key !== "FINISHED" && e.badge.key !== "CANCELLED");

  let slides: HeroSlide[] = [];
  let panelData: Awaited<ReturnType<typeof loadCategoryPanel>> | null = null;
  if (featuredRow) {
    const badge = featuredCard?.badge;
    const [countdown, pd] = await Promise.all([heroCountdown(featuredRow, badge?.key === "OPEN"), loadCategoryPanel(featuredRow)]);
    panelData = pd;
    slides = [
      {
        slug: featuredRow.slug,
        name: featuredRow.name,
        banner: featuredRow.banner_url,
        date: fmtDate(featuredRow.start_at, featuredRow.timezone),
        place: [featuredRow.venue, featuredRow.city].filter(Boolean).join(", "),
        badge: badge?.label ?? "Segera hadir",
        countdown,
      },
    ];
  }

  return (
    <div>
      <HeroCarousel slides={slides} />
      <Marquee className="-mt-px" />

      {featuredRow && panelData ? (
        <>
          <About e={featuredRow} panel={panelData.panel} />
          <Highlights />
          <HowItWorks />
        </>
      ) : (
        <div className="mx-auto max-w-xl px-4 pt-16">
          <StickerNote sticker="cowChill" title="Event segera diumumkan">
            Pantau terus halaman ini — Mooniverse akan segera membuka pendaftaran.
          </StickerNote>
        </div>
      )}

      {others.length > 0 && (
        <section className="mx-auto max-w-6xl space-y-10 px-4 pt-24">
          <FrameTitle sub="Event lain yang sedang dipublikasikan." icon="boltNeon">
            Event Lainnya
          </FrameTitle>
          <div className="grid justify-center gap-7 [grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),360px))]">
            {others.map((e, i) => (
              <EventCard key={e.id} e={e} index={i} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
