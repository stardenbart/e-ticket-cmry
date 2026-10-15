import { z } from "zod";
import { sql } from "@/lib/db";
import { body, clientIp, json, route, ApiError } from "@/lib/http";
import { otpSchema, passwordSchema } from "@/lib/validation";
import { findAccount } from "@/lib/account";
import { verifyOtp } from "@/lib/otp";
import { hashPassword } from "@/lib/crypto";
import { rateLimit } from "@/lib/rate-limit";

const schema = z
  .object({ identifier: z.string().trim().max(254).optional(), email: z.string().trim().max(254).optional(), code: otpSchema, password: passwordSchema })
  .refine((d) => !!(d.identifier || d.email), { message: "NIK atau email wajib diisi.", path: ["identifier"] });

export const POST = route(async (req) => {
  await rateLimit(`reset:ip:${clientIp(req)}`, 30, 900);
  const d = await body(req, schema);
  const { user: u } = await findAccount(d.identifier || d.email || "");
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
