import { z } from "zod";
import { sql } from "@/lib/db";
import { body, json, route, ApiError } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { identityHash } from "@/lib/crypto";
import { ID_TYPES, nameSchema, validateIdNumber } from "@/lib/validation";

const schema = z.object({
  fullName: nameSchema,
  idType: z.enum(ID_TYPES, { message: "Pilih jenis identitas." }),
  idNumber: z.string().trim().min(1, "Nomor identitas wajib diisi."),
});

const hasActiveTicket = async (userId: string) =>
  !!(await sql`SELECT 1 FROM tickets WHERE user_id = ${userId} AND status IN ('ACTIVE','CHECKED_IN') LIMIT 1`)[0];

/**
 * Simpan profil identitas. Nomor lengkap tidak disimpan: hanya hash HMAC (keunikan) + 4 digit terakhir (cek di gate).
 * Setelah ada tiket aktif, nama & identitas terkunci — perubahan lewat admin (tercatat di audit log).
 */
export const PUT = route(async (req) => {
  const u = await requireUser();
  const d = await body(req, schema);
  const v = validateIdNumber(d.idType, d.idNumber);
  if (!v.ok) throw new ApiError(400, "VALIDATION", v.message, { fields: [{ path: "idNumber", message: v.message }] });
  if (await hasActiveTicket(u.id))
    throw new ApiError(409, "PROFILE_LOCKED", "Profil terkunci karena Anda memegang tiket aktif. Hubungi admin untuk perubahan.");

  await sql`
    UPDATE users SET full_name = ${d.fullName}, id_type = ${d.idType},
      identity_hash = ${identityHash(d.idType, v.value)}, id_last4 = ${v.value.slice(-4)}
    WHERE id = ${u.id}`;
  return json({ ok: true });
});

export const GET = route(async () => {
  const u = await requireUser();
  return json({ fullName: u.full_name, email: u.email, idType: u.id_type, idLast4: u.id_last4, locked: await hasActiveTicket(u.id) });
});
