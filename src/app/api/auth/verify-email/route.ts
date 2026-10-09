import { z } from "zod";
import { sql } from "@/lib/db";
import { body, clientIp, json, route, ApiError } from "@/lib/http";
import { emailSchema, otpSchema } from "@/lib/validation";
import { verifyOtp } from "@/lib/otp";
import { createSession, type Role } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({ email: emailSchema, code: otpSchema });

export const POST = route(async (req) => {
  const ip = clientIp(req);
  await rateLimit(`verify:ip:${ip}`, 30, 900);
  const d = await body(req, schema);
  const [u] = await sql<{ id: string; role: Role; email_verified_at: Date | null }[]>`
    SELECT id, role, email_verified_at FROM users WHERE lower(email) = ${d.email}`;
  if (!u || u.email_verified_at) throw new ApiError(400, "OTP_NOT_FOUND", "Kode tidak ditemukan atau sudah hangus. Minta kode baru.");
  await verifyOtp(u.id, "VERIFY_EMAIL", d.code);
  await sql`UPDATE users SET email_verified_at = now() WHERE id = ${u.id}`;
  await createSession(u.id, u.role, { ip, userAgent: req.headers.get("user-agent") ?? undefined });
  return json({ ok: true });
});
