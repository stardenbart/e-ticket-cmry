import { z } from "zod";
import { body, json, route } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { CATALOG, getFarm, nameCow } from "@/lib/ternak/service";

export const dynamic = "force-dynamic";

/** GET /api/ternak — kondisi sapi + dompet (simulasi dimajukan ke sekarang). */
export const GET = route(async () => {
  const u = await requireUser();
  return json({ ...(await getFarm(u.id)), catalog: CATALOG }, { headers: { "cache-control": "no-store" } });
});

/** POST /api/ternak — { name } beri nama sapi (sekali, di awal). */
export const POST = route(async (req) => {
  const u = await requireUser();
  await rateLimit(`ternak-name:${u.id}`, 10, 60);
  const d = await body(req, z.object({ name: z.string().trim().min(1).max(24) }));
  return json(await nameCow(u.id, d.name));
});
