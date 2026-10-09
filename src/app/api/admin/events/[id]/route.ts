import crypto from "node:crypto";
import { z } from "zod";
import { sql, pgConstraint } from "@/lib/db";
import { body, clientIp, json, route, ApiError } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { eventStatus } from "@/lib/events";
import { zonedLocalToUtc } from "@/lib/format";
import { EVENT_TYPES, TIMEZONES, cancelEvent, conflict, diff, loadCategories, loadEventOr404, publishProblems, sanitizeRich, slugify } from "@/lib/admin/events";

export const dynamic = "force-dynamic";

type P = { id: string };

export const GET = route<P>(async (_req, ctx) => {
  await requireAdmin();
  const { id } = await ctx.params;
  const e = await loadEventOr404(id);
  const cats = await loadCategories(id);
  const staff = await sql`
    SELECT g.user_id, g.gates, g.valid_until, u.email, u.full_name, (u.password_hash IS NULL) AS pending
    FROM gate_staff g JOIN users u ON u.id = g.user_id WHERE g.event_id = ${id} ORDER BY u.full_name`;
  return json({ event: e, categories: cats, staff, status: eventStatus(e, cats), problems: publishProblems(e, cats), eventTypes: EVENT_TYPES });
});

const localDt = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Format tanggal/jam tidak valid.");

const patchSchema = z.object({
  version: z.number().int(),
  name: z.string().trim().min(1, "Nama event wajib diisi.").max(100, "Nama maksimal 100 karakter.").optional(),
  slug: z
    .string()
    .trim()
    .min(3, "Slug minimal 3 karakter.")
    .max(90)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug hanya huruf kecil, angka, dan tanda hubung.")
    .optional(),
  event_type: z.string().trim().min(1).max(40).optional(),
  organizer: z.string().trim().max(120).optional(),
  description: z.string().max(50_000).optional(),
  terms: z.string().max(50_000).optional(),
  timezone: z.enum(TIMEZONES).optional(),
  start_local: localDt.optional(),
  end_local: localDt.optional(),
  gate_open_local: localDt.or(z.literal("")).optional(),
  venue: z.string().trim().max(150).optional(),
  address: z.string().trim().max(300).optional(),
  city: z.string().trim().max(80).optional(),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  gates: z.array(z.string().trim().min(1).max(40)).min(1, "Minimal satu gate.").max(30).optional(),
  cancel_deadline_hours: z.number().int().min(0).max(24 * 60).optional(),
  require_id_match: z.boolean().optional(),
  email_text: z.string().max(2000).optional(),
});

/** Simpan field event dengan optimistic locking (version). */
export const PATCH = route<P>(async (req, ctx) => {
  const u = await requireAdmin();
  const { id } = await ctx.params;
  const d = await body(req, patchSchema);

  const result = await sql.begin(async (tx) => {
    const e = await loadEventOr404(id, tx);
    if (e.version !== d.version) throw conflict();
    if (e.status === "CANCELLED") throw new ApiError(409, "CANCELLED", "Event yang dibatalkan tidak bisa diubah.");
    const tz = d.timezone ?? e.timezone;
    const next: Record<string, unknown> = {};
    if (d.name !== undefined) next.name = d.name;
    if (d.slug !== undefined) next.slug = slugify(d.slug);
    if (d.event_type !== undefined) next.event_type = d.event_type;
    if (d.organizer !== undefined) next.organizer = d.organizer;
    if (d.description !== undefined) next.description = sanitizeRich(d.description);
    if (d.terms !== undefined) next.terms = sanitizeRich(d.terms);
    if (d.timezone !== undefined) next.timezone = d.timezone;
    if (d.start_local !== undefined) next.start_at = zonedLocalToUtc(d.start_local, tz);
    if (d.end_local !== undefined) next.end_at = zonedLocalToUtc(d.end_local, tz);
    if (d.gate_open_local !== undefined) next.gate_open_at = d.gate_open_local ? zonedLocalToUtc(d.gate_open_local, tz) : null;
    for (const k of ["venue", "address", "city", "lat", "lng", "cancel_deadline_hours", "require_id_match", "email_text"] as const) {
      if (d[k] !== undefined) next[k] = d[k];
    }
    if (d.gates !== undefined) next.gates = [...new Set(d.gates)];

    const start = (next.start_at as Date | undefined) ?? e.start_at;
    const end = (next.end_at as Date | undefined) ?? e.end_at;
    if (end <= start) throw new ApiError(400, "VALIDATION", "Waktu selesai acara harus setelah waktu mulai.");
    if (next.start_at) {
      const [bad] = await tx<{ name: string }[]>`
        SELECT name FROM ticket_categories WHERE event_id = ${id} AND close_at >= ${start} LIMIT 1`;
      if (bad) throw new ApiError(400, "VALIDATION", `Jam tutup order kategori "${bad.name}" harus sebelum acara mulai. Ubah kategorinya dulu.`);
    }

    const ch = diff(e as unknown as Record<string, unknown>, next);
    if (!ch.changed) return { version: e.version };
    const cols = Object.keys(ch.after);
    const values: Record<string, unknown> = {};
    for (const k of cols) values[k] = next[k];
    let row;
    try {
      [row] = await tx<{ version: number }[]>`
        UPDATE events SET ${tx(values as Record<string, never>, ...(cols as never[]))}, version = version + 1
        WHERE id = ${id} AND version = ${d.version} RETURNING version`;
    } catch (err) {
      if (pgConstraint(err) === "events_slug_uq") throw new ApiError(409, "SLUG_TAKEN", "Slug sudah dipakai event lain.");
      if (pgConstraint(err) === "events_time_ck") throw new ApiError(400, "VALIDATION", "Waktu selesai acara harus setelah waktu mulai.");
      throw err;
    }
    if (!row) throw conflict();
    // Deskripsi/S&K bisa panjang — audit cukup mencatat bahwa field berubah.
    for (const k of ["description", "terms"]) {
      if (k in ch.after) {
        ch.before[k] = "(rich text)";
        ch.after[k] = "(rich text diperbarui)";
      }
    }
    const isSchedule = cols.some((c) => ["start_at", "end_at", "gate_open_at", "timezone"].includes(c));
    await audit({ actorId: u.id, action: isSchedule ? "event.schedule_update" : "event.update", entity: "event", entityId: id, before: ch.before, after: ch.after, ip: clientIp(req) }, tx);
    return { version: row.version };
  });
  return json({ ok: true, ...result });
});

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("publish"), version: z.number().int() }),
  z.object({ action: z.literal("unpublish"), version: z.number().int() }),
  z.object({ action: z.literal("cancel"), version: z.number().int(), reason: z.string().trim().min(3, "Tulis alasan pembatalan.").max(300) }),
  z.object({ action: z.literal("duplicate") }),
]);

