import type { Metadata } from "next";
import Link from "next/link";
import { requirePageUser } from "@/lib/auth";
import { listUserTickets, type TicketView } from "@/lib/tickets";
import { fmtDate, fmtTime } from "@/lib/format";
import { ButtonLink } from "@/components/ui";
import { PageHero, StickerNote } from "@/components/site/ornaments";
import { TicketStatusBadge } from "@/components/site/ticket-status";
import { CalIcon, PinIcon } from "@/components/site/event-card";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tiket Saya" };

export default async function MyTicketsPage() {
  const u = await requirePageUser();
  const tickets = await listUserTickets(u.id);
  const now = Date.now();
  const isActive = (t: TicketView) => (t.status === "ACTIVE" || t.status === "CHECKED_IN") && t.end_at.getTime() > now && t.event_status !== "CANCELLED";
  const active = tickets.filter(isActive).sort((a, b) => a.start_at.getTime() - b.start_at.getTime());
  const history = tickets.filter((t) => !isActive(t));

  return (
    <div className="mx-auto max-w-4xl px-4 pb-8 pt-12 sm:pt-16">
      <PageHero title="Tiket Saya" subtitle="QR tiket selalu tersedia di sini, meskipun email belum masuk." />
      {tickets.length === 0 ? (
        <StickerNote sticker="cowChill" title="Belum ada tiket" action={<ButtonLink href="/event">Jelajah event</ButtonLink>}>
          Tiket yang Anda klaim akan muncul di sini.
        </StickerNote>
      ) : (
        <div className="space-y-10">
          <section className="space-y-4">
            <h2 className="mv-title flex items-center gap-2 text-2xl font-extrabold text-white"><span className="text-base text-[#ff2bd6]">✦</span> Tiket Aktif ({active.length})</h2>
            {active.length ? (
              <div className="grid gap-4">
                {active.map((t, i) => (
                  <TicketRow key={t.id} t={t} index={i} />
                ))}
              </div>
            ) : (
              <p className="text-muted">Tidak ada tiket aktif.</p>
            )}
          </section>
          {history.length > 0 && (
            <section className="space-y-4">
              <h2 className="mv-title flex items-center gap-2 text-2xl font-extrabold text-white"><span className="text-base text-[#ff2bd6]">✦</span> Riwayat ({history.length})</h2>
              <div className="grid gap-4 opacity-90">
                {history.map((t, i) => (
                  <TicketRow key={t.id} t={t} index={i} muted />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function TicketRow({ t, index, muted }: { t: TicketView; index: number; muted?: boolean }) {
  const finished = t.end_at.getTime() <= Date.now();
  return (
    <Link
      href={`/tiket-saya/${t.id}`}
      className="group flex animate-fade-up overflow-hidden rounded-2xl border border-line bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
      style={{ animationDelay: `${Math.min(index, 6) * 60}ms` }}
    >
      <div className="relative hidden w-40 shrink-0 sm:block">
        {t.thumb_url || t.banner_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={(t.thumb_url ?? t.banner_url)!} alt="" className={`size-full object-cover ${muted ? "grayscale" : ""}`} />
        ) : (
          <div className="size-full bg-cimory-gradient" />
        )}
      </div>
      <div className="relative flex flex-1 flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <TicketStatusBadge status={t.status} finished={finished} />
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
            <span className="size-2.5 rounded-full" style={{ background: t.category_color }} aria-hidden />
            {t.category_name}
          </span>
        </div>
        <h3 className="font-display text-xl font-extrabold leading-snug text-white">{t.event_name}</h3>
        <p className="flex items-center gap-2 text-sm text-muted">
          <CalIcon /> {fmtDate(t.start_at, t.timezone)} · {fmtTime(t.start_at, t.timezone)}
        </p>
        <p className="flex items-center gap-2 text-sm text-muted">
          <PinIcon /> {t.venue}
          {t.city ? `, ${t.city}` : ""}
        </p>
      </div>
      <div className="flex w-28 shrink-0 flex-col items-center justify-center gap-1 border-l-2 border-dashed border-[#22e5ff]/40 bg-[#0d0f3a]/80 p-3 text-center">
        <svg viewBox="0 0 24 24" className="size-8 text-[#22e5ff]" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <path d="M14 14h3v3h-3zM18 18h3v3h-3zM14 20h2M20 14v2" />
        </svg>
        <span className="text-xs font-semibold text-[#22e5ff]">{t.status === "ACTIVE" && !finished ? "Lihat QR" : "Detail"}</span>
      </div>
    </Link>
  );
}
