import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { sql } from "./db";
import { randomToken, sha256 } from "./crypto";
import { ApiError } from "./http";
import { env } from "./env";

export type Role = "ATTENDEE" | "GATE_STAFF" | "EVENT_ADMIN" | "SUPER_ADMIN";

export type SessionUser = {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  id_type: string | null;
  id_last4: string | null;
  identity_hash: string | null;
  email_verified_at: Date | null;
};

export const SESSION_COOKIE = "sid";
const TTL_ATTENDEE_SEC = 7 * 24 * 3600;
const TTL_STAFF_SEC = 12 * 3600;

export const isAdminRole = (r: Role) => r === "EVENT_ADMIN" || r === "SUPER_ADMIN";
export const isStaffRole = (r: Role) => r !== "ATTENDEE";
export const profileComplete = (u: Pick<SessionUser, "full_name" | "id_type" | "identity_hash" | "email_verified_at">) =>
  !!(u.email_verified_at && u.full_name && u.id_type && u.identity_hash);

export async function createSession(userId: string, role: Role, meta?: { ip?: string; userAgent?: string }) {
  const token = randomToken(32);
  const ttl = role === "ATTENDEE" ? TTL_ATTENDEE_SEC : TTL_STAFF_SEC;
  await sql`
    INSERT INTO sessions (token_hash, user_id, expires_at, ip, user_agent)
    VALUES (${sha256(token)}, ${userId}, now() + make_interval(secs => ${ttl}), ${meta?.ip ?? null}, ${meta?.userAgent?.slice(0, 300) ?? null})`;
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: "lax",
    path: "/",
    maxAge: ttl,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await sql`DELETE FROM sessions WHERE token_hash = ${sha256(token)}`;
  jar.delete(SESSION_COOKIE);
}

/** Pengguna yang sedang login (di-cache per request). */
export const currentUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [u] = await sql<SessionUser[]>`
    SELECT u.id, u.email, u.full_name, u.role, u.id_type, u.id_last4, u.identity_hash, u.email_verified_at
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ${sha256(token)} AND s.expires_at > now() AND u.disabled_at IS NULL`;
  return u ?? null;
});

/** Untuk route handler API: wajib login, opsional batasi peran. */
export async function requireUser(roles?: Role[]): Promise<SessionUser> {
  const u = await currentUser();
  if (!u) throw new ApiError(401, "UNAUTHENTICATED", "Silakan login terlebih dulu.");
  if (roles && !roles.includes(u.role)) throw new ApiError(403, "FORBIDDEN", "Anda tidak punya akses ke fitur ini.");
  return u;
}

export const requireAdmin = () => requireUser(["EVENT_ADMIN", "SUPER_ADMIN"]);
export const requireSuperAdmin = () => requireUser(["SUPER_ADMIN"]);

/** Untuk server component: redirect ke login bila belum login / tidak berhak. */
export async function requirePageUser(roles?: Role[], loginPath = "/login"): Promise<SessionUser> {
  const u = await currentUser();
  if (!u) {
    const h = await headers();
    const next = h.get("x-pathname") ?? "/";
    redirect(`${loginPath}?next=${encodeURIComponent(next)}`);
  }
  if (roles && !roles.includes(u.role)) redirect("/");
  return u;
}
