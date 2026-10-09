// Format token QR tiket — dipakai server (penerbitan) dan scanner PWA (verifikasi offline).
// Tanpa import Node agar bisa jalan di browser.
//
// Layout byte payload (36 byte):
//   [0]      format = 1
//   [1]      kid (ID kunci penanda tangan, 1..255)
//   [2..17]  ticket_id (UUID)
//   [18..33] event_id (UUID)
//   [34..35] version tiket (uint16 BE)
// Lalu tanda tangan Ed25519 64 byte. Token = "ET1" + base64url(payload || sig) ≈ 137 karakter.
import { ed25519 } from "@noble/curves/ed25519.js";

export const QR_PREFIX = "ET1";

export type QrPayload = { kid: number; ticketId: string; eventId: string; version: number };

export function uuidToBytes(uuid: string): Uint8Array {
  const hex = uuid.replace(/-/g, "");
  if (!/^[0-9a-f]{32}$/i.test(hex)) throw new Error("bad uuid");
  const out = new Uint8Array(16);
  for (let i = 0; i < 16; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function bytesToUuid(b: Uint8Array): string {
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function encodePayload(p: QrPayload): Uint8Array {
  const out = new Uint8Array(36);
  out[0] = 1;
  out[1] = p.kid;
  out.set(uuidToBytes(p.ticketId), 2);
  out.set(uuidToBytes(p.eventId), 18);
  out[34] = (p.version >> 8) & 0xff;
  out[35] = p.version & 0xff;
  return out;
}

export function b64urlEncode(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function b64urlDecode(str: string): Uint8Array {
  const s = str.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(s + "===".slice((s.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export type QrVerifyResult =
  | { ok: true; payload: QrPayload }
  | { ok: false; reason: "FORMAT" | "UNKNOWN_KEY" | "BAD_SIGNATURE" };

/** Verifikasi token QR dengan public key (kid → base64url 32 byte). Tidak butuh jaringan. */
export function verifyQrToken(token: string, publicKeys: Record<string, string>): QrVerifyResult {
  const t = token.trim();
  if (!t.startsWith(QR_PREFIX)) return { ok: false, reason: "FORMAT" };
  let raw: Uint8Array;
  try {
    raw = b64urlDecode(t.slice(QR_PREFIX.length));
  } catch {
    return { ok: false, reason: "FORMAT" };
  }
  if (raw.length !== 100 || raw[0] !== 1) return { ok: false, reason: "FORMAT" };
  const payload = raw.slice(0, 36);
  const sig = raw.slice(36);
  const kid = payload[1];
  const pk = publicKeys[String(kid)];
  if (!pk) return { ok: false, reason: "UNKNOWN_KEY" };
  let valid = false;
  try {
    valid = ed25519.verify(sig, payload, b64urlDecode(pk), { zip215: false });
  } catch {
    valid = false;
  }
  if (!valid) return { ok: false, reason: "BAD_SIGNATURE" };
  return {
    ok: true,
    payload: {
      kid,
      ticketId: bytesToUuid(payload.slice(2, 18)),
      eventId: bytesToUuid(payload.slice(18, 34)),
      version: (payload[34] << 8) | payload[35],
    },
  };
}