/** POST { action: publish | unpublish | cancel | duplicate } */
export const POST = route<P>(async (req, ctx) => {
  const u = await requireAdmin();
  const { id } = await ctx.params;
  const d = await body(req, actionSchema);
  const ip = clientIp(req);

  if (d.action === "publish") {
    const out = await sql.begin(async (tx) => {
      const e = await loadEventOr404(id, tx);
      if (e.version !== d.version) throw conflict();
      if (e.status !== "DRAFT") throw new ApiError(409, "NOT_DRAFT", "Hanya event berstatus Draft yang bisa dipublikasi.");
      const problems = publishProblems(e, await loadCategories(id, tx));
      if (problems.length) throw new ApiError(400, "NOT_READY", "Event belum lolos validasi publikasi.", { problems });
      const [row] = await tx<{ version: number }[]>`
        UPDATE events SET status = 'PUBLISHED', published_at = now(), version = version + 1
        WHERE id = ${id} AND version = ${d.version} RETURNING version`;
      if (!row) throw conflict();
      await audit({ actorId: u.id, action: "event.publish", entity: "event", entityId: id, before: { status: "DRAFT" }, after: { status: "PUBLISHED" }, ip }, tx);
      return row;
    });
    return json({ ok: true, version: out.version });
  }

  if (d.action === "unpublish") {
    const out = await sql.begin(async (tx) => {
      const e = await loadEventOr404(id, tx);
      if (e.version !== d.version) throw conflict();
      if (e.status !== "PUBLISHED") throw new ApiError(409, "NOT_PUBLISHED", "Event belum dipublikasi.");
      const [t] = await tx`SELECT 1 FROM tickets WHERE event_id = ${id} LIMIT 1`;
      if (t) throw new ApiError(409, "HAS_TICKETS", "Event yang sudah punya tiket tidak bisa dikembalikan ke Draft. Gunakan Batalkan Event.");
      const [row] = await tx<{ version: number }[]>`
        UPDATE events SET status = 'DRAFT', version = version + 1 WHERE id = ${id} AND version = ${d.version} RETURNING version`;
      if (!row) throw conflict();
      await audit({ actorId: u.id, action: "event.unpublish", entity: "event", entityId: id, before: { status: "PUBLISHED" }, after: { status: "DRAFT" }, ip }, tx);
      return row;
    });
    return json({ ok: true, version: out.version });
  }

  if (d.action === "cancel") {
    const r = await cancelEvent(id, u.id, d.reason, d.version, ip);
    return json({ ok: true, ticketsCancelled: r.count });
  }

  // duplicate: salin event + kategori sebagai DRAFT (claimed = 0, tanpa tiket & staf).
  const newId = await sql.begin(async (tx) => {
    const e = await loadEventOr404(id, tx);
    const slug = `${e.slug.slice(0, 70)}-salinan-${crypto.randomBytes(2).toString("hex")}`;
    const name = `${e.name.slice(0, 90)} (Salinan)`;
    const [n] = await tx<{ id: string }[]>`
      INSERT INTO events (slug, name, event_type, organizer, description, terms, banner_url, thumb_url, gallery, venue, address, city,
                          lat, lng, timezone, start_at, end_at, gate_open_at, gates, cancel_deadline_hours, require_id_match, email_text, created_by)
      SELECT ${slug}, ${name}, event_type, organizer, description, terms, banner_url, thumb_url, gallery, venue, address, city,
             lat, lng, timezone, start_at, end_at, gate_open_at, gates, cancel_deadline_hours, require_id_match, email_text, ${u.id}
      FROM events WHERE id = ${id}
      RETURNING id`;
    await tx`
      INSERT INTO ticket_categories (event_id, name, description, quota, claimed, open_at, close_at, sort_order, color, admit_batch, admit_interval_sec)
      SELECT ${n.id}, name, description, quota, 0, open_at, close_at, sort_order, color, admit_batch, admit_interval_sec
      FROM ticket_categories WHERE event_id = ${id}`;
    await audit({ actorId: u.id, action: "event.duplicate", entity: "event", entityId: n.id, after: { from: id, slug }, ip }, tx);
    return n.id;
  });
  return json({ ok: true, id: newId }, { status: 201 });
});
