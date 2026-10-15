// Login / daftar dengan akun Google (OAuth 2.0 authorization code + PKCE, tanpa library tambahan).
// id_token diverifikasi tanda tangannya (RS256) dengan kunci publik Google (JWKS), lalu iss/aud/exp/email_verified.
import crypto from "node:crypto";
import { env } from "./env";
import { redis } from "./redis";
import { randomToken } from "./crypto";
import { ApiError } from "./http";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"]);

export const GOOGLE_STATE_COOKIE = "g_state";
export const GOOGLE_PENDING_COOKIE = "g_pending";
const STATE_TTL_SEC = 10 * 60;
const PENDING_TTL_SEC = 20 * 60;

export const redirectUri = () => `${env.APP_URL.replace(/\/$/, "")}/api/auth/google/callback`;

/** Mulai alur: simpan state + PKCE verifier di Redis, kembalikan URL Google. */
export async function startGoogleAuth(next: string) {
  if (!env.GOOGLE_ENABLED) throw new ApiError(404, "GOOGLE_DISABLED", "Login dengan Google belum diaktifkan.");
  const state = randomToken(24);
  const verifier = randomToken(48);
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  await redis.set(`gstate:${state}`, JSON.stringify({ verifier, next }), "EX", STATE_TTL_SEC);
  const url = new URL(AUTH_URL);
  url.search = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  return { state, url: url.toString(), maxAge: STATE_TTL_SEC };
}

export type GoogleIdentity = { sub: string; email: string; name: string };

/** Tukar `code` → id_token, verifikasi, kembalikan identitas Google + tujuan `next`. */
export async function finishGoogleAuth(code: string, state: string, cookieState: string | undefined) {
  if (!cookieState || cookieState !== state) throw new ApiError(400, "GOOGLE_STATE", "Sesi login Google tidak cocok. Coba lagi.");
  const raw = await redis.getdel(`gstate:${state}`);
  if (!raw) throw new ApiError(400, "GOOGLE_STATE", "Sesi login Google kedaluwarsa. Coba lagi.");
  const { verifier, next } = JSON.parse(raw) as { verifier: string; next: string };

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
  });
  if (!res.ok) throw new ApiError(400, "GOOGLE_TOKEN", "Google menolak login. Coba lagi.");
  const { id_token } = (await res.json()) as { id_token?: string };
  if (!id_token) throw new ApiError(400, "GOOGLE_TOKEN", "Google tidak mengirim identitas. Coba lagi.");
  return { identity: await verifyIdToken(id_token), next };
}

type Jwk = { kid: string; kty: string; n: string; e: string; alg?: string; use?: string };
let jwksCache: { at: number; keys: Jwk[] } | null = null;

async function googleKeys(force = false): Promise<Jwk[]> {
  if (!force && jwksCache && Date.now() - jwksCache.at < 6 * 3600_000) return jwksCache.keys;
  const r = await fetch(JWKS_URL);
  if (!r.ok) throw new ApiError(503, "GOOGLE_JWKS", "Tidak dapat menghubungi Google. Coba lagi.");
  const { keys } = (await r.json()) as { keys: Jwk[] };
  jwksCache = { at: Date.now(), keys };
  return keys;
}

async function verifyIdToken(token: string): Promise<GoogleIdentity> {
  const [h, p, s] = token.split(".");
  if (!h || !p || !s) throw new ApiError(400, "GOOGLE_TOKEN", "Token Google tidak valid.");
  const header = JSON.parse(Buffer.from(h, "base64url").toString()) as { alg: string; kid: string };
  if (header.alg !== "RS256") throw new ApiError(400, "GOOGLE_TOKEN", "Token Google tidak valid.");
  let jwk = (await googleKeys()).find((k) => k.kid === header.kid);
  if (!jwk) jwk = (await googleKeys(true)).find((k) => k.kid === header.kid); // kunci baru dirotasi
  if (!jwk) throw new ApiError(400, "GOOGLE_TOKEN", "Kunci token Google tidak dikenal.");
  const key = crypto.createPublicKey({ key: jwk, format: "jwk" });
  const valid = crypto.verify("RSA-SHA256", Buffer.from(`${h}.${p}`), key, Buffer.from(s, "base64url"));
  if (!valid) throw new ApiError(400, "GOOGLE_TOKEN", "Tanda tangan token Google tidak valid.");

  const c = JSON.parse(Buffer.from(p, "base64url").toString()) as {
    iss: string; aud: string; exp: number; sub: string; email?: string; email_verified?: boolean | string; name?: string;
  };
  const now = Math.floor(Date.now() / 1000);
  if (!ISSUERS.has(c.iss) || c.aud !== env.GOOGLE_CLIENT_ID || c.exp < now - 60) {
    throw new ApiError(400, "GOOGLE_TOKEN", "Token Google tidak berlaku. Coba lagi.");
  }
  if (!c.email || !(c.email_verified === true || c.email_verified === "true")) {
    throw new ApiError(400, "GOOGLE_EMAIL", "Email akun Google belum terverifikasi.");
  }
  return { sub: c.sub, email: c.email.toLowerCase(), name: c.name ?? "" };
}

/** Akun Google baru yang belum punya akun di sini: simpan sementara sampai NIK dilengkapi. */
export async function savePending(identity: GoogleIdentity, next: string) {
  const token = randomToken(24);
  await redis.set(`gpending:${token}`, JSON.stringify({ ...identity, next }), "EX", PENDING_TTL_SEC);
  return { token, maxAge: PENDING_TTL_SEC };
}

export async function readPending(token: string | undefined) {
  if (!token) return null;
  const raw = await redis.get(`gpending:${token}`);
  return raw ? (JSON.parse(raw) as GoogleIdentity & { next: string }) : null;
}

export const dropPending = (token: string) => redis.del(`gpending:${token}`);

/** Hanya izinkan redirect internal (cegah open redirect). */
export function safeNext(next: string | null | undefined) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}
