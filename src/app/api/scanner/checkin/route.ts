import { body, json, route } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { assertGate, requireEventAccess, requireScannerUser } from "@/lib/scanner/access";
import { checkinItemSchema, processCheckin } from "@/lib/scanner/checkin";

/** POST /api/scanner/checkin — keputusan staf (online). ADMIT atomik; gagal → alasan untuk layar merah. */
export const POST = route(async (req) => {
  const u = await requireScannerUser();
  await rateLimit(`scan:${u.id}`, 600, 60);
  const item = await body(req, checkinItemSchema);
  const e = await requireEventAccess(u, item.eventId);
  assertGate(e, item.gate);
  const r = await processCheckin(item, e, u.id, false);
  return json(r);
});
