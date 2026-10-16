import { z } from "zod";
import { sql } from "@/lib/db";
import { body, clientIp, json, route, ApiError } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { validatePhone } from "@/lib/employee-shared";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("disable"), reason: z.string().trim().min(5, "Tulis alasan (min. 5 karakter).").max(300) }),
  z.object({ action: z.literal("enable") }),
  z.object({ action: z.literal("unlink"), reason: z.string().trim().min(5, "Tulis alasan (min. 5 karakter).").max(300) }),
  z.object({ action: z.literal("phone"), phone: z.string().trim().max(20) }),
]);

/**
 * PATCH /api/admin/participant-accounts/:id — tindakan admin atas akun peserta:
 *   disable  → akun tidak bisa login (sesi aktif langsung diputus); tiket yang sudah terbit tidak berubah
 *   enable   → aktifkan kembali
 *   unlink   → lepas tautan NIK (hanya bila tidak memegang tiket aktif), peserta bisa menautkan ulang di Profil
 *   phone    → ubah nomor HP
 * Semua tercatat di audit log.
 */
export const PATCH = route<{ id: string }>(async (req, ctx) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) throw new ApiError(404, "NOT_FOUND", "Akun tidak ditemukan.");
  const d = await body(req, schema);
  const [u] = await sql<{ id: string; email: string; nik: string | null; phone: string | null; disabled_at: Date | null }[]>`
    SELECT id, email, nik, phone, disabled_at FROM users WHERE id = ${id} AND role = 'ATTENDEE'`;
  if (!u) throw new ApiError(404, "NOT_FOUND", "Akun peserta tidak ditemukan.");
  const ip = clientIp(req);

  if (d.action === "disable") {
    await sql.begin(async (tx) => {
      await tx`UPDATE users SET disabled_at = now() WHERE id = ${id}`;
      await tx`DELETE FROM sessions WHERE user_id = ${id}`;
    });
    await audit({ actorId: admin.id, action: "participant_account.disable", entity: "user", entityId: id, after: { email: u.email, reason: d.reason }, ip });
  } else if (d.action === "enable") {
    await sql`UPDATE users SET disabled_at = NULL WHERE id = ${id}`;
    await audit({ actorId: admin.id, action: "participant_account.enable", entity: "user", entityId: id, after: { email: u.email }, ip });
  } else if (d.action === "unlink") {
    const [t] = await sql`SELECT 1 FROM tickets WHERE user_id = ${id} AND status IN ('ACTIVE','CHECKED_IN') LIMIT 1`;
    if (t) throw new ApiError(409, "HAS_TICKET", "Akun ini memegang tiket aktif. Batalkan tiketnya dulu, atau pakai Koreksi NIK.");
    await sql`UPDATE users SET nik = NULL, id_type = NULL, identity_hash = NULL, id_last4 = NULL WHERE id = ${id}`;
    await audit({ actorId: admin.id, action: "participant_account.unlink_nik", entity: "user", entityId: id, before: { nik: u.nik }, after: { reason: d.reason }, ip });
  } else {
    const ph = validatePhone(d.phone);
    if (!ph.ok) throw new ApiError(400, "INVALID_PHONE", ph.message);
    await sql`UPDATE users SET phone = ${ph.phone} WHERE id = ${id}`;
    await audit({ actorId: admin.id, action: "participant_account.phone", entity: "user", entityId: id, before: { phone: u.phone }, after: { phone: ph.phone }, ip });
  }
  return json({ ok: true });
});
