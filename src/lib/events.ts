import { sql } from "./db";
import { getRemaining } from "./quota";

export type EventRow = {
  id: string;
  slug: string;
  name: string;
  event_type: string;
  organizer: string;
  description: string;
  terms: string;
  banner_url: string | null;
  thumb_url: string | null;
  gallery: string[];
  venue: string;
  address: string;
  city: string;
  lat: number | null;
  lng: number | null;
  timezone: string;
  start_at: Date;
  end_at: Date;
  gate_open_at: Date | null;
  gates: string[];
  status: "DRAFT" | "PUBLISHED" | "CANCELLED";
  cancel_deadline_hours: number;
  require_id_match: boolean;
  email_text: string;
  version: number;
  published_at: Date | null;
};

export type CategoryRow = {
  id: string;
  event_id: string;
  name: string;
  description: string;
  quota: number;
  claimed: number;
  open_at: Date;
  close_at: Date;
  is_closed: boolean;
  sort_order: number;
  color: string;
  admit_batch: number;
  admit_interval_sec: number;
  version: number;
};

/** Status kategori untuk UI. Sisa kuota hanya informasi; penentu klaim tetap transaksi DB. */
export type CategoryStatus = "UPCOMING" | "OPEN" | "SOLD_OUT" | "CLOSED";

/** Status event turunan, sesuai PRD: Draft → Published → On Sale → Closed → Finished (+ Cancelled). */
export type EventStatus = "DRAFT" | "PUBLISHED" | "ON_SALE" | "CLOSED" | "FINISHED" | "CANCELLED";

export const QUEUE_LEAD_MS = 10 * 60 * 1000; // tombol Masuk Antrean aktif mulai T-10 menit

export function categoryStatus(c: Pick<CategoryRow, "open_at" | "close_at" | "is_closed">, remaining: number, now = Date.now()): CategoryStatus {
  if (c.is_closed || now >= c.close_at.getTime()) return "CLOSED";
  if (now < c.open_at.getTime()) return "UPCOMING";
  if (remaining <= 0) return "SOLD_OUT";
  return "OPEN";
}

export function eventStatus(e: Pick<EventRow, "status" | "end_at">, cats: Pick<CategoryRow, "open_at" | "close_at" | "is_closed">[], now = Date.now()): EventStatus {
  if (e.status === "DRAFT" || e.status === "CANCELLED") return e.status;
  if (now >= e.end_at.getTime()) return "FINISHED";
  const live = cats.filter((c) => !c.is_closed && now < c.close_at.getTime());
  if (live.some((c) => now >= c.open_at.getTime())) return "ON_SALE";
  if (live.length > 0) return "PUBLISHED";
  return "CLOSED";
}

/** Label kartu event: Segera dibuka / Sedang dibuka / Habis / Ditutup / Selesai / Dibatalkan. */
export type CardBadge = { key: "SOON" | "OPEN" | "SOLD_OUT" | "CLOSED" | "FINISHED" | "CANCELLED"; label: string; opensAt?: string };

export function cardBadge(e: Pick<EventRow, "status" | "end_at">, cats: (CategoryRow & { remaining: number })[], now = Date.now()): CardBadge {
  const s = eventStatus(e, cats, now);
  if (s === "CANCELLED") return { key: "CANCELLED", label: "Dibatalkan" };
  if (s === "FINISHED") return { key: "FINISHED", label: "Selesai" };
  const statuses = cats.map((c) => categoryStatus(c, c.remaining, now));
  if (statuses.includes("OPEN")) return { key: "OPEN", label: "Sedang dibuka" };
  const upcoming = cats.filter((c, i) => statuses[i] === "UPCOMING").sort((a, b) => a.open_at.getTime() - b.open_at.getTime());
  if (upcoming.length) return { key: "SOON", label: "Segera dibuka", opensAt: upcoming[0].open_at.toISOString() };
  if (statuses.length && statuses.every((x) => x === "SOLD_OUT" || x === "CLOSED") && cats.some((c) => c.remaining <= 0))
    return { key: "SOLD_OUT", label: "Habis" };
  return { key: "CLOSED", label: "Ditutup" };
}

export async function getEventBySlug(slug: string, opts: { includeDraft?: boolean } = {}) {
  const [e] = await sql<EventRow[]>`SELECT * FROM events WHERE slug = ${slug}`;
  if (!e || (e.status === "DRAFT" && !opts.includeDraft)) return null;
  return e;
}

export async function getEventById(id: string) {
  const [e] = await sql<EventRow[]>`SELECT * FROM events WHERE id = ${id}`;
  return e ?? null;
}

export async function getCategories(eventId: string) {
  const cats = await sql<CategoryRow[]>`
    SELECT * FROM ticket_categories WHERE event_id = ${eventId} ORDER BY sort_order, open_at, name`;
  const rem = await getRemaining(cats);
  return cats.map((c) => ({ ...c, remaining: rem[c.id] ?? Math.max(c.quota - c.claimed, 0) }));
}

export type PublicEventCard = Pick<EventRow, "id" | "slug" | "name" | "event_type" | "city" | "venue" | "start_at" | "end_at" | "timezone" | "banner_url" | "thumb_url"> & {
  badge: CardBadge;
  categoryCount: number;
};

/** Daftar event publik (Published/Cancelled; draft disembunyikan) dengan filter. */
export async function listPublicEvents(f: { q?: string; city?: string; type?: string; from?: Date; to?: Date; includePast?: boolean; limit?: number } = {}) {
  const q = f.q?.trim() ? `%${f.q.trim().replace(/[%_]/g, "")}%` : null;
  const events = await sql<EventRow[]>`
    SELECT * FROM events
    WHERE status <> 'DRAFT'
      ${q ? sql`AND (name ILIKE ${q} OR venue ILIKE ${q} OR city ILIKE ${q} OR organizer ILIKE ${q})` : sql``}
      ${f.city ? sql`AND city = ${f.city}` : sql``}
      ${f.type ? sql`AND event_type = ${f.type}` : sql``}
      ${f.from ? sql`AND end_at >= ${f.from}` : sql``}
      ${f.to ? sql`AND start_at <= ${f.to}` : sql``}
      ${f.includePast ? sql`` : sql`AND end_at >= now() - interval '1 day'`}
    ORDER BY start_at
    LIMIT ${f.limit ?? 60}`;
  if (!events.length) return [] as PublicEventCard[];
  const cats = await sql<CategoryRow[]>`SELECT * FROM ticket_categories WHERE event_id IN ${sql(events.map((e) => e.id))}`;
  const rem = await getRemaining(cats);
  const now = Date.now();
  return events.map((e) => {
    const ec = cats.filter((c) => c.event_id === e.id).map((c) => ({ ...c, remaining: rem[c.id] ?? c.quota - c.claimed }));
    return {
      id: e.id,
      slug: e.slug,
      name: e.name,
      event_type: e.event_type,
      city: e.city,
      venue: e.venue,
      start_at: e.start_at,
      end_at: e.end_at,
      timezone: e.timezone,
      banner_url: e.banner_url,
      thumb_url: e.thumb_url,
      badge: cardBadge(e, ec, now),
      categoryCount: ec.length,
    } satisfies PublicEventCard;
  });
}

export async function listFilterOptions() {
  const rows = await sql<{ city: string; event_type: string }[]>`
    SELECT DISTINCT city, event_type FROM events WHERE status <> 'DRAFT' AND end_at >= now() - interval '1 day'`;
  return {
    cities: [...new Set(rows.map((r) => r.city).filter(Boolean))].sort(),
    types: [...new Set(rows.map((r) => r.event_type).filter(Boolean))].sort(),
  };
}
