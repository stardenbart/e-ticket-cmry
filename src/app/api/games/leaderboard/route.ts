import { json, route, ApiError } from "@/lib/http";
import { currentUser, isAdminRole } from "@/lib/auth";
import { farmLeaderboard } from "@/lib/ternak/service";
import { gamesLockStatus } from "@/lib/games/lock";

export const dynamic = "force-dynamic";

/**
 * GET /api/games/leaderboard — peringkat peternak (50 teratas + posisi pemain yang login).
 * Setelah periode games berakhir, leaderboard disembunyikan dari peserta (hanya admin) sampai diumumkan di hari H.
 */
export const GET = route(async () => {
  const u = await currentUser();
  const lock = await gamesLockStatus();
  const admin = !!u && isAdminRole(u.role);
  if (lock.locked && !admin) throw new ApiError(403, "LEADERBOARD_HIDDEN", "Periode games sudah berakhir. Pemenang diumumkan di hari H acara!");
  const rows = await farmLeaderboard({ limit: 50, userId: u?.id });
  return json({ rows, me: u?.id ?? null, final: lock.locked }, { headers: { "cache-control": "no-store" } });
});
