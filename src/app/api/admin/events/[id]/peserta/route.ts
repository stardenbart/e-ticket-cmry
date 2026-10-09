import { z } from "zod";
import { json, route, clientIp } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { loadEventOr404 } from "@/lib/admin/events";
import { queryParticipants } from "@/lib/admin/participants";

export const dynamic = "force-dynamic";

const PAGE = 50;

/** Daftar peserta. Setiap akses data peserta dicatat di audit log (UU PDP). */
export const GET = route<{ id: string }>(async (req, ctx) => {
  const u = await requireAdmin();
  const { id } = await ctx.params;
  await loadEventOr404(id);
  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, Number(sp.get("page") ?? 1) || 1);
  const categoryId = sp.get("category") || undefined;
  if (categoryId) z.string().uuid().parse(categoryId);
  const filters = { q: sp.get("q") ?? undefined, status: sp.get("status") || undefined, categoryId };
  const { rows, total } = await queryParticipants(id, { ...filters, limit: PAGE, offset: (page - 1) * PAGE });
  await audit({ actorId: u.id, action: "participants.view", entity: "event", entityId: id, after: { ...filters, page, rows: rows.length }, ip: clientIp(req) });
  return json({ rows, total, page, pageSize: PAGE });
});
