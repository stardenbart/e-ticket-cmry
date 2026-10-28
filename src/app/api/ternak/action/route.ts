import { z } from "zod";
import { body, json, route } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { farmAction } from "@/lib/ternak/service";
import { OUTFIT_KEYS, type OutfitKey } from "@/lib/ternak/engine";

const outfit = z.enum(OUTFIT_KEYS as [OutfitKey, ...OutfitKey[]]);

const schema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("feed"), feed: z.enum(["asteroid", "nebula", "supernova"]) }),
  z.object({ type: z.literal("buyFeed"), feed: z.enum(["asteroid", "nebula", "supernova"]), qty: z.number().int().min(1).max(20) }),
  z.object({ type: z.literal("clean") }),
  z.object({ type: z.literal("pet") }),
  z.object({ type: z.literal("medicine") }),
  z.object({ type: z.literal("harvest") }),
  z.object({ type: z.literal("buyOutfit"), outfit }),
  z.object({ type: z.literal("wear"), outfit: outfit.nullable() }),
]);

/** POST /api/ternak/action — beri makan, bersihkan, elus, obat, panen, beli/pakai hiasan kepala. */
export const POST = route(async (req) => {
  const u = await requireUser();
  await rateLimit(`ternak:${u.id}`, 40, 60);
  const a = await body(req, schema);
  return json(await farmAction(u.id, a));
});
