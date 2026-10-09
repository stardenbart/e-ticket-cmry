import { z } from "zod";
import { sql } from "@/lib/db";
import { clientIp, json, route, ApiError } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";

/** Tandai konflik check-in (offline) sudah ditinjau. */
export const POST = route<{ id: string }>(async (req, ctx) => {
  const u = await requireAdmin();
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) throw new ApiError(404, "NOT_FOUND", "Data check-in tidak ditemukan.");
  const [r] = await sql<{ ticket_id: string }[]>`
    UPDATE checkins SET resolved_at = now(), resolved_by = ${u.id}
    WHERE id = ${id} AND result = 'CONFLICT' AND resolved_at IS NULL RETURNING ticket_id`;
  if (!r) throw new ApiError(409, "ALREADY_RESOLVED", "Konflik sudah ditinjau atau tidak ditemukan.");
  await audit({ actorId: u.id, action: "checkin.conflict_resolved", entity: "checkin", entityId: id, after: { ticket_id: r.ticket_id }, ip: clientIp(req) });
  return json({ ok: true });
});
