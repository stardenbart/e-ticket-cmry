import crypto from "node:crypto";
import { sql } from "./db";
import { redis, serverNowMs } from "./redis";
import { signToken, verifyToken } from "./crypto";
import { ApiError } from "./http";
import { getRemaining } from "./quota";
import { QUEUE_LEAD_MS, type CategoryRow } from "./events";

// Waiting room per kategori, di Redis.
//
// Antrean hanya mengatur SIAPA yang boleh mencoba klaim dan dalam urutan apa. Penjamin kuota tetap
// transaksi DB di claim.ts. Kunci:
//   q:pre:{cat}            SET  — user yang masuk pada jendela T-10..T0 (diacak saat T0)
//   q:{cat}                ZSET — user → skor urutan (pra-T0: acak < open_at; pasca-T0: waktu server masuk)
//   q:shuffled:{cat}       flag — pengacakan T0 sudah dilakukan
//   q:active:{event}:{uid} → category_id; satu posisi antrean aktif per akun per event
//   adm:{cat}:{uid}        → admission token yang sedang berlaku (TTL 5 menit)
//   adm:issued:{cat}:{uid} → penanda token pernah diterbitkan (untuk status EXPIRED)
//   adm:used:{jti}         → token sudah dipakai (SET NX, sekali pakai)

export const ADMISSION_TTL_SEC = 5 * 60;

type Cat = Pick<CategoryRow, "id" | "event_id" | "open_at" | "close_at" | "is_closed" | "admit_batch" | "admit_interval_sec" | "quota" | "claimed">;

export type AdmissionClaims = { uid: string; cid: string; eid: string; jti: string; exp: number };

export type QueueStatus =
  | { state: "NOT_IN_QUEUE" }
  | { state: "WAITING_PRE"; opensAt: number; serverNow: number }
  | { state: "WAITING"; position: number; etaSec: number; total: number; serverNow: number }
  | { state: "ADMITTED"; token: string; expiresAt: number; serverNow: number }
  | { state: "EXPIRED" }
  | { state: "SOLD_OUT" }
  | { state: "CLOSED" }
  | { state: "HAS_TICKET"; ticketId: string };

const K = {
  pre: (c: string) => `q:pre:${c}`,
  z: (c: string) => `q:${c}`,
  shuffled: (c: string) => `q:shuffled:${c}`,
  shuffling: (c: string) => `q:shuffling:${c}`,
  active: (e: string, u: string) => `q:active:${e}:${u}`,
  adm: (c: string, u: string) => `adm:${c}:${u}`,
  issued: (c: string, u: string) => `adm:issued:${c}:${u}`,
  used: (jti: string) => `adm:used:${jti}`,
};

/** TTL kunci antrean: sampai kategori tutup + 1 jam. */
const ttlFor = (cat: Cat, now: number) => Math.max(60, Math.ceil((cat.close_at.getTime() - now) / 1000) + 3600);

export async function loadCategory(categoryId: string): Promise<Cat> {
  const [c] = await sql<Cat[]>`
    SELECT c.id, c.event_id, c.open_at, c.close_at, c.is_closed, c.admit_batch, c.admit_interval_sec, c.quota, c.claimed
    FROM ticket_categories c JOIN events e ON e.id = c.event_id
    WHERE c.id = ${categoryId} AND e.status = 'PUBLISHED'`;
  if (!c) throw new ApiError(404, "NOT_FOUND", "Kategori tiket tidak ditemukan.");
  return c;
}

async function activeTicket(eventId: string, userId: string) {
  const [t] = await sql<{ id: string }[]>`
    SELECT id FROM tickets WHERE event_id = ${eventId} AND user_id = ${userId} AND status IN ('ACTIVE','CHECKED_IN')`;
  return t?.id ?? null;
}

