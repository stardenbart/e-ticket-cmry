import { z } from "zod";
import { body, clientIp, json, route } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { gamesLockAt, gamesLockStatus, setGamesLock } from "@/lib/games/lock";

export const dynamic = "force-dynamic";

/** GET /api/admin/games-lock — tenggat games saat ini. */
export const GET = route(async () => {
  await requireAdmin();
  return json(await gamesLockStatus());
});

/** PUT /api/admin/games-lock — { lockAt: ISO | null }. null = games dibuka tanpa tenggat. */
export const PUT = route(async (req) => {
  const me = await requireAdmin();
  const d = await body(req, z.object({ lockAt: z.string().datetime({ offset: true }).nullable() }));
  const before = await gamesLockAt();
  const lockAt = d.lockAt ? new Date(d.lockAt) : null;
  await setGamesLock(lockAt, me.id);
  await audit({
    actorId: me.id,
    action: "games.lock",
    entity: "games",
    before: { lockAt: before?.toISOString() ?? null },
    after: { lockAt: lockAt?.toISOString() ?? null },
    ip: clientIp(req),
  });
  return json(await gamesLockStatus());
});
