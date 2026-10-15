import { z } from "zod";
import { sql, pgConstraint } from "@/lib/db";
import { body, clientIp, json, route, ApiError } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { findEmployee, nikIdentityHash } from "@/lib/employees";
import { validateNik } from "@/lib/employee-shared";

const schema = z.object({
  nik: z.string().trim().min(1, "NIK wajib diisi."),
  reason: z.string().trim().min(5, "Tulis alasan/permintaan koreksi (min. 5 karakter)."),
  applyToTickets: z.boolean().default(false),
});

/**
 * Koreksi NIK oleh admin (mis. peserta salah tautan NIK dan sudah punya tiket). Nama mengikuti daftar karyawan.
 * Tiket yang sudah terbit TIDAK berubah, kecuali admin memilih "terapkan ke tiket aktif". Tercatat di audit log.
 */
export const POST = route<{ id: string }>(async (req, ctx) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) throw new ApiError(404, "NOT_FOUND", "Pengguna tidak ditemukan.");
  const d = await body(req, schema);
  const v = validateNik(d.nik);
  if (!v.ok) throw new ApiError(400, "VALIDATION", v.message);
  const emp = await findEmployee(v.nik);
  if (!emp) throw new ApiError(404, "NOT_ELIGIBLE", "NIK tidak ada di daftar karyawan. Tambahkan dulu di menu Data Karyawan.");

  const res = await sql.begin(async (tx) => {
    const [u] = await tx<{ full_name: string; nik: string | null }[]>`SELECT full_name, nik FROM users WHERE id = ${id} FOR UPDATE`;
    if (!u) throw new ApiError(404, "NOT_FOUND", "Pengguna tidak ditemukan.");
    const hash = nikIdentityHash(emp.nik);
    try {
      await tx`UPDATE users SET nik = ${emp.nik}, full_name = ${emp.name}, id_type = 'NIK', identity_hash = ${hash}, id_last4 = ${emp.nik.slice(-4)} WHERE id = ${id}`;
    } catch (err) {
      if (pgConstraint(err) === "users_nik_uq") throw new ApiError(409, "NIK_TAKEN", "NIK ini sudah terhubung ke akun lain.");
      throw err;
    }
    let ticketsUpdated = 0;
    if (d.applyToTickets) {
      try {
        const r = await tx`
          UPDATE tickets SET holder_name = ${emp.name}, nik = ${emp.nik}, dept = ${emp.dept}, id_type = 'NIK',
            id_last4 = ${emp.nik.slice(-4)}, identity_hash = ${hash}
          WHERE user_id = ${id} AND status = 'ACTIVE'`;
        ticketsUpdated = r.count;
      } catch (err) {
        if (pgConstraint(err) === "tickets_event_identity_uq") throw new ApiError(409, "IDENTITY_ALREADY_USED", "NIK ini sudah dipakai tiket lain di event yang sama.");
        throw err;
      }
    }
    await audit(
      {
        actorId: admin.id,
        action: "user.nik_correction",
        entity: "user",
        entityId: id,
        before: { full_name: u.full_name, nik: u.nik },
        after: { full_name: emp.name, nik: emp.nik, reason: d.reason, applied_to_tickets: ticketsUpdated },
        ip: clientIp(req),
      },
      tx,
    );
    return { ticketsUpdated, name: emp.name };
  });
  return json({ ok: true, ...res });
});
