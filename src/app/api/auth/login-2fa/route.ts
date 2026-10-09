import { z } from "zod";
import { sql } from "@/lib/db";
import { redis } from "@/lib/redis";
import { body, clientIp, json, route, ApiError } from "@/lib/http";
import { otpSchema } from "@/lib/validation";
import { verifyOtp } from "@/lib/otp";
import { createSession, type Role } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({ challengeId: z.string().uuid(), code: otpSchema });

export const POST = route(async (req) => {
  const ip = clientIp(req);
  await rateLimit(`2fa:ip:${ip}`, 30, 900);
  const d = await body(req, schema);
  const userId = await redis.get(`2fa:${d.challengeId}`);
  if (!userId) throw new ApiError(400, "CHALLENGE_EXPIRED", "Sesi login kedaluwarsa. Ulangi login.");
  await verifyOtp(userId, "LOGIN_2FA", d.code);
  await redis.del(`2fa:${d.challengeId}`);
  const [u] = await sql<{ role: Role }[]>`SELECT role FROM users WHERE id = ${userId} AND disabled_at IS NULL`;
  if (!u) throw new ApiError(401, "INVALID_CREDENTIALS", "Akun tidak aktif.");
  await createSession(userId, u.role, { ip, userAgent: req.headers.get("user-agent") ?? undefined });
  await audit({ actorId: userId, action: "auth.login", entity: "user", entityId: userId, ip });
  return json({ ok: true, role: u.role });
});
