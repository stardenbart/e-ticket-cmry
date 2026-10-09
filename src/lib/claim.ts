import { sql, pgConstraint, withTxRetry } from "./db";
import { redis } from "./redis";
import { ApiError } from "./http";
import { verifyToken } from "./crypto";
import { enqueue } from "./outbox";
import { setRemaining } from "./quota";
import { clearQueueState, consumeAdmission } from "./queue";

export type ClaimCode = "SUCCESS" | "SOLD_OUT" | "CLOSED" | "ALREADY_HAS_TICKET" | "IDENTITY_ALREADY_USED" | "PROFILE_INCOMPLETE";

export type ClaimResult = { code: ClaimCode; ticketId?: string; message: string };

const MESSAGES: Record<ClaimCode, string> = {
  SUCCESS: "Tiket berhasil diklaim. QR juga sudah dikirim ke email Anda.",
  SOLD_OUT: "Maaf, kuota kategori ini sudah habis.",
  CLOSED: "Pemesanan kategori ini sedang tidak dibuka.",
  ALREADY_HAS_TICKET: "Anda sudah memegang tiket untuk event ini.",
  IDENTITY_ALREADY_USED: "Nomor identitas Anda sudah dipakai untuk tiket lain di event ini.",
  PROFILE_INCOMPLETE: "Lengkapi profil identitas Anda sebelum klaim tiket.",
};

const IDEM_TTL_SEC = 15 * 60;

class ClaimFail extends Error {
  constructor(public code: ClaimCode) {
    super(code);
  }
}

const result = (code: ClaimCode, ticketId?: string): ClaimResult => ({ code, ticketId, message: MESSAGES[code] });

async function ticketForUser(eventId: string, userId: string) {
  const [t] = await sql<{ id: string }[]>`
    SELECT id FROM tickets WHERE event_id = ${eventId} AND user_id = ${userId} AND status IN ('ACTIVE','CHECKED_IN')`;
  return t?.id;
}

/**
 * Klaim atomik.
 *
 * Satu transaksi PostgreSQL (READ COMMITTED):
 *   (a) UPDATE kategori SET claimed = claimed + 1 WHERE claimed < quota AND jendela buka (jam DB)
 *       — baris dikunci; transaksi yang bersamaan menunggu lalu mengevaluasi ulang kondisi, jadi
 *         slot terakhir hanya jatuh ke satu transaksi.
 *   (b) INSERT tiket — partial unique index menolak tiket kedua per akun / per identitas.
 *   (c) INSERT outbox email — di transaksi yang sama.
 * Gagal di mana pun → seluruh transaksi rollback, penghitung kuota tidak pernah bocor.
 *
 * Ini SATU-SATUNYA jalur pembuatan tiket.
 */
