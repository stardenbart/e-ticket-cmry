import { z } from "zod";
import { sql, pgConstraint } from "../db";
import { ApiError } from "../http";
import { audit } from "../audit";
import { setRemaining } from "../quota";
import { zonedLocalToUtc } from "../format";
import type { CategoryRow } from "../events";
import { conflict, diff, loadEventOr404 } from "./events";

/** Jam buka tidak bisa diubah bila < 10 menit lagi kategori dibuka atau sedang dibuka. */
export const OPEN_LOCK_MS = 10 * 60 * 1000;

const localDt = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Format tanggal/jam tidak valid.");

export const categoryFields = z.object({
  name: z.string().trim().min(1, "Nama kategori wajib diisi.").max(60, "Nama kategori maksimal 60 karakter."),
  description: z.string().trim().max(500).default(""),
  quota: z.number().int("Kuota harus bilangan bulat.").min(1, "Kuota minimal 1.").max(1_000_000),
  open_local: localDt,
  close_local: localDt,
  sort_order: z.number().int().min(0).max(999).default(0),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Warna harus format #RRGGBB.").default("#1B3A6F"),
  admit_batch: z.number().int().min(1).max(10_000).default(50),
  admit_interval_sec: z.number().int().min(1).max(600).default(5),
  is_closed: z.boolean().optional(),
});

function checkTimes(open: Date, close: Date, eventStart: Date) {
  if (close <= open) throw new ApiError(400, "VALIDATION", "Jam tutup order harus setelah jam buka.");
  if (close >= eventStart) throw new ApiError(400, "VALIDATION", "Jam tutup order harus sebelum acara mulai.");
}

export async function createCategory(eventId: string, input: z.infer<typeof categoryFields>, actorId: string, ip?: string) {
  return sql.begin(async (tx) => {
    const e = await loadEventOr404(eventId, tx);
    if (e.status === "CANCELLED") throw new ApiError(409, "CANCELLED", "Event yang dibatalkan tidak bisa diubah.");
    const open = zonedLocalToUtc(input.open_local, e.timezone);
    const close = zonedLocalToUtc(input.close_local, e.timezone);
    checkTimes(open, close, e.start_at);
    const [c] = await tx<CategoryRow[]>`
      INSERT INTO ticket_categories (event_id, name, description, quota, open_at, close_at, sort_order, color, admit_batch, admit_interval_sec)
      VALUES (${eventId}, ${input.name}, ${input.description}, ${input.quota}, ${open}, ${close}, ${input.sort_order}, ${input.color},
              ${input.admit_batch}, ${input.admit_interval_sec})
      RETURNING *`;
    await audit(
      { actorId, action: "category.create", entity: "category", entityId: c.id, after: { event_id: eventId, name: c.name, quota: c.quota, open_at: open, close_at: close }, ip },
      tx,
    );
    return c;
  });
}

/**
 * Ubah kategori dengan aturan penguncian:
 *  - optimistic locking pada version
 *  - kuota boleh naik kapan saja; turun hanya sampai jumlah claimed (dicek atomik di UPDATE yang sama)
 *  - jam buka tidak bisa diubah < 10 menit sebelum buka atau saat sedang buka
 */
