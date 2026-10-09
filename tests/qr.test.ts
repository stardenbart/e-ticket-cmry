import crypto from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { verifyQrToken, b64urlDecode, b64urlEncode, QR_PREFIX } from "@/lib/qr-shared";

const ticketId = "1c06adcc-5cdf-41be-b147-b58a3d615619";
const eventId = "6a3398f0-5435-4cb3-96fa-1707af44480f";
let keys: Record<string, string>;
let signQrToken: typeof import("@/lib/qr").signQrToken;

beforeAll(async () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
  process.env.QR_ACTIVE_KID = "3";
  process.env.QR_PRIVATE_KEY_3 = privateKey.export({ format: "der", type: "pkcs8" }).toString("base64");
  process.env.QR_PUBLIC_KEY_3 = publicKey.export({ format: "jwk" }).x!;
  keys = { "3": process.env.QR_PUBLIC_KEY_3 };
  ({ signQrToken } = await import("@/lib/qr"));
});

describe("QR token Ed25519", () => {
  it("menandatangani dan memverifikasi offline", () => {
    const token = signQrToken({ ticketId, eventId, version: 7 });
    expect(token.startsWith(QR_PREFIX)).toBe(true);
    expect(token.length).toBeLessThan(160); // muat di QR versi 8, EC level M
    const r = verifyQrToken(token, keys);
    expect(r).toEqual({ ok: true, payload: { kid: 3, ticketId, eventId, version: 7 } });
  });

  it("menolak token yang diubah (tanda tangan palsu)", () => {
    const token = signQrToken({ ticketId, eventId, version: 1 });
    const raw = b64urlDecode(token.slice(3));
    raw[35] ^= 0x01; // ubah version
    const r = verifyQrToken(QR_PREFIX + b64urlEncode(raw), keys);
    expect(r).toEqual({ ok: false, reason: "BAD_SIGNATURE" });
  });

  it("menolak kunci yang tidak dikenal dan format salah", () => {
    const token = signQrToken({ ticketId, eventId, version: 1 });
    expect(verifyQrToken(token, { "9": keys["3"] })).toEqual({ ok: false, reason: "UNKNOWN_KEY" });
    expect(verifyQrToken("hello", keys)).toEqual({ ok: false, reason: "FORMAT" });
    expect(verifyQrToken(QR_PREFIX + "AAAA", keys)).toEqual({ ok: false, reason: "FORMAT" });
  });

  it("tidak memuat data pribadi di QR", () => {
    const token = signQrToken({ ticketId, eventId, version: 1 });
    const raw = b64urlDecode(token.slice(3));
    expect(raw.length).toBe(100); // 36 byte payload + 64 byte tanda tangan saja
  });
});
