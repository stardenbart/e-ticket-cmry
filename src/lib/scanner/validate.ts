// Validasi QR di perangkat scanner — berjalan penuh offline.
// 1) tanda tangan Ed25519 dengan public key dari manifest, 2) event, 3) ticket_id + version vs manifest.
import { verifyQrToken } from "../qr-shared";
import { fmtTime } from "../format";

export type ManifestTicket = {
  id: string;
  version: number;
  status: "ACTIVE" | "CHECKED_IN" | "CANCELLED" | "REVOKED" | string;
  holder_name: string;
  category_name: string;
  id_type: string;
  id_last4: string | null;
  checked_in_at: string | null;
  checked_in_gate: string | null;
};

export type ManifestEvent = {
  id: string;
  name: string;
  venue: string;
  gates: string[];
  require_id_match: boolean;
  timezone: string;
  start_at: string;
  end_at: string;
  valid_until: string;
};

export type Manifest = {
  event: ManifestEvent;
  publicKeys: Record<string, string>;
  tickets: Record<string, ManifestTicket>;
  /** Jam server saat manifest terakhir diambil (ms) — dipakai sebagai `since` berikutnya. */
  serverNow: number;
  /** Jam perangkat saat sinkron terakhir (ms) — untuk ditampilkan. */
  syncedAt: number;
};

export type ScanVerdict =
  | { ok: true; ticket: ManifestTicket; version: number }
  | { ok: false; code: string; reason: string; ticket?: ManifestTicket };

const ID_LABEL: Record<string, string> = { KTP: "KTP", SIM: "SIM", PASPOR: "Paspor" };
export const idTypeLabel = (t: string) => ID_LABEL[t] ?? t;

export function verdictForTicket(t: ManifestTicket | undefined, version: number, tz: string): ScanVerdict {
  if (!t) return { ok: false, code: "NOT_IN_MANIFEST", reason: "Tiket tidak ada di manifest. Sinkronkan ulang lalu coba lagi." };
  if (version < t.version) return { ok: false, code: "OLD_VERSION", reason: "QR versi lama — tiket sudah diterbitkan ulang.", ticket: t };
  if (version > t.version) return { ok: false, code: "MANIFEST_STALE", reason: "Manifest belum memuat versi tiket terbaru. Sinkronkan ulang.", ticket: t };
  if (t.status === "CHECKED_IN")
    return {
      ok: false,
      code: "ALREADY_CHECKED_IN",
      reason: `Sudah check-in pukul ${t.checked_in_at ? fmtTime(t.checked_in_at, tz) : "-"} di ${t.checked_in_gate ?? "gate lain"}.`,
      ticket: t,
    };
  if (t.status === "CANCELLED") return { ok: false, code: "CANCELLED", reason: "Tiket dibatalkan.", ticket: t };
  if (t.status === "REVOKED") return { ok: false, code: "REVOKED", reason: "Tiket dicabut.", ticket: t };
  if (t.status !== "ACTIVE") return { ok: false, code: "INVALID", reason: "Tiket tidak dapat dipakai masuk.", ticket: t };
  return { ok: true, ticket: t, version };
}

export function validateScan(token: string, m: Manifest): ScanVerdict {
  const v = verifyQrToken(token, m.publicKeys);
  if (!v.ok) {
    if (v.reason === "FORMAT") return { ok: false, code: "NOT_TICKET", reason: "Bukan QR tiket event ini." };
    return { ok: false, code: "FORGED", reason: "QR palsu — tanda tangan tidak valid." };
  }
  if (v.payload.eventId !== m.event.id) return { ok: false, code: "OTHER_EVENT", reason: "QR untuk event lain." };
  return verdictForTicket(m.tickets[v.payload.ticketId], v.payload.version, m.event.timezone);
}
