import { sql } from "./db";
import { redis } from "./redis";

// Cache sisa kuota di Redis. Hanya untuk tampilan — tidak pernah dipakai untuk memutuskan hasil klaim.
// Diperbarui setelah commit (klaim, batal, ubah kuota) dan kedaluwarsa sendiri agar bisa pulih dari selisih.
const TTL_SEC = 30;
const key = (categoryId: string) => `rem:${categoryId}`;

export async function setRemaining(categoryId: string, quota: number, claimed: number) {
  await redis.set(key(categoryId), String(Math.max(quota - claimed, 0)), "EX", TTL_SEC);
}

/** Sisa kuota per kategori; yang belum ada di cache diambil dari DB lalu disimpan. */
export async function getRemaining(cats: { id: string; quota?: number; claimed?: number }[]): Promise<Record<string, number>> {
  if (!cats.length) return {};
  const vals = await redis.mget(cats.map((c) => key(c.id)));
  const out: Record<string, number> = {};
  const missing: string[] = [];
  cats.forEach((c, i) => {
    if (vals[i] != null) out[c.id] = Number(vals[i]);
    else missing.push(c.id);
  });
  if (missing.length) {
    const rows = await sql<{ id: string; quota: number; claimed: number }[]>`
      SELECT id, quota, claimed FROM ticket_categories WHERE id IN ${sql(missing)}`;
    const pipe = redis.pipeline();
    for (const r of rows) {
      out[r.id] = Math.max(r.quota - r.claimed, 0);
      pipe.set(key(r.id), String(out[r.id]), "EX", TTL_SEC);
    }
    await pipe.exec();
  }
  return out;
}

export async function refreshRemainingFromDb(categoryId: string) {
  const [r] = await sql<{ quota: number; claimed: number }[]>`SELECT quota, claimed FROM ticket_categories WHERE id = ${categoryId}`;
  if (r) await setRemaining(categoryId, r.quota, r.claimed);
}
