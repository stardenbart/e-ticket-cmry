import { json, route } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { queryAudit } from "@/lib/admin/audit-query";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  const u = await requireAdmin();
  const sp = req.nextUrl.searchParams;
  const res = await queryAudit(u.role, {
    entity: sp.get("entity") || undefined,
    action: sp.get("action") || undefined,
    actor: sp.get("actor") || undefined,
    entityId: sp.get("entityId") || undefined,
    from: sp.get("from") || undefined,
    to: sp.get("to") || undefined,
    page: Number(sp.get("page") ?? 1) || 1,
  });
  return json(res);
});
