import { z } from "zod";
import { body, clientIp, json, route, ApiError } from "@/lib/http";
import { profileComplete, requireUser } from "@/lib/auth";
import { joinQueue, leaveQueue, queueStatus, rejoinQueue } from "@/lib/queue";
import { verifyTurnstile } from "@/lib/turnstile";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const uuid = z.string().uuid("Kategori tidak valid.");

/** GET /api/queue?categoryId= — posisi antrean / admission token. Dipoll oleh waiting room. */
export const GET = route(async (req) => {
  const u = await requireUser();
  await rateLimit(`qstatus:${u.id}`, 120, 60);
  const categoryId = uuid.parse(req.nextUrl.searchParams.get("categoryId"));
  return json(await queueStatus(u.id, categoryId), { headers: { "cache-control": "no-store" } });
});

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("join"), categoryId: uuid, turnstileToken: z.string().optional() }),
  z.object({ action: z.literal("leave"), categoryId: uuid }),
  z.object({ action: z.literal("rejoin"), categoryId: uuid, turnstileToken: z.string().optional() }),
]);

/** POST /api/queue { action: join | leave | rejoin, categoryId } */
export const POST = route(async (req) => {
  const u = await requireUser();
  const d = await body(req, actionSchema);
  if (d.action === "leave") {
    await leaveQueue(u.id, d.categoryId);
    return json({ ok: true });
  }
  if (!profileComplete(u)) throw new ApiError(403, "PROFILE_INCOMPLETE", "Lengkapi profil identitas Anda sebelum masuk antrean.");
  await rateLimit(`qjoin:${u.id}`, 20, 60);
  await verifyTurnstile(d.turnstileToken, clientIp(req));
  const status = d.action === "join" ? await joinQueue(u.id, d.categoryId) : await rejoinQueue(u.id, d.categoryId);
  return json(status);
});
