import { z } from "zod";
import { sql } from "@/lib/db";
import { body, clientIp, json, route } from "@/lib/http";
import { emailSchema } from "@/lib/validation";
import { issueOtp } from "@/lib/otp";
import { cooldown, rateLimit } from "@/lib/rate-limit";

const schema = z.object({ email: emailSchema });

export const POST = route(async (req) => {
  const ip = clientIp(req);
  const d = await body(req, schema);
  const [u] = await sql<{ id: string; full_name: string }[]>`
    SELECT id, full_name FROM users WHERE lower(email) = ${d.email} AND disabled_at IS NULL`;
  if (u) await issueOtp({ userId: u.id, email: d.email, name: u.full_name, purpose: "RESET_PASSWORD", ip });
  else {
    // Perlakuan sama untuk email yang tidak terdaftar.
    await cooldown(`otp:RESET_PASSWORD:${d.email}`, 60, "Tunggu 60 detik sebelum meminta kode baru.");
    await rateLimit(`otp:email:${d.email}`, 5, 3600, "Batas permintaan kode untuk email ini tercapai. Coba lagi dalam 1 jam.");
  }
  return json({ ok: true, message: "Jika email terdaftar, kode untuk mengatur ulang password sudah dikirim." });
});