export async function updateCategory(
  eventId: string,
  categoryId: string,
  version: number,
  input: z.infer<typeof categoryFields>,
  actorId: string,
  ip?: string,
) {
  const out = await sql.begin(async (tx) => {
    const e = await loadEventOr404(eventId, tx);
    if (e.status === "CANCELLED") throw new ApiError(409, "CANCELLED", "Event yang dibatalkan tidak bisa diubah.");
    const [cur] = await tx<CategoryRow[]>`SELECT * FROM ticket_categories WHERE id = ${categoryId} AND event_id = ${eventId}`;
    if (!cur) throw new ApiError(404, "NOT_FOUND", "Kategori tidak ditemukan.");
    if (cur.version !== version) throw conflict();

    const open = zonedLocalToUtc(input.open_local, e.timezone);
    const close = zonedLocalToUtc(input.close_local, e.timezone);
    const now = Date.now();
    if (open.getTime() !== cur.open_at.getTime()) {
      const locked = now >= cur.open_at.getTime() - OPEN_LOCK_MS && now < cur.close_at.getTime();
      if (locked)
        throw new ApiError(409, "OPEN_AT_LOCKED", "Jam buka tidak bisa diubah kurang dari 10 menit sebelum kategori dibuka atau saat kategori sedang dibuka.");
      if (e.status === "PUBLISHED" && open.getTime() < now + OPEN_LOCK_MS)
        throw new ApiError(400, "VALIDATION", "Jam buka baru minimal 10 menit dari sekarang untuk event yang sudah dipublikasi.");
    }
    checkTimes(open, close, e.start_at);

    const next = {
      name: input.name,
      description: input.description,
      quota: input.quota,
      open_at: open,
      close_at: close,
      sort_order: input.sort_order,
      color: input.color,
      admit_batch: input.admit_batch,
      admit_interval_sec: input.admit_interval_sec,
      is_closed: input.is_closed ?? cur.is_closed,
    };
    const ch = diff(cur as unknown as Record<string, unknown>, next);
    if (!ch.changed) return { row: cur, changed: false };

    let row: CategoryRow | undefined;
    try {
      [row] = await tx<CategoryRow[]>`
        UPDATE ticket_categories SET
          name = ${next.name}, description = ${next.description}, quota = ${next.quota},
          open_at = ${next.open_at}, close_at = ${next.close_at}, sort_order = ${next.sort_order}, color = ${next.color},
          admit_batch = ${next.admit_batch}, admit_interval_sec = ${next.admit_interval_sec}, is_closed = ${next.is_closed},
          version = version + 1
        WHERE id = ${categoryId} AND version = ${version} AND ${next.quota} >= claimed
        RETURNING *`;
    } catch (err) {
      if (pgConstraint(err) === "categories_claimed_ck") throw quotaError(cur.claimed);
      throw err;
    }
    if (!row) {
      const [now2] = await tx<{ version: number; claimed: number }[]>`SELECT version, claimed FROM ticket_categories WHERE id = ${categoryId}`;
      if (now2 && now2.version !== version) throw conflict();
      throw quotaError(now2?.claimed ?? cur.claimed);
    }
    const action =
      "quota" in ch.after ? "category.quota_update" : "open_at" in ch.after || "close_at" in ch.after ? "category.schedule_update" : "is_closed" in ch.after ? "category.close_toggle" : "category.update";
    await audit({ actorId, action, entity: "category", entityId: categoryId, before: ch.before, after: ch.after, ip }, tx);
    return { row, changed: true };
  });
  await setRemaining(out.row.id, out.row.quota, out.row.claimed);
  return out.row;
}

function quotaError(claimed: number) {
  return new ApiError(409, "QUOTA_BELOW_CLAIMED", `Kuota tidak bisa diturunkan di bawah jumlah tiket yang sudah diklaim (${claimed}).`, { claimed });
}

/** Kategori yang sudah punya tiket tidak bisa dihapus — hanya ditutup. */
export async function deleteCategory(eventId: string, categoryId: string, version: number, actorId: string, ip?: string) {
  await sql.begin(async (tx) => {
    const [cur] = await tx<CategoryRow[]>`SELECT * FROM ticket_categories WHERE id = ${categoryId} AND event_id = ${eventId} FOR UPDATE`;
    if (!cur) throw new ApiError(404, "NOT_FOUND", "Kategori tidak ditemukan.");
    if (cur.version !== version) throw conflict();
    const [t] = await tx`SELECT 1 FROM tickets WHERE category_id = ${categoryId} LIMIT 1`;
    if (t) throw new ApiError(409, "HAS_TICKETS", "Kategori yang sudah punya tiket tidak bisa dihapus. Tutup kategorinya saja.");
    await tx`DELETE FROM ticket_categories WHERE id = ${categoryId}`;
    await audit({ actorId, action: "category.delete", entity: "category", entityId: categoryId, before: { name: cur.name, quota: cur.quota }, ip }, tx);
  });
}
