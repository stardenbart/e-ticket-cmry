import { redis } from "./redis";
import { ApiError } from "./http";

/** Fixed-window rate limit di Redis. Lempar 429 jika melebihi batas. */
export async function rateLimit(key: string, limit: number, windowSec: number, message?: string) {
  const k = `rl:${key}`;
  const n = await redis.incr(k);
  if (n === 1) await redis.expire(k, windowSec);
  if (n > limit) {
    const ttl = await redis.ttl(k);
    throw new ApiError(429, "RATE_LIMITED", message ?? `Terlalu banyak percobaan. Coba lagi dalam ${Math.max(ttl, 1)} detik.`, {
      retryAfter: ttl,
    });
  }
}

/** Cooldown: hanya boleh sekali per `sec` detik. */
export async function cooldown(key: string, sec: number, message: string) {
  const ok = await redis.set(`cd:${key}`, "1", "EX", sec, "NX");
  if (!ok) {
    const ttl = await redis.ttl(`cd:${key}`);
    throw new ApiError(429, "COOLDOWN", message, { retryAfter: ttl });
  }
}
