import { z } from "zod";
import { sql } from "@/lib/db";
import { body, clientIp, json, route, ApiError } from "@/lib/http";
import { requireSuperAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";

const schema = z.object({
  role: z.enum(["EVENT_ADMIN", "SUPER_ADMIN", "GATE_STAFF"]).optional(),
  disabled: z.boolean().optional(),
});

/** Ubah peran / nonaktifkan akun admin & staf. Tidak bisa mengubah atau menonaktifkan diri sendiri. */
export const PATCH = route<{ id: string }>(async (req, ctx) => {
  const me = await requireSuperAdmin();
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) throw new ApiError(404, "NOT_FOUND", "Akun tidak ditemukan.");
  const d = await body(req, schema);
  if (id === me.id) throw new ApiError(409, "SELF", "Anda tidak bisa mengubah peran atau menonaktifkan akun sendiri.");
  const out = await sql.begin(async (tx) => {
    const [u] = await tx<{ role: string; disabled_at: Date | null; email: string }[]>`
      SELECT role, disabled_at, email FROM users WHERE id = ${id} FOR UPDATE`;
    if (!u || u.role === "ATTENDEE") throw new ApiError(404, "NOT_FOUND", "Akun tidak ditemukan.");
    const role = d.role ?? u.role;
    const disabledAt = d.disabled === undefined ? u.disabled_at : d.disabled ? (u.disabled_at ?? new Date()) : null;
    await tx`UPDATE users SET role = ${role}, disabled_at = ${disabledAt} WHERE id = ${id}`;
    // Sesi dicabut agar perubahan hak akses langsung berlaku.
    if (role !== u.role || (disabledAt && !u.disabled_at)) await tx`DELETE FROM sessions WHERE user_id = ${id}`;
    await audit(
      {
        actorId: me.id,
        action: "admin_account.update",
        entity: "admin_account",
        entityId: id,
        before: { email: u.email, role: u.role, disabled: !!u.disabled_at },
        after: { role, disabled: !!disabledAt },
        ip: clientIp(req),
      },
      tx,
    );
    return { role, disabled: !!disabledAt };
  });
  return json({ ok: true, ...out });
});
