import { json, route } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { earnings } from "@/lib/ternak/service";

export const dynamic = "force-dynamic";

/** GET /api/games/earnings — saldo Moo-coins + poin arkade yang sudah dihitung hari ini (per game). */
export const GET = route(async () => {
  const u = await requireUser();
  return json(await earnings(u.id), { headers: { "cache-control": "no-store" } });
});
