import { z } from "zod";
import { sql } from "@/lib/db";
import { body, clientIp, json, route, ApiError } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { normalizeEmployee, saveEmployee } from "@/lib/admin/employees";

const schema = z.object({ nik: z.string(), name: z.string(), dept: z.string().default(""), category: z.string().default("") });

/** PUT /api/admin/employees/:nik — ubah data karyawan. */
export const PUT = route<{ nik: string }>(async (req, ctx) => {
  const u = await requireAdmin();
  const original = decodeURIComponent((await ctx.params).nik);
  const d = await body(req, schema);
  const n = normalizeEmployee(d);
  if (!n.ok) throw new ApiError(400, "VALIDATION", n.errors.join("; "));
  if (n.value.nik !== original) {
    const [taken] = await sql`SELECT 1 FROM employees WHERE nik = ${n.value.nik}`;
    if (taken) throw new ApiError(409, "DUPLICATE", "NIK baru sudah ada di daftar karyawan.");
  }
  const r = await sql.begin((tx) => saveEmployee(n.value, { actorId: u.id, originalNik: original, ip: clientIp(req) }, tx));
  if ("notFound" in r) throw new ApiError(404, "NOT_FOUND", "Karyawan tidak ditemukan.");
  if ("error" in r) throw new ApiError(409, "LINKED", String(r.error));
  // Nama akun yang tertaut mengikuti data karyawan (nama di tiket yang sudah terbit tidak berubah).
  await sql`UPDATE users SET full_name = ${n.value.name} WHERE nik = ${n.value.nik}`;
  return json({ ok: true, employee: n.value });
});

/** DELETE /api/admin/employees/:nik — hapus dari daftar eligible (ditolak bila sudah punya tiket aktif). */
export const DELETE = route<{ nik: string }>(async (req, ctx) => {
  const u = await requireAdmin();
  const nik = decodeURIComponent((await ctx.params).nik);
  const [ticket] = await sql`SELECT 1 FROM tickets WHERE nik = ${nik} AND status IN ('ACTIVE','CHECKED_IN') LIMIT 1`;
  if (ticket) throw new ApiError(409, "HAS_TICKET", "Karyawan ini sudah memegang tiket. Batalkan tiketnya dulu di menu Peserta.");
  const [before] = await sql`DELETE FROM employees WHERE nik = ${nik} RETURNING nik, name, dept, category`;
  if (!before) throw new ApiError(404, "NOT_FOUND", "Karyawan tidak ditemukan.");
  await audit({ actorId: u.id, action: "employee.delete", entity: "employee", entityId: nik, before, ip: clientIp(req) });
  return json({ ok: true });
});
