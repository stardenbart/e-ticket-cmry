import { z } from "zod";
import { body, json, route, ApiError } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { moordleGuess, moordleStart, moordleStats } from "@/lib/games/moordle";

/**
 * POST /api/games/moordle/:action
 *   start  → mulai Moordle hari ini (sekali per hari; memanggil lagi mengembalikan sesi yang sama)
 *   guess  → { guess: "SAPIH" } satu tebakan 5 huruf, dievaluasi di server
 */
export const POST = route<{ action: string }>(async (req, ctx) => {
  const u = await requireUser();
  const { action } = await ctx.params;
  if (action === "start") return json({ today: await moordleStart(u.id) });
  if (action === "guess") {
    await rateLimit(`moordle:${u.id}`, 30, 60);
    const d = await body(req, z.object({ guess: z.string().trim().min(1).max(20) }));
    const today = await moordleGuess(u.id, d.guess);
    return json({ today, stats: today.status === "FINISHED" ? await moordleStats(u.id) : null });
  }
  throw new ApiError(404, "NOT_FOUND", "Aksi tidak dikenal.");
});
