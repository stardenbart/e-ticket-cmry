import { z } from "zod";
import { sql, pgConstraint } from "@/lib/db";
import { body, clientIp, json, route, ApiError } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { identityHash } from "@/lib/crypto";
import { ID_TYPES, nameSchema, validateIdNumber } from "@/lib/validation";

const schema = z.object({
  fullName: nameSchema,
  idType: z.enum(ID_TYPES),
  idNumber: z.string().trim().optional(),
  reason: z.string().trim().min(5, "Tulis alasan/permintaan koreksi (min. 5 karakter)."),
  applyToTickets: z.boolean().default(false),
});

/**
 * Koreksi identitas oleh admin untuk profil yang terkunci (sudah punya tiket aktif). Tercatat di audit log.
 * Nama di tiket yang sudah terbit TIDAK berubah, kecuali admin memilih "terapkan ke tiket aktif".
 */
export const POST = route<{ id: string }>(async (req, ctx) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) throw new ApiError(404, "NOT_FOUND", "Pengguna tidak ditemukan.");
  const d = await body(req, schema);
  let hash: string | null = null;
  let last4: string | null = null;
  if (d.idNumber) {
    const v = validateIdNumber(d.idType, d.idNumber);
    if (!v.ok) throw new ApiError(400, "VALIDATION", v.message);
    hash = identityHash(d.idType, v.value);
    last4 = v.value.slice(-4);
  }

  const res = await sql.begin(async (tx) => {
    const [u] = await tx<{ full_name: string; id_type: string | null; id_last4: string | null; identity_hash: string | null }[]>`
      SELECT full_name, id_type, id_last4, identity_hash FROM users WHERE id = ${id} FOR UPDATE`;
    if (!u) throw new ApiError(404, "NOT_FOUND", "Pengguna tidak ditemukan.");
    if (!hash && d.idType !== u.id_type) throw new ApiError(400, "VALIDATION", "Masukkan nomor identitas baru bila jenis identitas diganti.");
    const newHash = hash ?? u.identity_hash;
    const newLast4 = last4 ?? u.id_last4;
    await tx`UPDATE users SET full_name = ${d.fullName}, id_type = ${d.idType}, identity_hash = ${newHash}, id_last4 = ${newLast4} WHERE id = ${id}`;
    let ticketsUpdated = 0;
    if (d.applyToTickets) {
      try {
        const r = await tx`
          UPDATE tickets SET holder_name = ${d.fullName}, id_type = ${d.idType}, id_last4 = ${newLast4}, identity_hash = ${newHash}
          WHERE user_id = ${id} AND status = 'ACTIVE'`;
        ticketsUpdated = r.count;
      } catch (err) {
        if (pgConstraint(err) === "tickets_event_identity_uq")
          throw new ApiError(409, "IDENTITY_ALREADY_USED", "Nomor identitas baru sudah dipakai tiket lain di event yang sama.");
        throw err;
      }
    }
    await audit(
      {
        actorId: admin.id,
        action: "user.identity_correction",
        entity: "user",
        entityId: id,
        before: { full_name: u.full_name, id_type: u.id_type, id_last4: u.id_last4 },
        after: { full_name: d.fullName, id_type: d.idType, id_last4: newLast4, identity_changed: !!hash, reason: d.reason, applied_to_tickets: ticketsUpdated },
        ip: clientIp(req),
      },
      tx,
    );
    return { ticketsUpdated };
  });
  return json({ ok: true, ...res });
});
