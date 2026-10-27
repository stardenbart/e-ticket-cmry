import { json, route } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { moordleRun, moordleStats, moordleView } from "@/lib/games/moordle";
import { gamesLockStatus } from "@/lib/games/lock";

export const dynamic = "force-dynamic";

/** GET /api/games/moordle — status Moordle hari ini + statistik pribadi (tanpa kunci jawaban). */
export const GET = route(async () => {
  const u = await requireUser();
  const [run, stats, lock] = await Promise.all([moordleRun(u.id), moordleStats(u.id), gamesLockStatus()]);
  return json({ today: moordleView(run), stats, lock }, { headers: { "cache-control": "no-store" } });
});
