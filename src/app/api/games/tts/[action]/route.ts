import { z } from "zod";
import { body, json, route, ApiError } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { ttsAnswer, ttsEnd, ttsHeartbeat, ttsStart, ttsView } from "@/lib/games/service";

/**
 * POST /api/games/tts/:action
 *   start      → mulai (sekali per akun; memanggil lagi mengembalikan sesi yang sama)
 *   answer     → { key: "1D", answer } cek satu jawaban
 *   heartbeat  → tanda masih di halaman (berhenti > 45 detik = skor dikunci)
 *   surrender  → menyerah, skor & waktu dikunci
 *   leave      → keluar halaman (dikirim via sendBeacon), skor & waktu dikunci
 */
export const POST = route<{ action: string }>(async (req, ctx) => {
  const u = await requireUser();
  const { action } = await ctx.params;
  switch (action) {
    case "start":
      return json({ run: ttsView(await ttsStart(u.id)) });
    case "answer": {
      await rateLimit(`tts:${u.id}`, 120, 60);
      const d = await body(req, z.object({ key: z.string().regex(/^\d{1,2}[AD]$/), answer: z.string().trim().min(1).max(30) }));
      const r = await ttsAnswer(u.id, d.key, d.answer);
      return json({ correct: r.correct, run: r.view });
    }
    case "heartbeat":
      return json({ run: await ttsHeartbeat(u.id) });
    case "surrender":
      return json({ run: await ttsEnd(u.id, "SURRENDERED") });
    case "leave":
      return json({ run: await ttsEnd(u.id, "LOCKED") });
    default:
      throw new ApiError(404, "NOT_FOUND", "Aksi tidak dikenal.");
  }
});
