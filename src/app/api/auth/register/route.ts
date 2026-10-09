import { z } from "zod";
import { sql } from "@/lib/db";
import { body, clientIp, json, route, ApiError } from "@/lib/http";
import { emailSchema, nameSchema, passwordSchema } from "@/lib/validation";
import { hashPassword } from "@/lib/crypto";
import { issueOtp } from "@/lib/otp";
import { isDisposableEmail } from "@/lib/disposable";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  email: emailSchema,
  password: passwordSchema,
  fullName: nameSchema,
  agree: z.literal(true, { message: "Anda harus menyetujui S&K dan kebijakan privasi." }),
});

// Respons sama untuk email baru maupun yang sudah terdaftar, agar daftar akun tidak bisa ditebak.
const SAME = { ok: true, message: "Jika email valid, kode verifikasi sudah dikirim. Cek inbox (dan folder spam)." };

export const POST = route(async (req) => {
  const ip = clientIp(req);
  await rateLimit(`register:ip:${ip}`, 20, 3600);
  const d = await body(req, schema);
  if (await isDisposableEmail(d.email)) throw new ApiError(400, "DISPOSABLE_EMAIL", "Email dari layanan sekali pakai tidak diterima. Gunakan email pribadi atau kantor.");

  const [existing] = await sql<{ id: string; email_verified_at: Date | null }[]>`
    SELECT id, email_verified_at FROM users WHERE lower(email) = ${d.email}`;
  if (existing?.email_verified_at) return json(SAME);

  const hash = await hashPassword(d.password);
  let userId: string;
  if (existing) {
    // Akun belum terverifikasi: perbarui data & kirim ulang kode.
    await sql`UPDATE users SET password_hash = ${hash}, full_name = ${d.fullName}, terms_accepted_at = now() WHERE id = ${existing.id}`;
    userId = existing.id;
  } else {
    const [u] = await sql<{ id: string }[]>`
      INSERT INTO users (email, password_hash, full_name, terms_accepted_at)
      VALUES (${d.email}, ${hash}, ${d.fullName}, now())
      ON CONFLICT ((lower(email))) DO NOTHING RETURNING id`;
    if (!u) return json(SAME);
    userId = u.id;
  }
  try {
    await issueOtp({ userId, email: d.email, name: d.fullName, purpose: "VERIFY_EMAIL", ip });
  } catch (e) {
    if (e instanceof ApiError && (e.code === "COOLDOWN" || e.code === "RATE_LIMITED")) return json(SAME);
    throw e;
  }
  return json(SAME);
});
