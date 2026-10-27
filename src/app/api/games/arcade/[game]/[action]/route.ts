import { z } from "zod";
import { body, json, route, ApiError } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { arcadeFinish, arcadeStart, isArcade } from "@/lib/games/service";

/**
 * POST /api/games/arcade/:game/start   → { runId } (waktu mulai dicatat server)
 * POST /api/games/arcade/:game/finish  → { runId, score, meta? } skor dicek kewajarannya terhadap durasi main
 */
export const POST = route<{ game: string; action: string }>(async (req, ctx) => {
  const u = await requireUser();
  const { game, action } = await ctx.params;
  if (!isArcade(game)) throw new ApiError(404, "NOT_FOUND", "Game tidak dikenal.");
  if (action === "start") {
    await rateLimit(`arcade:${u.id}`, 40, 60);
    return json({ runId: await arcadeStart(u.id, game) });
  }
  if (action === "finish") {
    const d = await body(
      req,
      z.object({ runId: z.string().uuid(), score: z.number().int().min(0).max(1_000_000), meta: z.record(z.string(), z.number()).optional() }),
    );
    return json(await arcadeFinish(u.id, game, d.runId, d.score, d.meta));
  }
  throw new ApiError(404, "NOT_FOUND", "Aksi tidak dikenal.");
});
