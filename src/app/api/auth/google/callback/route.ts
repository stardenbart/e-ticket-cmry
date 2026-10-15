import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { sql } from "@/lib/db";
import { ApiError, clientIp } from "@/lib/http";
import { createSession, cookieSecure, isAdminRole, type Role } from "@/lib/auth";
import { env } from "@/lib/env";
import { audit } from "@/lib/audit";
import { GOOGLE_PENDING_COOKIE, GOOGLE_STATE_COOKIE, finishGoogleAuth, savePending } from "@/lib/google";

export const dynamic = "force-dynamic";

const to = (path: string) => NextResponse.redirect(new URL(path, env.APP_URL));

/**
 * Kembali dari Google. Akun yang sudah ada (cocok `sub` Google atau email) langsung masuk tanpa kode/2FA;
 * akun Google baru diarahkan melengkapi NIK + nama di /daftar/google.
 */
export async function GET(req: NextRequest) {
  const jar = await cookies();
  const sp = req.nextUrl.searchParams;
  if (sp.get("error")) return to("/login?google=batal");
  const code = sp.get("code");
  const state = sp.get("state");
  if (!code || !state) return to("/login?google=gagal");

  let result;
  try {
    result = await finishGoogleAuth(code, state, jar.get(GOOGLE_STATE_COOKIE)?.value);
  } catch (e) {
    console.error("[google] callback", e instanceof ApiError ? e.code : e);
    return to("/login?google=gagal");
  } finally {
    jar.delete({ name: GOOGLE_STATE_COOKIE, path: "/api/auth/google" });
  }
  const { identity, next } = result;

  const [u] = await sql<{ id: string; role: Role; nik: string | null; google_sub: string | null; disabled_at: Date | null }[]>`
    SELECT id, role, nik, google_sub, disabled_at FROM users
    WHERE google_sub = ${identity.sub} OR lower(email) = ${identity.email}
    ORDER BY (google_sub = ${identity.sub}) DESC NULLS LAST
    LIMIT 1`;

  if (u) {
    if (u.disabled_at) return to("/login?google=nonaktif-akun");
    if (u.google_sub && u.google_sub !== identity.sub) return to("/login?google=akun-lain");
    // Email dari Google sudah terverifikasi → tautkan akun & tandai email terverifikasi.
    await sql`UPDATE users SET google_sub = ${identity.sub}, email_verified_at = coalesce(email_verified_at, now()) WHERE id = ${u.id}`;
    await createSession(u.id, u.role, { ip: clientIp(req), userAgent: req.headers.get("user-agent") ?? undefined });
    if (u.role !== "ATTENDEE") await audit({ actorId: u.id, action: "auth.login_google", entity: "user", entityId: u.id, ip: clientIp(req) });
    if (isAdminRole(u.role)) return to(next.startsWith("/admin") ? next : "/admin");
    if (u.role === "GATE_STAFF") return to(next.startsWith("/scanner") ? next : "/scanner");
    return to(u.nik ? next : `/profil?next=${encodeURIComponent(next)}`);
  }

  const pending = await savePending(identity, next);
  jar.set(GOOGLE_PENDING_COOKIE, pending.token, { httpOnly: true, secure: await cookieSecure(), sameSite: "lax", path: "/", maxAge: pending.maxAge });
  return to(`/daftar/google?next=${encodeURIComponent(next)}`);
}