export async function claimTicket(opts: {
  userId: string;
  categoryId: string;
  admissionToken: string;
  idempotencyKey: string;
}): Promise<ClaimResult> {
  const { userId, categoryId, idempotencyKey } = opts;
  const idemKey = `idem:${userId}:${idempotencyKey}`;

  // 1. Idempoten: percobaan yang sama mengembalikan hasil yang sama.
  const [prior] = await sql<{ id: string; user_id: string }[]>`SELECT id, user_id FROM tickets WHERE idempotency_key = ${idempotencyKey}`;
  if (prior) {
    if (prior.user_id !== userId) throw new ApiError(409, "IDEMPOTENCY_CONFLICT", "Kunci permintaan sudah dipakai.");
    return result("SUCCESS", prior.id);
  }
  const cached = await redis.get(idemKey);
  if (cached) return JSON.parse(cached) as ClaimResult;

  const lock = await redis.set(`${idemKey}:lock`, "1", "EX", 30, "NX");
  if (!lock) {
    for (let i = 0; i < 50; i++) {
      await new Promise((r) => setTimeout(r, 100));
      const r = await redis.get(idemKey);
      if (r) return JSON.parse(r) as ClaimResult;
      // Pemegang lock selesai tanpa hasil tersimpan (mis. error) → coba lagi sebagai pemegang lock.
      if (!(await redis.exists(`${idemKey}:lock`))) return claimTicket(opts);
    }
    throw new ApiError(409, "IN_PROGRESS", "Permintaan klaim sebelumnya masih diproses.");
  }

  try {
    // 2. Admission token: cek & tandai terpakai secara atomik sebelum transaksi.
    let claims;
    try {
      claims = await consumeAdmission(opts.admissionToken, userId, categoryId);
    } catch (e) {
      if (e instanceof ApiError && e.code === "ADMISSION_USED") {
        // Tab lain / retry dengan token yang sama — tunggu hasil percobaan pertama.
        const verified = verifyToken<{ eid: string }>(opts.admissionToken);
        if (verified) {
          for (let i = 0; i < 30; i++) {
            const t = await ticketForUser(verified.eid, userId);
            if (t) {
              const out = result("ALREADY_HAS_TICKET", t);
              await redis.set(idemKey, JSON.stringify(out), "EX", IDEM_TTL_SEC);
              return out;
            }
            await new Promise((r) => setTimeout(r, 100));
          }
        }
      }
      throw e;
    }

    // Jalur cepat: kategori sudah penuh menurut DB (baca tanpa lock) → tolak tanpa membuka transaksi
    // dan tanpa antre di row lock. Hanya bisa menolak; penerbitan tiket tetap lewat transaksi di bawah.
    const [pre] = await sql<{ quota: number; claimed: number; open: boolean }[]>`
      SELECT quota, claimed, (NOT is_closed AND now() >= open_at AND now() < close_at) AS open
      FROM ticket_categories WHERE id = ${categoryId}`;
    if (pre && pre.open && pre.claimed >= pre.quota) {
      const out = result("SOLD_OUT");
      await setRemaining(categoryId, pre.quota, pre.claimed);
      await clearQueueState(claims.eid, categoryId, userId);
      await redis.set(idemKey, JSON.stringify(out), "EX", IDEM_TTL_SEC);
      return out;
    }

    // 3. Transaksi atomik.
    let out: ClaimResult;
    let quotaAfter: { quota: number; claimed: number } | null = null;
    try {
      const ticketId = await withTxRetry(() => sql.begin(async (tx) => {
        const [u] = await tx<{ full_name: string; id_type: string | null; identity_hash: string | null; id_last4: string | null; email_verified_at: Date | null }[]>`
          SELECT full_name, id_type, identity_hash, id_last4, email_verified_at FROM users WHERE id = ${userId} AND disabled_at IS NULL`;
        if (!u || !u.email_verified_at || !u.id_type || !u.identity_hash || !u.full_name) throw new ClaimFail("PROFILE_INCOMPLETE");

        // (a) Ambil slot. Waktu buka/tutup dievaluasi dengan jam DB, bukan jam klien.
        const [cat] = await tx<{ event_id: string; quota: number; claimed: number }[]>`
          UPDATE ticket_categories c
          SET claimed = c.claimed + 1
          FROM events e
          WHERE c.id = ${categoryId}
            AND e.id = c.event_id AND e.id = ${claims.eid} AND e.status = 'PUBLISHED'
            AND c.claimed < c.quota
            AND NOT c.is_closed
            AND now() >= c.open_at AND now() < c.close_at
          RETURNING c.event_id, c.quota, c.claimed`;
        if (!cat) {
          const [c] = await tx<{ quota: number; claimed: number; open: boolean }[]>`
            SELECT c.quota, c.claimed,
                   (NOT c.is_closed AND now() >= c.open_at AND now() < c.close_at AND e.status = 'PUBLISHED') AS open
            FROM ticket_categories c JOIN events e ON e.id = c.event_id WHERE c.id = ${categoryId}`;
          if (c) quotaAfter = { quota: c.quota, claimed: c.claimed };
          throw new ClaimFail(c && c.open && c.claimed >= c.quota ? "SOLD_OUT" : "CLOSED");
        }
        quotaAfter = { quota: cat.quota, claimed: cat.claimed };

        // (b) Buat tiket. Unique index menolak tiket kedua.
        const [t] = await tx<{ id: string }[]>`
          INSERT INTO tickets (event_id, category_id, user_id, identity_hash, holder_name, id_type, id_last4, status, idempotency_key)
          VALUES (${cat.event_id}, ${categoryId}, ${userId}, ${u.identity_hash}, ${u.full_name}, ${u.id_type}, ${u.id_last4},
                  'ACTIVE', ${idempotencyKey})
          RETURNING id`;

        // (c) Email lewat outbox, di transaksi yang sama.
        await enqueue("TICKET_ISSUED", { ticketId: t.id }, tx);
        return t.id;
      }));
      out = result("SUCCESS", ticketId);
    } catch (e) {
      if (e instanceof ClaimFail) out = result(e.code);
      else {
        const c = pgConstraint(e);
        if (c === "tickets_event_user_uq") out = result("ALREADY_HAS_TICKET", await ticketForUser(claims.eid, userId));
        else if (c === "tickets_event_identity_uq") out = result("IDENTITY_ALREADY_USED");
        else if (c === "tickets_idem_uq") {
          const [t] = await sql<{ id: string }[]>`SELECT id FROM tickets WHERE idempotency_key = ${idempotencyKey}`;
          out = result("SUCCESS", t?.id);
        } else if (c === "categories_claimed_ck") out = result("SOLD_OUT");
        else throw e;
        // Transaksi rollback → baca ulang angka kuota untuk cache.
        quotaAfter = null;
      }
    }

    // 4. Setelah commit: perbarui cache sisa kuota & bersihkan state antrean.
    if (quotaAfter) {
      const q = quotaAfter as { quota: number; claimed: number };
      await setRemaining(categoryId, q.quota, q.claimed);
    } else {
      const [r] = await sql<{ quota: number; claimed: number }[]>`SELECT quota, claimed FROM ticket_categories WHERE id = ${categoryId}`;
      if (r) await setRemaining(categoryId, r.quota, r.claimed);
    }
    if (out.code !== "CLOSED") await clearQueueState(claims.eid, categoryId, userId);
    await redis.set(idemKey, JSON.stringify(out), "EX", IDEM_TTL_SEC);
    return out;
  } finally {
    await redis.del(`${idemKey}:lock`);
  }
}
