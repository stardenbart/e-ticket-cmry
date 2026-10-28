import { z } from "zod";
import { body, clientIp, json, route, ApiError } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { gamesLockStatus, gamesPeriod, setGamesPeriod } from "@/lib/games/lock";

export const dynamic = "force-dynamic";

/** GET /api/admin/games-lock — periode games saat ini. */
export const GET = route(async () => {
  await requireAdmin();
  return json(await gamesLockStatus());
});

/** PUT /api/admin/games-lock — { startAt: ISO | null, lockAt: ISO | null }. */
export const PUT = route(async (req) => {
  const me = await requireAdmin();
  const iso = z.string().datetime({ offset: true }).nullable();
  const d = await body(req, z.object({ startAt: iso, lockAt: iso }));
  const startAt = d.startAt ? new Date(d.startAt) : null;
  const lockAt = d.lockAt ? new Date(d.lockAt) : null;
  if (startAt && lockAt && lockAt <= startAt) throw new ApiError(400, "VALIDATION", "Waktu selesai harus setelah waktu mulai.");
  const before = await gamesPeriod();
  await setGamesPeriod({ startAt, lockAt }, me.id);
  await audit({
    actorId: me.id,
    action: "games.period",
    entity: "games",
    before: { startAt: before.startAt?.toISOString() ?? null, lockAt: before.lockAt?.toISOString() ?? null },
    after: { startAt: startAt?.toISOString() ?? null, lockAt: lockAt?.toISOString() ?? null },
    ip: clientIp(req),
  });
  return json(await gamesLockStatus());
});
