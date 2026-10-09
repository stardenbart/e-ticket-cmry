import { z } from "zod";
import { sql } from "@/lib/db";
import { body, clientIp, json, route, ApiError } from "@/lib/http";
import { emailSchema, otpSchema, passwordSchema } from "@/lib/validation";
import { verifyOtp } from "@/lib/otp";
import { hashPassword } from "@/lib/crypto";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({ email: emailSchema, code: otpSchema, password: passwordSchema });

export const POST = route(async (req) => {
  await rateLimit(`reset:ip:${clientIp(req)}`, 30, 900);
  const d = await body(req, schema);
  const [u] = await sql<{ id: string }[]>`SELECT id FROM users WHERE lower(email) = ${d.email} AND disabled_at IS NULL`;
  if (!u) throw new ApiError(400, "OTP_NOT_FOUND", "Kode tidak ditemukan atau sudah hangus. Minta kode baru.");
  await verifyOtp(u.id, "RESET_PASSWORD", d.code);
  const hash = await hashPassword(d.password);
  await sql.begin(async (tx) => {
    // Kode reset dikirim ke email → sekaligus membuktikan kepemilikan email.
    await tx`UPDATE users SET password_hash = ${hash}, email_verified_at = coalesce(email_verified_at, now()) WHERE id = ${u.id}`;
    await tx`DELETE FROM sessions WHERE user_id = ${u.id}`;
  });
  return json({ ok: true, message: "Password berhasil diubah. Silakan login." });
});
