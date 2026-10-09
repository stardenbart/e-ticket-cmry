import Redis from "ioredis";
import { env } from "./env";

const g = globalThis as unknown as { __redis?: Redis };

export const redis: Redis =
  g.__redis ?? (g.__redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 2, lazyConnect: true }));

/** Waktu server otoritatif (ms) dari Redis, supaya semua instance aplikasi memakai jam yang sama. */
export async function serverNowMs(): Promise<number> {
  const [s, us] = await redis.time();
  return Number(s) * 1000 + Math.floor(Number(us) / 1000);
}
