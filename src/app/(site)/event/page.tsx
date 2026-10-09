import type { Metadata } from "next";
import Link from "next/link";
import { listFilterOptions, listPublicEvents } from "@/lib/events";
import { PageHero, StickerNote } from "@/components/site/ornaments";
import { EventCard } from "@/components/site/event-card";
import { EventFilters, parseFilters } from "@/components/site/event-filters";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Jelajah Event" };

export default async function ExplorePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const { values, query } = parseFilters(sp);
  const showPast = sp.selesai === "1";
  const [events, opts] = await Promise.all([listPublicEvents({ ...query, includePast: showPast, limit: 120 }), listFilterOptions()]);

  return (
    <div className="mx-auto max-w-6xl px-4 pt-16 sm:pt-20">
      <PageHero title="Jelajah Event" subtitle={`${events.length} event ditemukan`}>
        <Link href={showPast ? "/event" : "/event?selesai=1"} className="mt-4 inline-flex h-11 items-center rounded-full px-4 text-sm font-semibold text-[#22e5ff] ring-1 ring-[#22e5ff]/40 hover:bg-white/10">
          {showPast ? "Sembunyikan event yang sudah selesai" : "Tampilkan juga event yang sudah selesai"}
        </Link>
      </PageHero>
      <EventFilters action="/event" values={values} cities={opts.cities} types={opts.types} />
      <div className="mt-10">
        {events.length ? (
          <div className="grid justify-center gap-7 [grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),360px))]">
            {events.map((e, i) => (
              <EventCard key={e.id} e={e} index={i} />
            ))}
          </div>
        ) : (
          <StickerNote sticker="cowWink" title="Event tidak ditemukan">
            Coba ubah kata kunci atau filter. <Link href="/event" className="font-semibold text-cimory-blue underline">Reset filter</Link>
          </StickerNote>
        )}
      </div>
    </div>
  );
}
