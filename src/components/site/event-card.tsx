import Link from "next/link";
import type { CardBadge, PublicEventCard } from "@/lib/events";
import { fmtDate, fmtTime } from "@/lib/format";
import { Badge } from "@/components/ui";
import { TextCountdown } from "./countdown";

const BADGE_TONE: Record<CardBadge["key"], "blue" | "red" | "green" | "amber" | "slate"> = {
  SOON: "amber",
  OPEN: "green",
  SOLD_OUT: "red",
  CLOSED: "slate",
  FINISHED: "slate",
  CANCELLED: "red",
};

const BADGE_ICON: Record<CardBadge["key"], string> = {
  SOON: "⏳",
  OPEN: "●",
  SOLD_OUT: "✕",
  CLOSED: "■",
  FINISHED: "✓",
  CANCELLED: "✕",
};

export function EventBadge({ badge }: { badge: CardBadge }) {
  return (
    <Badge tone={BADGE_TONE[badge.key]} icon={<span aria-hidden>{BADGE_ICON[badge.key]}</span>}>
      {badge.key === "SOON" && badge.opensAt ? <TextCountdown target={badge.opensAt} prefix="Segera dibuka ·" /> : badge.label}
    </Badge>
  );
}

export function EventCard({ e, index = 0 }: { e: PublicEventCard; index?: number }) {
  const img = e.thumb_url ?? e.banner_url;
  return (
    <Link
      href={`/event/${e.slug}`}
      className="mv-card group flex animate-fade-up flex-col p-2.5 transition duration-300 hover:-translate-y-1.5 hover:border-[#ff2bd6] hover:shadow-[0_0_0_1px_rgba(255,43,214,0.8),0_0_28px_rgba(255,43,214,0.45),0_0_60px_rgba(34,229,255,0.2)] focus-visible:-translate-y-1"
      style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}
    >
      <div className="relative aspect-[2/1] overflow-hidden rounded-[3px] bg-slate-100 ring-1 ring-[#22e5ff]/40 [clip-path:polygon(0_0,calc(100%-18px)_0,100%_18px,100%_100%,18px_100%,0_calc(100%-18px))]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {e.banner_url ? (
          <img src={e.banner_url} alt="" loading="lazy" className="size-full object-cover transition duration-500 group-hover:scale-105" />
        ) : img ? (
          <img src={img} alt="" loading="lazy" className="size-full object-cover" />
        ) : (
          <div className="size-full bg-cimory-gradient" />
        )}
        <div className="absolute left-3 top-3">
          <EventBadge badge={e.badge} />
        </div>
        <span className="font-hud absolute bottom-3 right-3 rounded-full bg-[#0d0f3a]/85 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[#22e5ff] ring-1 ring-[#22e5ff]/40 backdrop-blur">
          {e.event_type}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 px-2.5 pb-2 pt-4">
        <h3 className="font-display line-clamp-2 text-lg font-extrabold uppercase leading-snug tracking-wide text-white transition group-hover:text-[#ff7be5]">{e.name}</h3>
        <p className="flex items-center gap-2 text-sm text-muted">
          <CalIcon />
          {fmtDate(e.start_at, e.timezone)} · {fmtTime(e.start_at, e.timezone)}
        </p>
        <p className="flex items-center gap-2 text-sm text-muted">
          <PinIcon />
          <span className="truncate">
            {e.venue}
            {e.city ? `, ${e.city}` : ""}
          </span>
        </p>
        <div className="mt-auto flex items-center justify-between border-t border-dashed border-[#22e5ff]/30 pt-3 text-sm">
          <span className="font-hud text-base font-bold uppercase tracking-[0.14em] text-[#22e5ff]">✦ Gratis</span>
          <span className="font-hud rounded-full px-3.5 py-1.5 text-sm font-bold uppercase tracking-[0.1em] text-white ring-1 ring-[#ff2bd6]/70 transition group-hover:bg-[#ff2bd6] group-hover:shadow-[0_0_16px_rgba(255,43,214,0.7)]">Lihat detail →</span>
        </div>
      </div>
    </Link>
  );
}

export function CalIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

export function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 22s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

export function EventGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="mv-card overflow-hidden p-2.5">
          <div className="skeleton aspect-[2/1]" />
          <div className="space-y-3 p-4">
            <div className="skeleton h-5 w-3/4" />
            <div className="skeleton h-4 w-1/2" />
            <div className="skeleton h-4 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