/** Acak urutan semua yang masuk sebelum T0 (sekali per kategori, dikunci agar tidak paralel). */
async function ensureShuffled(cat: Cat, now: number) {
  const openAt = cat.open_at.getTime();
  if (now < openAt) return;
  if (await redis.exists(K.shuffled(cat.id))) return;
  const lock = await redis.set(K.shuffling(cat.id), "1", "PX", 10_000, "NX");
  if (!lock) {
    // Instance lain sedang mengacak; tunggu sebentar.
    for (let i = 0; i < 20 && !(await redis.exists(K.shuffled(cat.id))); i++) await new Promise((r) => setTimeout(r, 100));
    return;
  }
  try {
    const members = await redis.smembers(K.pre(cat.id));
    // Fisher–Yates dengan sumber acak kriptografis.
    for (let i = members.length - 1; i > 0; i--) {
      const j = crypto.randomInt(0, i + 1);
      [members[i], members[j]] = [members[j], members[i]];
    }
    if (members.length) {
      const n = members.length;
      const args: (string | number)[] = [];
      // Skor < open_at, sehingga selalu di depan yang masuk setelah T0.
      members.forEach((m, i) => args.push(openAt - n + i, m));
      await redis.zadd(K.z(cat.id), "NX", ...args);
    }
    await redis.set(K.shuffled(cat.id), "1", "EX", ttlFor(cat, now));
    await redis.expire(K.z(cat.id), ttlFor(cat, now));
  } finally {
    await redis.del(K.shuffling(cat.id));
  }
}

/** Jumlah orang (berdasar peringkat) yang sudah diloloskan: batch tiap interval sejak T0. */
function admittedCount(cat: Cat, now: number) {
  const openAt = cat.open_at.getTime();
  if (now < openAt) return 0;
  return (Math.floor((now - openAt) / (cat.admit_interval_sec * 1000)) + 1) * cat.admit_batch;
}

export async function joinQueue(userId: string, categoryId: string): Promise<QueueStatus> {
  const cat = await loadCategory(categoryId);
  const now = await serverNowMs();
  const openAt = cat.open_at.getTime();
  if (cat.is_closed || now >= cat.close_at.getTime()) throw new ApiError(409, "CLOSED", "Pemesanan kategori ini sudah ditutup.");
  if (now < openAt - QUEUE_LEAD_MS) throw new ApiError(409, "QUEUE_NOT_OPEN", "Antrean belum dibuka. Antrean dibuka 10 menit sebelum jam buka.");
  const rem = (await getRemaining([cat]))[cat.id];
  if (rem <= 0 && now >= openAt) throw new ApiError(409, "SOLD_OUT", "Kuota kategori ini sudah habis.");

  const ticketId = await activeTicket(cat.event_id, userId);
  if (ticketId) return { state: "HAS_TICKET", ticketId };

  const ttl = ttlFor(cat, now);
  const activeKey = K.active(cat.event_id, userId);
  const set = await redis.set(activeKey, cat.id, "EX", ttl, "NX");
  if (!set) {
    const current = await redis.get(activeKey);
    if (current && current !== cat.id) {
      throw new ApiError(409, "ALREADY_IN_QUEUE", "Anda sudah mengantre di kategori lain untuk event ini. Keluar dari antrean itu dulu.", {
        categoryId: current,
      });
    }
  }

  if (now < openAt) {
    await redis.sadd(K.pre(cat.id), userId);
    await redis.expire(K.pre(cat.id), ttl);
  } else {
    await ensureShuffled(cat, now);
    // NX: membuka tab kedua / refresh tidak mengubah posisi.
    await redis.zadd(K.z(cat.id), "NX", now, userId);
    await redis.expire(K.z(cat.id), ttl);
  }
  return queueStatus(userId, categoryId, cat, now);
}

export async function leaveQueue(userId: string, categoryId: string) {
  const cat = await loadCategory(categoryId);
  const activeKey = K.active(cat.event_id, userId);
  if ((await redis.get(activeKey)) === categoryId) await redis.del(activeKey);
  await redis.multi().srem(K.pre(cat.id), userId).zrem(K.z(cat.id), userId).del(K.adm(cat.id, userId)).exec();
}

/** Masuk ulang ke ujung antrean setelah admission token kedaluwarsa tanpa dipakai. */
export async function rejoinQueue(userId: string, categoryId: string) {
  const cat = await loadCategory(categoryId);
  await redis.multi().zrem(K.z(cat.id), userId).del(K.issued(cat.id, userId)).del(K.adm(cat.id, userId)).exec();
  await redis.del(K.active(cat.event_id, userId));
  return joinQueue(userId, categoryId);
}

