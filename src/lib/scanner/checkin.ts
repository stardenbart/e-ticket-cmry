import { z } from "zod";
import { sql, pgConstraint, type Tx } from "../db";
import { redis } from "../redis";
import { enqueue } from "../outbox";
import { fmtTime } from "../format";
import type { ScannerEvent } from "./access";

// Check-in di gate. Scan QR tidak mengubah apa pun; hanya keputusan staf (Cocok/Tidak cocok) yang dicatat.
// Semua keputusan ditulis ke tabel checkins (append-only), idempoten berdasarkan client_id.

export const checkinItemSchema = z.object({
  clientId: z.string().uuid(),
  eventId: z.string().uuid(),
  ticketId: z.string().uuid().nullable().optional(),
  version: z.number().int().min(0).max(65535).optional(),
  gate: z.string().min(1).max(60),
  decision: z.enum(["ADMIT", "REJECT"]),
  reason: z.string().max(300).optional(),
  method: z.enum(["QR", "MANUAL"]).default("QR"),
  scannedAt: z.string().datetime({ offset: true }),
  deviceId: z.string().max(100).optional(),
});
export type CheckinItem = z.infer<typeof checkinItemSchema>;

export type CheckinResult = {
  clientId: string;
  result: "ADMITTED" | "REJECTED" | "CONFLICT";
  code?: string;
  reason?: string;
  holderName?: string;
  checkedInAt?: string;
  gate?: string;
};

type TicketRow = {
  id: string;
  event_id: string;
  status: string;
  version: number;
  holder_name: string;
  checked_in_at: Date | null;
  checked_in_gate: string | null;
};

/** Alasan penolakan spesifik untuk tiket yang tidak bisa check-in. */
export function rejectReason(t: TicketRow | undefined, e: ScannerEvent, version?: number): { code: string; reason: string } {
  if (!t) return { code: "NOT_FOUND", reason: "Tiket tidak ditemukan." };
  if (t.event_id !== e.id) return { code: "OTHER_EVENT", reason: "QR untuk event lain." };
  if (t.status === "CHECKED_IN")
    return {
      code: "ALREADY_CHECKED_IN",
      reason: `Sudah check-in pukul ${t.checked_in_at ? fmtTime(t.checked_in_at, e.timezone) : "-"} di ${t.checked_in_gate ?? "gate lain"}.`,
    };
  if (t.status === "CANCELLED") return { code: "CANCELLED", reason: "Tiket dibatalkan." };
  if (t.status === "REVOKED") return { code: "REVOKED", reason: "Tiket dicabut." };
  if (version !== undefined && version !== t.version) return { code: "OLD_VERSION", reason: "QR versi lama (tiket sudah diterbitkan ulang)." };
  return { code: "UNKNOWN", reason: "Tiket tidak dapat dipakai masuk." };
}

async function existing(clientId: string): Promise<CheckinResult | null> {
  const [r] = await sql<{ result: CheckinResult["result"]; reason: string | null }[]>`
    SELECT result, reason FROM checkins WHERE client_id = ${clientId}`;
  return r ? { clientId, result: r.result, reason: r.reason ?? undefined, code: "DUPLICATE_SUBMISSION" } : null;
}

async function insertRow(
  tx: Tx | typeof sql,
  item: CheckinItem,
  staffId: string,
  result: CheckinResult["result"],
  reason: string | null,
  offline: boolean,
  ticketExists: boolean,
) {
  await tx`
    INSERT INTO checkins (client_id, ticket_id, event_id, device_id, gate, staff_id, method, result, reason, offline, scanned_at)
    VALUES (${item.clientId}, ${ticketExists ? item.ticketId ?? null : null}, ${item.eventId}, ${item.deviceId ?? null}, ${item.gate},
            ${staffId}, ${item.method}, ${result}, ${reason}, ${offline}, ${new Date(item.scannedAt)})`;
}

/**
 * Proses satu keputusan check-in.
 *  - online : ADMIT = UPDATE atomik WHERE status='ACTIVE' AND version=$v. 0 baris → layar merah dengan alasan.
 *  - offline: sinkron dari antrean perangkat. Bila tiket sudah CHECKED_IN, timestamp paling awal yang sah;
 *             yang lain ditandai CONFLICT untuk ditinjau admin.
 */
