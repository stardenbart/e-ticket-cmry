import { json, route } from "@/lib/http";
import { currentUser } from "@/lib/auth";
import { leaderboard } from "@/lib/games/service";

export const dynamic = "force-dynamic";

/** GET /api/games/leaderboard — 50 teratas (+ posisi pemain yang login bila di luar 50 besar). */
export const GET = route(async () => {
  const u = await currentUser();
  const rows = await leaderboard({ limit: 50, userId: u?.id });
  return json({ rows, me: u?.id ?? null }, { headers: { "cache-control": "no-store" } });
});