export async function queueStatus(userId: string, categoryId: string, preloaded?: Cat, nowMs?: number): Promise<QueueStatus> {
  const cat = preloaded ?? (await loadCategory(categoryId));
  const now = nowMs ?? (await serverNowMs());
  const openAt = cat.open_at.getTime();

  const ticketId = await activeTicket(cat.event_id, userId);
  if (ticketId) {
    await redis.del(K.active(cat.event_id, userId));
    return { state: "HAS_TICKET", ticketId };
  }
  if (cat.is_closed || now >= cat.close_at.getTime()) {
    await redis.del(K.active(cat.event_id, userId));
    return { state: "CLOSED" };
  }

  const inPre = await redis.sismember(K.pre(cat.id), userId);
  if (now < openAt) {
    return inPre ? { state: "WAITING_PRE", opensAt: openAt, serverNow: now } : { state: "NOT_IN_QUEUE" };
  }

  await ensureShuffled(cat, now);
  let rank = await redis.zrank(K.z(cat.id), userId);
  if (rank == null && inPre) {
    // Masuk tepat saat pengacakan berlangsung.
    await redis.zadd(K.z(cat.id), "NX", openAt, userId);
    rank = await redis.zrank(K.z(cat.id), userId);
  }
  if (rank == null) return { state: "NOT_IN_QUEUE" };

  // Kuota tercatat habis → antrean ditutup, yang menunggu langsung diberi tahu.
  const rem = (await getRemaining([cat]))[cat.id];
  const existing = await redis.get(K.adm(cat.id, userId));
  if (rem <= 0 && !existing) {
    await redis.del(K.active(cat.event_id, userId));
    return { state: "SOLD_OUT" };
  }

  const admitted = admittedCount(cat, now);
  if (rank < admitted) {
    if (existing) {
      const claims = verifyToken<AdmissionClaims>(existing);
      return { state: "ADMITTED", token: existing, expiresAt: claims?.exp ?? now, serverNow: now };
    }
    if (await redis.exists(K.issued(cat.id, userId))) return { state: "EXPIRED" };
    const exp = now + ADMISSION_TTL_SEC * 1000;
    const token = signToken({ uid: userId, cid: cat.id, eid: cat.event_id, jti: crypto.randomUUID(), exp } satisfies AdmissionClaims);
    const ok = await redis.set(K.adm(cat.id, userId), token, "EX", ADMISSION_TTL_SEC, "NX");
    if (!ok) return queueStatus(userId, categoryId, cat, now);
    await redis.set(K.issued(cat.id, userId), "1", "EX", ttlFor(cat, now));
    return { state: "ADMITTED", token, expiresAt: exp, serverNow: now };
  }

  const ahead = rank - admitted + 1;
  const intervalMs = cat.admit_interval_sec * 1000;
  const sinceTick = (now - openAt) % intervalMs;
  const etaSec = Math.ceil((Math.ceil(ahead / cat.admit_batch) * intervalMs - sinceTick) / 1000);
  const total = await redis.zcard(K.z(cat.id));
  return { state: "WAITING", position: ahead, etaSec: Math.max(etaSec, 1), total, serverNow: now };
}

/**
 * Validasi admission token lalu tandai terpakai secara atomik (SET NX) sebelum transaksi klaim.
 * Mengembalikan klaim token, atau melempar bila tidak valid / sudah dipakai.
 */
export async function consumeAdmission(token: string, userId: string, categoryId: string): Promise<AdmissionClaims> {
  const claims = verifyToken<AdmissionClaims>(token);
  if (!claims || claims.uid !== userId || claims.cid !== categoryId) {
    throw new ApiError(403, "INVALID_ADMISSION", "Token antrean tidak valid. Silakan masuk antrean lagi.");
  }
  const now = await serverNowMs();
  if (claims.exp < now) throw new ApiError(403, "ADMISSION_EXPIRED", "Waktu klaim Anda (5 menit) sudah habis. Silakan masuk antrean lagi.");
  const ok = await redis.set(K.used(claims.jti), "1", "EX", ADMISSION_TTL_SEC * 2, "NX");
  if (!ok) throw new ApiError(409, "ADMISSION_USED", "Token antrean sudah dipakai.");
  return claims;
}

export async function clearQueueState(eventId: string, categoryId: string, userId: string) {
  await redis.multi().del(K.active(eventId, userId)).del(K.adm(categoryId, userId)).exec();
}

export async function activeQueueCategory(eventId: string, userId: string) {
  return redis.get(K.active(eventId, userId));
}

/** Panjang antrean per kategori (untuk dashboard / observability). */
export async function queueLength(categoryId: string) {
  const [z, p] = await Promise.all([redis.zcard(K.z(categoryId)), redis.scard(K.pre(categoryId))]);
  return Math.max(z, p);
}
