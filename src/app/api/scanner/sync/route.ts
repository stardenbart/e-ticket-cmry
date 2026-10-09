import { z } from "zod";
import { body, json, route, ApiError } from "@/lib/http";
import { assertGate, requireEventAccess, requireScannerUser, type ScannerEvent } from "@/lib/scanner/access";
import { alertConflicts, checkinItemSchema, processCheckin, type CheckinResult } from "@/lib/scanner/checkin";

const schema = z.object({ items: z.array(checkinItemSchema).max(500) });

/**
 * POST /api/scanner/sync — unggah antrean keputusan offline dari perangkat.
 * Diproses urut scannedAt; check-in paling awal yang sah, sisanya CONFLICT + alert admin.
 */
export const POST = route(async (req) => {
  const u = await requireScannerUser();
  const { items } = await body(req, schema);
  const sorted = [...items].sort((a, b) => Date.parse(a.scannedAt) - Date.parse(b.scannedAt));
  const events = new Map<string, ScannerEvent | null>();
  const results: CheckinResult[] = [];
  const conflicts = new Map<string, number>();

  for (const item of sorted) {
    if (!events.has(item.eventId)) {
      try {
        events.set(item.eventId, await requireEventAccess(u, item.eventId));
      } catch {
        events.set(item.eventId, null);
      }
    }
    const e = events.get(item.eventId);
    if (!e) {
      results.push({ clientId: item.clientId, result: "REJECTED", code: "NO_EVENT_ACCESS", reason: "Akses ke event ini sudah tidak berlaku." });
      continue;
    }
    try {
      assertGate(e, item.gate);
      const r = await processCheckin(item, e, u.id, true);
      if (r.result === "CONFLICT" || r.code === "SUPERSEDED_LATER_CHECKIN") conflicts.set(e.id, (conflicts.get(e.id) ?? 0) + 1);
      results.push(r);
    } catch (err) {
      if (err instanceof ApiError) results.push({ clientId: item.clientId, result: "REJECTED", code: err.code, reason: err.message });
      else throw err;
    }
  }
  for (const [eventId, n] of conflicts) await alertConflicts(events.get(eventId)!, n);
  return json({ results });
});
