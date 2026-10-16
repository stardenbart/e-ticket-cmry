import { z } from "zod";
import { cookies } from "next/headers";
import { sql, pgConstraint } from "@/lib/db";
import { body, clientIp, json, route, ApiError } from "@/lib/http";
import { createSession } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { checkEligibility, nikIdentityHash } from "@/lib/employees";
import { GOOGLE_PENDING_COOKIE, dropPending, readPending } from "@/lib/google";

const schema = z.object({
  nik: z.string().trim().min(1, "NIK wajib diisi.").max(20),
  fullName: z.string().trim().min(1, "Nama wajib diisi sesuai Kartu Karyawan.").max(150),
  agree: z.literal(true, { message: "Anda harus menyetujui S&K dan kebijakan privasi." }),
});

const fieldError = (status: number, code: string, field: string, message: string) =>
  new ApiError(status, code, message, { fields: [{ path: field, message }] });

/** Selesaikan daftar dengan Google: isi NIK + nama, dicek ke daftar karyawan eligible. Tanpa password/kode. */
export const POST = route(async (req) => {
  const ip = clientIp(req);
  await rateLimit(`gcomplete:ip:${ip}`, 30, 3600);
  const jar = await cookies();
  const token = jar.get(GOOGLE_PENDING_COOKIE)?.value;
  const pending = await readPending(token);
  if (!token || !pending) throw new ApiError(400, "GOOGLE_PENDING_EXPIRED", "Sesi daftar dengan Google kedaluwarsa. Ulangi dari tombol Google.");
  const d = await body(req, schema);

  const elig = await checkEligibility(d.nik, d.fullName);
  if (!elig.ok) throw fieldError(elig.code === "NOT_ELIGIBLE" ? 403 : 400, elig.code, elig.field, elig.message);
  const emp = elig.employee;

  let userId: string;
  try {
    const [u] = await sql<{ id: string }[]>`
      INSERT INTO users (email, password_hash, full_name, nik, id_type, identity_hash, id_last4, google_sub, terms_accepted_at, email_verified_at)
      VALUES (${pending.email}, NULL, ${emp.name}, ${emp.nik}, 'NIK', ${nikIdentityHash(emp.nik)}, ${emp.nik.slice(-4)}, ${pending.sub}, now(), now())
      RETURNING id`;
    userId = u.id;
  } catch (e) {
    const c = pgConstraint(e);
    if (c === "users_nik_uq") throw fieldError(409, "NIK_TAKEN", "nik", "NIK ini sudah punya akun. Masuk dengan NIK + password, atau hubungi panitia.");
    if (c === "users_email_uq" || c === "users_google_sub_uq") throw new ApiError(409, "ACCOUNT_EXISTS", "Akun Google ini sudah terdaftar. Silakan masuk dengan Google.");
    throw e;
  }
  await dropPending(token);
  jar.delete(GOOGLE_PENDING_COOKIE);
  await createSession(userId, "ATTENDEE", { ip, userAgent: req.headers.get("user-agent") ?? undefined });
  return json({ ok: true, next: pending.next, name: emp.name });
});
