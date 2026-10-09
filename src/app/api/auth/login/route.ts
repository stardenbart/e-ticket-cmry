import crypto from "node:crypto";
import { z } from "zod";
import { sql } from "@/lib/db";
import { redis } from "@/lib/redis";
import { body, clientIp, json, route, ApiError } from "@/lib/http";
import { emailSchema } from "@/lib/validation";
import { verifyPassword } from "@/lib/crypto";
import { createSession, isStaffRole, type Role } from "@/lib/auth";
import { issueOtp } from "@/lib/otp";
import { rateLimit } from "@/lib/rate-limit";
import { env } from "@/lib/env";
import { audit } from "@/lib/audit";

const schema = z.object({ email: emailSchema, password: z.string().min(1, "Password wajib diisi.").max(128) });

export const POST = route(async (req) => {
  const ip = clientIp(req);
  const d = await body(req, schema);
  // 10 percobaan per 15 menit per akun dan per IP.
  await rateLimit(`login:ip:${ip}`, 10, 900);
  await rateLimit(`login:acct:${d.email}`, 10, 900);

  const [u] = await sql<{ id: string; full_name: string; password_hash: string | null; role: Role; email_verified_at: Date | null; disabled_at: Date | null }[]>`
    SELECT id, full_name, password_hash, role, email_verified_at, disabled_at FROM users WHERE lower(email) = ${d.email}`;
  const ok = await verifyPassword(d.password, u?.password_hash ?? null);
  if (!u || !ok || u.disabled_at) throw new ApiError(401, "INVALID_CREDENTIALS", "Email atau password salah.");

  if (!u.email_verified_at && !env.EMAIL_VERIFICATION) {
    await sql`UPDATE users SET email_verified_at = now() WHERE id = ${u.id}`;
  } else if (!u.email_verified_at) {
    try {
      await issueOtp({ userId: u.id, email: d.email, name: u.full_name, purpose: "VERIFY_EMAIL", ip });
    } catch {
      // cooldown: kode sebelumnya masih berlaku
    }
    return json({ ok: false, needVerify: true, message: "Email belum terverifikasi. Kami kirim kode verifikasi ke email Anda." });
  }

  // 2FA OTP email untuk admin & staf hanya bila STAFF_2FA=true (dimatikan atas permintaan penyelenggara).
  if (isStaffRole(u.role) && env.STAFF_2FA) {
    const challengeId = crypto.randomUUID();
    await redis.set(`2fa:${challengeId}`, u.id, "EX", 300);
    await issueOtp({ userId: u.id, email: d.email, name: u.full_name, purpose: "LOGIN_2FA", ip, enforceCooldown: false });
    return json({ ok: false, needOtp: true, challengeId, message: "Kode 2FA sudah dikirim ke email Anda." });
  }

  await createSession(u.id, u.role, { ip, userAgent: req.headers.get("user-agent") ?? undefined });
  if (isStaffRole(u.role)) await audit({ actorId: u.id, action: "auth.login", entity: "user", entityId: u.id, ip });
  return json({ ok: true, role: u.role });
});
