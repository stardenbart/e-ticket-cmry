import { z } from "zod";
import { body, clientIp, json, route } from "@/lib/http";
import { issueOtp } from "@/lib/otp";
import { cooldown, rateLimit } from "@/lib/rate-limit";
import { findAccount, maskEmail } from "@/lib/account";

// `identifier` = NIK karyawan atau email; `email` diterima dari form lama.
const schema = z
  .object({ identifier: z.string().trim().max(254).optional(), email: z.string().trim().max(254).optional() })
  .refine((d) => !!(d.identifier || d.email), { message: "NIK atau email wajib diisi.", path: ["identifier"] });

export const POST = route(async (req) => {
  const ip = clientIp(req);
  const d = await body(req, schema);
  const { key, user } = await findAccount(d.identifier || d.email || "");
  if (user) {
    await issueOtp({ userId: user.id, email: user.email, name: user.full_name, purpose: "RESET_PASSWORD", ip });
    return json({ ok: true, message: `Kode untuk mengatur ulang password sudah dikirim ke ${maskEmail(user.email)}.` });
  }
  // Perlakuan sama untuk akun yang tidak ada (batas permintaan tetap berlaku).
  await cooldown(`otp:RESET_PASSWORD:${key}`, 60, "Tunggu 60 detik sebelum meminta kode baru.");
  await rateLimit(`otp:email:${key}`, 5, 3600, "Batas permintaan kode tercapai. Coba lagi dalam 1 jam.");
  return json({ ok: true, message: "Jika akun terdaftar, kode untuk mengatur ulang password sudah dikirim ke emailnya." });
});
