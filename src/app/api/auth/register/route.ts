import { z } from "zod";
import { sql, pgConstraint } from "@/lib/db";
import { body, clientIp, json, route, ApiError } from "@/lib/http";
import { emailSchema, passwordSchema } from "@/lib/validation";
import { hashPassword } from "@/lib/crypto";
import { issueOtp } from "@/lib/otp";
import { isDisposableEmail } from "@/lib/disposable";
import { rateLimit } from "@/lib/rate-limit";
import { env } from "@/lib/env";
import { createSession } from "@/lib/auth";
import { checkEligibility, nikIdentityHash } from "@/lib/employees";
import { validatePhone } from "@/lib/employee-shared";

const schema = z.object({
  nik: z.string().trim().min(1, "NIK wajib diisi.").max(24),
  fullName: z.string().trim().min(1, "Nama wajib diisi sesuai Kartu Karyawan.").max(150),
  phone: z.string().trim().min(1, "Nomor HP wajib diisi.").max(20),
  email: emailSchema,
  password: passwordSchema,
  agree: z.literal(true, { message: "Anda harus menyetujui S&K dan kebijakan privasi." }),
});

const fieldError = (status: number, code: string, field: string, message: string) =>
  new ApiError(status, code, message, { fields: [{ path: field, message }] });

/**
 * Daftar akun dengan NIK karyawan atau NIK KTP (cukup salah satu). NIK + nama dicek ke daftar karyawan eligible; satu NIK = satu akun.
 * Nama di akun selalu diambil dari daftar karyawan (sumber resmi), bukan dari ketikan pengguna.
 */
export const POST = route(async (req) => {
  const ip = clientIp(req);
  await rateLimit(`register:ip:${ip}`, 20, 3600);
  const d = await body(req, schema);

  const elig = await checkEligibility(d.nik, d.fullName);
  if (!elig.ok) throw fieldError(elig.code === "NOT_ELIGIBLE" ? 403 : 400, elig.code, elig.field, elig.message);
  const emp = elig.employee;
  const ph = validatePhone(d.phone);
  if (!ph.ok) throw fieldError(400, "INVALID_PHONE", "phone", ph.message);

  if (await isDisposableEmail(d.email)) {
    throw fieldError(400, "DISPOSABLE_EMAIL", "email", "Email dari layanan sekali pakai tidak diterima. Gunakan email pribadi atau kantor.");
  }

  const [byNik] = await sql<{ id: string; email_verified_at: Date | null }[]>`SELECT id, email_verified_at FROM users WHERE nik = ${emp.nik}`;
  if (byNik?.email_verified_at) {
    throw fieldError(409, "NIK_TAKEN", "nik", "Karyawan dengan NIK ini sudah punya akun. Silakan masuk, atau pakai Lupa Password.");
  }
  const [byEmail] = await sql<{ id: string; nik: string | null; email_verified_at: Date | null }[]>`
    SELECT id, nik, email_verified_at FROM users WHERE lower(email) = ${d.email}`;
  if (byEmail && byEmail.id !== byNik?.id && (byEmail.email_verified_at || byEmail.nik)) {
    throw fieldError(409, "EMAIL_TAKEN", "email", "Email ini sudah dipakai akun lain. Gunakan email lain.");
  }

  const hash = await hashPassword(d.password);
  const verifiedNow = !env.EMAIL_VERIFICATION;
  const existingId = byNik?.id ?? byEmail?.id ?? null;
  let userId: string;
  try {
    const [u] = existingId
      ? await sql<{ id: string }[]>`
          UPDATE users SET email = ${d.email}, password_hash = ${hash}, full_name = ${emp.name}, nik = ${emp.nik}, phone = ${ph.phone},
            id_type = 'NIK', identity_hash = ${nikIdentityHash(emp.nik)}, id_last4 = ${emp.nik.slice(-4)},
            terms_accepted_at = now(), email_verified_at = ${verifiedNow ? sql`now()` : sql`email_verified_at`}
          WHERE id = ${existingId} RETURNING id`
      : await sql<{ id: string }[]>`
          INSERT INTO users (email, password_hash, full_name, nik, phone, id_type, identity_hash, id_last4, terms_accepted_at, email_verified_at)
          VALUES (${d.email}, ${hash}, ${emp.name}, ${emp.nik}, ${ph.phone}, 'NIK', ${nikIdentityHash(emp.nik)}, ${emp.nik.slice(-4)}, now(),
                  ${verifiedNow ? sql`now()` : null})
          RETURNING id`;
    userId = u.id;
  } catch (e) {
    const c = pgConstraint(e);
    if (c === "users_nik_uq") throw fieldError(409, "NIK_TAKEN", "nik", "Karyawan dengan NIK ini sudah punya akun. Silakan masuk.");
    if (c === "users_email_uq") throw fieldError(409, "EMAIL_TAKEN", "email", "Email ini sudah dipakai akun lain. Gunakan email lain.");
    throw e;
  }

  if (verifiedNow) {
    await createSession(userId, "ATTENDEE", { ip, userAgent: req.headers.get("user-agent") ?? undefined });
    return json({ ok: true, verified: true, name: emp.name });
  }
  try {
    await issueOtp({ userId, email: d.email, name: emp.name, purpose: "VERIFY_EMAIL", ip });
  } catch (e) {
    if (!(e instanceof ApiError && (e.code === "COOLDOWN" || e.code === "RATE_LIMITED"))) throw e;
  }
  return json({ ok: true, verified: false, message: "Kode verifikasi sudah dikirim ke email Anda." });
});
