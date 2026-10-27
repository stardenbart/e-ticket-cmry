import { json, route } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { publicPuzzle } from "@/lib/games/tts-puzzle";
import { TTS_STALE_MS, ttsRun, ttsView } from "@/lib/games/service";

export const dynamic = "force-dynamic";

/** GET /api/games/tts — grid & soal (tanpa jawaban) + sesi TTS milik pemain. */
export const GET = route(async () => {
  const u = await requireUser();
  return json({ puzzle: publicPuzzle(), run: ttsView(await ttsRun(u.id)), staleMs: TTS_STALE_MS }, { headers: { "cache-control": "no-store" } });
});
