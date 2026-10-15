import { z } from "zod";
import { sql, pgConstraint } from "@/lib/db";
import { body, json, route, ApiError } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { checkEligibility, findEmployee, nikIdentityHash } from "@/lib/employees";

const schema = z.object({
  nik: z.string().trim().min(1, "NIK wajib diisi.").max(20),
  fullName: z.string().trim().min(1, "Nama wajib diisi sesuai KTP.").max(150),
});

const hasActiveTicket = async (userId: string) =>
  !!(await sql`SELECT 1 FROM tickets WHERE user_id = ${userId} AND status IN ('ACTIVE','CHECKED_IN') LIMIT 1`)[0];

/**
 * Tautkan akun ke NIK karyawan (untuk akun yang belum punya NIK, atau koreksi sebelum klaim).
 * NIK + nama dicek ke daftar karyawan; nama akun mengikuti data resmi. Terkunci bila sudah ada tiket aktif.
 */
export const PUT = route(async (req) => {
  const u = await requireUser();
  const d = await body(req, schema);
  if (await hasActiveTicket(u.id))
    throw new ApiError(409, "PROFILE_LOCKED", "Data terkunci karena Anda memegang tiket aktif. Hubungi admin untuk perubahan.");

  const elig = await checkEligibility(d.nik, d.fullName);
  if (!elig.ok) throw new ApiError(elig.code === "NOT_ELIGIBLE" ? 403 : 400, elig.code, elig.message, { fields: [{ path: elig.field, message: elig.message }] });
  const emp = elig.employee;
  try {
    await sql`
      UPDATE users SET nik = ${emp.nik}, full_name = ${emp.name}, id_type = 'NIK',
        identity_hash = ${nikIdentityHash(emp.nik)}, id_last4 = ${emp.nik.slice(-4)}
      WHERE id = ${u.id}`;
  } catch (e) {
    if (pgConstraint(e) === "users_nik_uq")
      throw new ApiError(409, "NIK_TAKEN", "NIK ini sudah terhubung ke akun lain. Hubungi panitia.", { fields: [{ path: "nik", message: "NIK sudah dipakai akun lain." }] });
    throw e;
  }
  return json({ ok: true, name: emp.name, dept: emp.dept, category: emp.category });
});

export const GET = route(async () => {
  const u = await requireUser();
  const emp = u.nik ? await findEmployee(u.nik) : null;
  return json({
    email: u.email,
    nik: u.nik,
    fullName: u.full_name,
    dept: emp?.dept ?? null,
    category: emp?.category ?? null,
    eligible: !!emp,
    locked: await hasActiveTicket(u.id),
  });
});
