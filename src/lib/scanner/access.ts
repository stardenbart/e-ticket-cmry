import { sql } from "../db";
import { ApiError } from "../http";
import { isAdminRole, requireUser, type SessionUser } from "../auth";

export type ScannerEvent = {
  id: string;
  name: string;
  gates: string[];
  require_id_match: boolean;
  timezone: string;
  start_at: Date;
  end_at: Date;
  venue: string;
  /** Batas akses perangkat ke data event ini (staf: valid_until, admin: end_at + 1 hari). */
  valid_until: Date;
};

export const requireScannerUser = () => requireUser(["GATE_STAFF", "EVENT_ADMIN", "SUPER_ADMIN"]);

/** Event yang boleh di-scan oleh user ini. Staf hanya event yang ditugaskan & belum kedaluwarsa (H+1). */
export async function listScannerEvents(u: SessionUser): Promise<ScannerEvent[]> {
  if (isAdminRole(u.role)) {
    return sql<ScannerEvent[]>`
      SELECT id, name, gates, require_id_match, timezone, start_at, end_at, venue, end_at + interval '1 day' AS valid_until
      FROM events WHERE status = 'PUBLISHED' AND end_at > now() - interval '1 day'
      ORDER BY start_at`;
  }
  return sql<ScannerEvent[]>`
    SELECT e.id, e.name,
           CASE WHEN cardinality(gs.gates) > 0 THEN gs.gates ELSE e.gates END AS gates,
           e.require_id_match, e.timezone, e.start_at, e.end_at, e.venue, gs.valid_until
    FROM gate_staff gs JOIN events e ON e.id = gs.event_id
    WHERE gs.user_id = ${u.id} AND gs.valid_until > now() AND e.status = 'PUBLISHED'
    ORDER BY e.start_at`;
}

/** Pastikan user boleh memindai event ini; kembalikan event + gate yang diizinkan. */
export async function requireEventAccess(u: SessionUser, eventId: string): Promise<ScannerEvent> {
  if (!/^[0-9a-f-]{36}$/i.test(eventId)) throw new ApiError(404, "NOT_FOUND", "Event tidak ditemukan.");
  const events = await listScannerEvents(u);
  const e = events.find((x) => x.id === eventId);
  if (!e) throw new ApiError(403, "NO_EVENT_ACCESS", "Anda tidak ditugaskan ke event ini, atau akses sudah kedaluwarsa.");
  return e;
}

export function assertGate(e: ScannerEvent, gate: string) {
  if (!e.gates.includes(gate)) throw new ApiError(403, "NO_GATE_ACCESS", `Anda tidak ditugaskan di ${gate}.`);
}
