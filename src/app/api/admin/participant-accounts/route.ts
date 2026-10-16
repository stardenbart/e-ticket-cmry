import { clientIp, json, route } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { participantAccountStats, queryParticipantAccounts } from "@/lib/admin/participant-accounts";

export const dynamic = "force-dynamic";

const PAGE = 50;

/** GET /api/admin/participant-accounts?q=&link=&ticket=&state=&page= — akun peserta yang sudah daftar. */
export const GET = route(async (req) => {
  const u = await requireAdmin();
  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, Number(sp.get("page") ?? 1) || 1);
  const f = { q: sp.get("q") ?? undefined, link: sp.get("link") ?? undefined, ticket: sp.get("ticket") ?? undefined, state: sp.get("state") ?? undefined };
  const [{ rows, total }, stats] = await Promise.all([queryParticipantAccounts({ ...f, limit: PAGE, offset: (page - 1) * PAGE }), participantAccountStats()]);
  if (page === 1 && f.q) await audit({ actorId: u.id, action: "participant_accounts.search", entity: "users", after: f, ip: clientIp(req) });
  return json({ rows, total, page, pageSize: PAGE, stats });
});
