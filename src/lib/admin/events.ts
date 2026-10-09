import sanitizeHtml from "sanitize-html";
import { z } from "zod";
import { sql, type Tx } from "../db";
import { ApiError } from "../http";
import { audit } from "../audit";
import { enqueue } from "../outbox";
import { refreshRemainingFromDb } from "../quota";
import type { CategoryRow, EventRow } from "../events";

export const TIMEZONES = ["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura"] as const;
export const EVENT_TYPES = ["Gathering", "Musik", "Olahraga", "Seminar", "Workshop", "Pameran", "Festival", "Lainnya"];

/** Allowlist rich text deskripsi & S&K — mencegah XSS stored. */
export function sanitizeRich(html: string) {
  return sanitizeHtml(html, {
    allowedTags: ["p", "br", "strong", "b", "em", "i", "u", "h2", "h3", "ul", "ol", "li", "a", "blockquote"],
    allowedAttributes: { a: ["href", "target", "rel"] },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer nofollow", target: "_blank" }),
      div: "p",
      h1: "h2",
    },
  }).trim();
}

export function slugify(s: string) {
  return (
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "event"
  );
}

export const conflict = () => new ApiError(409, "VERSION_CONFLICT", "Data sudah diubah admin lain. Muat ulang untuk melihat data terbaru.");

export async function loadEventOr404(id: string, tx: Tx | typeof sql = sql) {
  if (!z.string().uuid().safeParse(id).success) throw new ApiError(404, "NOT_FOUND", "Event tidak ditemukan.");
  const [e] = await tx<EventRow[]>`SELECT * FROM events WHERE id = ${id}`;
  if (!e) throw new ApiError(404, "NOT_FOUND", "Event tidak ditemukan.");
  return e;
}

export async function loadCategories(eventId: string, tx: Tx | typeof sql = sql) {
  return tx<(CategoryRow & { ticket_count: number })[]>`
    SELECT c.*, (SELECT count(*)::int FROM tickets t WHERE t.category_id = c.id) AS ticket_count
    FROM ticket_categories c WHERE c.event_id = ${eventId} ORDER BY c.sort_order, c.open_at, c.name`;
}

/** Hanya field yang berubah, untuk before/after audit log. */
export function diff<T extends Record<string, unknown>>(before: T, after: Partial<T>) {
  const b: Record<string, unknown> = {};
  const a: Record<string, unknown> = {};
  for (const k of Object.keys(after)) {
    const bv = before[k] instanceof Date ? (before[k] as Date).toISOString() : before[k];
    const av = after[k] instanceof Date ? (after[k] as Date).toISOString() : after[k];
    if (JSON.stringify(bv) !== JSON.stringify(av)) {
      b[k] = bv;
      a[k] = av;
    }
  }
  return { before: b, after: a, changed: Object.keys(a).length > 0 };
}

/** Daftar masalah yang menghalangi publikasi. Kosong = siap dipublikasi. */
export function publishProblems(e: EventRow, cats: CategoryRow[]): string[] {
  const p: string[] = [];
  const now = Date.now();
  if (!e.name.trim()) p.push("Nama event wajib diisi.");
  if (!e.slug.trim()) p.push("Slug URL wajib diisi.");
  if (!e.description.replace(/<[^>]+>/g, "").trim()) p.push("Deskripsi wajib diisi.");
  if (!e.terms.replace(/<[^>]+>/g, "").trim()) p.push("Syarat & Ketentuan wajib diisi.");
  if (!e.organizer.trim()) p.push("Nama penyelenggara wajib diisi.");
  if (!e.banner_url) p.push("Banner utama belum diunggah.");
  if (!e.thumb_url) p.push("Thumbnail kartu belum diunggah.");
  if (!e.venue.trim() || !e.address.trim() || !e.city.trim()) p.push("Venue, alamat, dan kota wajib diisi.");
  if (e.end_at <= e.start_at) p.push("Waktu selesai acara harus setelah waktu mulai.");
  if (e.start_at.getTime() <= now) p.push("Waktu mulai acara sudah lewat.");
  if (!e.gates.length) p.push("Minimal satu gate harus ditentukan.");
  if (!cats.length) p.push("Minimal satu kategori tiket.");
  for (const c of cats) {
    if (c.close_at <= c.open_at) p.push(`Kategori "${c.name}": jam tutup harus setelah jam buka.`);
    if (c.close_at >= e.start_at) p.push(`Kategori "${c.name}": jam tutup order harus sebelum acara mulai.`);
  }
  return p;
}

/**
 * Batalkan event: status CANCELLED, semua tiket ACTIVE dibatalkan, claimed disesuaikan,
 * email pemberitahuan diantrekan — satu transaksi.
 */
export async function cancelEvent(eventId: string, actorId: string, reason: string, version: number, ip?: string) {
  const res = await sql.begin(async (tx) => {
    const e = await loadEventOr404(eventId, tx);
    if (e.status === "CANCELLED") throw new ApiError(409, "ALREADY_CANCELLED", "Event sudah dibatalkan.");
    if (e.end_at.getTime() <= Date.now()) throw new ApiError(409, "FINISHED", "Event yang sudah selesai tidak bisa dibatalkan.");
    const [upd] = await tx`
      UPDATE events SET status = 'CANCELLED', cancelled_at = now(), version = version + 1
      WHERE id = ${eventId} AND version = ${version} RETURNING id`;
    if (!upd) throw conflict();
    const cancelled = await tx<{ id: string; category_id: string }[]>`
      UPDATE tickets SET status = 'CANCELLED', cancelled_at = now(), cancel_reason = ${"Event dibatalkan: " + reason}
      WHERE event_id = ${eventId} AND status = 'ACTIVE' RETURNING id, category_id`;
    const perCat = new Map<string, number>();
    for (const t of cancelled) perCat.set(t.category_id, (perCat.get(t.category_id) ?? 0) + 1);
    for (const [cid, n] of perCat) await tx`UPDATE ticket_categories SET claimed = claimed - ${n} WHERE id = ${cid}`;
    await tx`UPDATE ticket_categories SET is_closed = true WHERE event_id = ${eventId}`;
    for (const t of cancelled) await enqueue("TICKET_CANCELLED", { ticketId: t.id }, tx);
    await audit(
      { actorId, action: "event.cancel", entity: "event", entityId: eventId, before: { status: e.status }, after: { status: "CANCELLED", reason, ticketsCancelled: cancelled.length }, ip },
      tx,
    );
    return { cats: [...perCat.keys()], count: cancelled.length };
  });
  const all = await sql<{ id: string }[]>`SELECT id FROM ticket_categories WHERE event_id = ${eventId}`;
  for (const c of all) await refreshRemainingFromDb(c.id);
  return res;
}

const CSV_DANGER = /^[=+\-@\t\r]/;
export function csvCell(v: unknown) {
  let s = v == null ? "" : v instanceof Date ? v.toISOString() : String(v);
  if (CSV_DANGER.test(s)) s = "'" + s; // cegah CSV formula injection
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