export async function processCheckin(item: CheckinItem, e: ScannerEvent, staffId: string, offline: boolean): Promise<CheckinResult> {
  const prior = await existing(item.clientId);
  if (prior) return prior;

  try {
    return await sql.begin(async (tx) => {
      const [t] = item.ticketId
        ? await tx<TicketRow[]>`
            SELECT id, event_id, status, version, holder_name, checked_in_at, checked_in_gate
            FROM tickets WHERE id = ${item.ticketId} FOR UPDATE`
        : [];

      if (item.decision === "REJECT") {
        await insertRow(tx, item, staffId, "REJECTED", item.reason ?? "Ditolak staf", offline, !!t);
        return { clientId: item.clientId, result: "REJECTED", code: "REJECTED_BY_STAFF", reason: item.reason ?? "Ditolak staf" };
      }

      if (!offline) {
        const [ok] = t
          ? await tx<{ checked_in_at: Date }[]>`
              UPDATE tickets SET status = 'CHECKED_IN', checked_in_at = now(), checked_in_gate = ${item.gate}, checked_in_by = ${staffId}
              WHERE id = ${t.id} AND status = 'ACTIVE' AND version = ${item.version ?? -1} AND event_id = ${e.id}
              RETURNING checked_in_at`
          : [];
        if (ok) {
          await insertRow(tx, item, staffId, "ADMITTED", null, false, true);
          return { clientId: item.clientId, result: "ADMITTED", holderName: t!.holder_name, checkedInAt: ok.checked_in_at.toISOString(), gate: item.gate };
        }
        const r = rejectReason(t, e, item.version);
        await insertRow(tx, item, staffId, "REJECTED", r.reason, false, !!t);
        return { clientId: item.clientId, result: "REJECTED", ...r };
      }

      // ---- offline sync ----
      const scannedAt = new Date(item.scannedAt);
      if (t && t.event_id === e.id && t.status === "ACTIVE" && t.version === item.version) {
        await tx`
          UPDATE tickets SET status = 'CHECKED_IN', checked_in_at = ${scannedAt}, checked_in_gate = ${item.gate}, checked_in_by = ${staffId}
          WHERE id = ${t.id}`;
        await insertRow(tx, item, staffId, "ADMITTED", null, true, true);
        return { clientId: item.clientId, result: "ADMITTED", holderName: t.holder_name, checkedInAt: scannedAt.toISOString(), gate: item.gate };
      }
      if (t && t.event_id === e.id && t.status === "CHECKED_IN" && t.checked_in_at) {
        if (scannedAt < t.checked_in_at) {
          // Scan offline ini lebih awal → dia yang sah; check-in sebelumnya menjadi CONFLICT.
          const prevReason = `Konflik: tiket sudah masuk lebih awal pukul ${fmtTime(scannedAt, e.timezone)} di ${item.gate} (perangkat offline).`;
          await tx`
            UPDATE checkins SET result = 'CONFLICT', reason = ${prevReason}
            WHERE ticket_id = ${t.id} AND result = 'ADMITTED'`;
          await tx`
            UPDATE tickets SET checked_in_at = ${scannedAt}, checked_in_gate = ${item.gate}, checked_in_by = ${staffId} WHERE id = ${t.id}`;
          await insertRow(tx, item, staffId, "ADMITTED", null, true, true);
          return { clientId: item.clientId, result: "ADMITTED", code: "SUPERSEDED_LATER_CHECKIN", reason: "Check-in lain yang lebih lambat ditandai CONFLICT." };
        }
        const reason = `Konflik: tiket sudah check-in pukul ${fmtTime(t.checked_in_at, e.timezone)} di ${t.checked_in_gate ?? "gate lain"}.`;
        await insertRow(tx, item, staffId, "CONFLICT", reason, true, true);
        return { clientId: item.clientId, result: "CONFLICT", code: "ALREADY_CHECKED_IN", reason };
      }
      // Tiket batal / versi lama / tidak dikenal tetapi sudah diizinkan masuk saat offline → perlu ditinjau admin.
      const r = rejectReason(t, e, item.version);
      const reason = `Konflik offline: ${r.reason}`;
      await insertRow(tx, item, staffId, "CONFLICT", reason, true, !!t);
      return { clientId: item.clientId, result: "CONFLICT", code: r.code, reason };
    });
  } catch (err) {
    if (pgConstraint(err) === "checkins_client_id_key") {
      const again = await existing(item.clientId);
      if (again) return again;
    }
    throw err;
  }
}

/** Alert admin saat ada konflik check-in (dedupe 10 menit per event). */
export async function alertConflicts(e: ScannerEvent, count: number) {
  if (count <= 0) return;
  const ok = await redis.set(`alert:checkin-conflict:${e.id}`, "1", "EX", 600, "NX");
  if (ok)
    await enqueue("ADMIN_ALERT", {
      subject: `Konflik check-in: ${e.name}`,
      body: `${count} check-in offline bertabrakan (QR sama di beberapa perangkat) untuk ${e.name}. Tinjau di dashboard admin.`,
    });
}
