import crypto from "node:crypto";
import { env } from "./env";

export const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString("base64url");

export function hmac(secret: string, data: string) {
  return crypto.createHmac("sha256", secret).update(data).digest("hex");
}

export function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

/** Normalisasi nomor identitas: huruf besar, tanpa spasi/tanda baca. */
export function normalizeIdentity(idType: string, number: string) {
  return `${idType}:${number.toUpperCase().replace(/[^0-9A-Z]/g, "")}`;
}

/** Hash HMAC nomor identitas. Nomor lengkap tidak pernah disimpan. */
export function identityHash(idType: string, number: string) {
  return hmac(env.IDENTITY_HMAC_SECRET, normalizeIdentity(idType, number));
}

export function otpHash(userId: string, purpose: string, code: string) {
  return hmac(env.IDENTITY_HMAC_SECRET, `otp:${userId}:${purpose}:${code}`);
}

export function randomOtp() {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

// ---- Password (scrypt bawaan Node) ----
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const key = await new Promise<Buffer>((res, rej) =>
    crypto.scrypt(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p }, (e, k) => (e ? rej(e) : res(k))),
  );
  return `scrypt$${SCRYPT.N}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const [algo, n, saltB64, keyB64] = stored.split("$");
  if (algo !== "scrypt") return false;
  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(keyB64, "base64");
  const key = await new Promise<Buffer>((res, rej) =>
    crypto.scrypt(password, salt, expected.length, { N: Number(n), r: SCRYPT.r, p: SCRYPT.p }, (e, k) => (e ? rej(e) : res(k))),
  );
  return crypto.timingSafeEqual(key, expected);
}

// ---- Token bertanda tangan HMAC (admission token, dsb.) ----
export function signToken(payload: object): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", env.APP_SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyToken<T>(token: string): T | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", env.APP_SECRET).update(body).digest("base64url");
  if (!safeEqual(sig, expected)) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString()) as T;
  } catch {
    return null;
  }
}

// ---- Enkripsi simetris (AES-256-GCM) untuk data sensitif yang harus transit lewat outbox ----
function aesKey() {
  return crypto.createHash("sha256").update(`enc:${env.APP_SECRET}`).digest();
}

export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", aesKey(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64url")).join(".");
}

export function decrypt(token: string): string {
  const [iv, tag, enc] = token.split(".").map((s) => Buffer.from(s, "base64url"));
  const d = crypto.createDecipheriv("aes-256-gcm", aesKey(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}
