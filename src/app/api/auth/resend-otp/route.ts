import { z } from "zod";
import { sql } from "@/lib/db";
import { body, clientIp, json, route } from "@/lib/http";
import { emailSchema } from "@/lib/validation";
import { issueOtp } from "@/lib/otp";
import { cooldown, rateLimit } from "@/lib/rate-limit";

const schema = z.object({ email: emailSchema, purpose: z.enum(["VERIFY_EMAIL", "RESET_PASSWORD"]) });

export const POST = route(async (req) => {
  const ip = clientIp(req);
  const d = await body(req, schema);
  const [u] = await sql<{ id: string; full_name: string; email_verified_at: Date | null }[]>`
    SELECT id, full_name, email_verified_at FROM users WHERE lower(email) = ${d.email} AND disabled_at IS NULL`;
  const eligible = u && (d.purpose === "RESET_PASSWORD" || !u.email_verified_at);
  if (eligible) {
    // Cooldown & rate limit tetap dilempar ke klien (tidak membocorkan keberadaan akun karena berlaku per email).
    await issueOtp({ userId: u.id, email: d.email, name: u.full_name, purpose: d.purpose, ip });
  } else {
    await cooldown(`otp:${d.purpose}:${d.email}`, 60, "Tunggu 60 detik sebelum meminta kode baru.");
    await rateLimit(`otp:email:${d.email}`, 5, 3600, "Batas permintaan kode untuk email ini tercapai. Coba lagi dalam 1 jam.");
  }
  return json({ ok: true, message: "Jika email terdaftar, kode baru sudah dikirim." });
});
