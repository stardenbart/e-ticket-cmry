import { z } from "zod";
import { sql } from "@/lib/db";
import { body, clientIp, json, route, ApiError } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { enqueue } from "@/lib/outbox";
import { emailSchema } from "@/lib/validation";
import { fmtDateTime } from "@/lib/format";
import { loadEventOr404 } from "@/lib/admin/events";

type P = { id: string };

const inviteSchema = z.object({
  email: emailSchema,
  name: z.string().trim().max(100).optional(),
  gates: z.array(z.string().trim().min(1)).min(1, "Pilih minimal satu gate."),
});

/**
 * Undang / perbarui staf gate. Akses berlaku sampai H+1 (akhir acara + 1 hari), lalu kedaluwarsa otomatis.
 * Email baru → akun GATE_STAFF tanpa password (diatur lewat Lupa Password).
 */
export const POST = route<P>(async (req, ctx) => {
  const u = await requireAdmin();
  const { id } = await ctx.params;
  const d = await body(req, inviteSchema);
  const e = await loadEventOr404(id);
  if (e.status === "CANCELLED") throw new ApiError(409, "CANCELLED", "Event dibatalkan.");
  const bad = d.gates.filter((g) => !e.gates.includes(g));
  if (bad.length) throw new ApiError(400, "VALIDATION", `Gate tidak dikenal: ${bad.join(", ")}.`);
  const validUntil = new Date(e.end_at.getTime() + 86400_000);

  const res = await sql.begin(async (tx) => {
    let [user] = await tx<{ id: string; role: string; full_name: string }[]>`
      SELECT id, role, full_name FROM users WHERE lower(email) = ${d.email}`;
    let newAccount = false;
    if (user && user.role === "ATTENDEE")
      throw new ApiError(409, "IS_ATTENDEE", "Email ini dipakai akun peserta. Gunakan email lain untuk staf gate.");
    if (!user) {
      [user] = await tx<{ id: string; role: string; full_name: string }[]>`
        INSERT INTO users (email, full_name, role) VALUES (${d.email}, ${d.name || d.email.split("@")[0]}, 'GATE_STAFF')
        RETURNING id, role, full_name`;
      newAccount = true;
    }
    const [prev] = await tx<{ gates: string[] }[]>`SELECT gates FROM gate_staff WHERE event_id = ${id} AND user_id = ${user.id}`;
    await tx`
      INSERT INTO gate_staff (event_id, user_id, gates, valid_until) VALUES (${id}, ${user.id}, ${d.gates}, ${validUntil})
      ON CONFLICT (event_id, user_id) DO UPDATE SET gates = EXCLUDED.gates, valid_until = EXCLUDED.valid_until`;
    await enqueue(
      "STAFF_INVITE",
      { to: d.email, name: user.full_name, eventName: e.name, gates: d.gates, validUntil: fmtDateTime(validUntil, e.timezone), newAccount },
      tx,
    );
    await audit(
      { actorId: u.id, action: prev ? "gate_staff.update" : "gate_staff.invite", entity: "gate_staff", entityId: id, before: prev ? { email: d.email, gates: prev.gates } : undefined, after: { email: d.email, gates: d.gates, valid_until: validUntil }, ip: clientIp(req) },
      tx,
    );
    return { newAccount };
  });
  return json({ ok: true, ...res });
});

export const DELETE = route<P>(async (req, ctx) => {
  const u = await requireAdmin();
  const { id } = await ctx.params;
  const userId = z.string().uuid().parse(req.nextUrl.searchParams.get("userId"));
  const [row] = await sql<{ gates: string[]; email: string }[]>`
    DELETE FROM gate_staff g USING users u WHERE g.event_id = ${id} AND g.user_id = ${userId} AND u.id = g.user_id
    RETURNING g.gates, u.email`;
  if (!row) throw new ApiError(404, "NOT_FOUND", "Staf tidak ditemukan.");
  await audit({ actorId: u.id, action: "gate_staff.remove", entity: "gate_staff", entityId: id, before: { email: row.email, gates: row.gates }, ip: clientIp(req) });
  return json({ ok: true });
});
