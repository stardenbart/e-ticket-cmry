import crypto from "node:crypto";
import QRCode from "qrcode";
import { env } from "./env";
import { QR_PREFIX, b64urlEncode, encodePayload, type QrPayload } from "./qr-shared";

const keyCache = new Map<number, crypto.KeyObject>();

function privateKey(kid: number): crypto.KeyObject {
  let k = keyCache.get(kid);
  if (!k) {
    const pem = env.qrPrivateKey(kid);
    if (!pem) throw new Error(`QR private key ${kid} belum dikonfigurasi (jalankan npm run keys)`);
    k = crypto.createPrivateKey({ key: Buffer.from(pem, "base64"), format: "der", type: "pkcs8" });
    keyCache.set(kid, k);
  }
  return k;
}

/** Public key yang masih valid, untuk scanner (kid → base64url raw 32 byte). */
export function publicKeys(): Record<string, string> {
  const out: Record<string, string> = {};
  for (let kid = 1; kid <= 255; kid++) {
    const pk = env.qrPublicKey(kid);
    if (pk) out[String(kid)] = pk;
  }
  return out;
}

export function signQrToken(p: Omit<QrPayload, "kid">): string {
  const kid = env.QR_ACTIVE_KID;
  const payload = encodePayload({ ...p, kid });
  const sig = crypto.sign(null, payload, privateKey(kid));
  const all = new Uint8Array(payload.length + sig.length);
  all.set(payload, 0);
  all.set(sig, payload.length);
  return QR_PREFIX + b64urlEncode(all);
}

export async function qrPng(token: string, width = 480): Promise<Buffer> {
  return QRCode.toBuffer(token, { errorCorrectionLevel: "M", margin: 2, width });
}

export async function qrSvg(token: string): Promise<string> {
  return QRCode.toString(token, { type: "svg", errorCorrectionLevel: "M", margin: 2 });
}
