import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { GOOGLE_STATE_COOKIE, safeNext, startGoogleAuth } from "@/lib/google";
import { cookieSecure } from "@/lib/auth";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/** GET /api/auth/google?next=/... — arahkan ke layar pilih akun Google. */
export async function GET(req: NextRequest) {
  if (!env.GOOGLE_ENABLED) return NextResponse.redirect(new URL("/login?google=nonaktif", env.APP_URL));
  const { state, url, maxAge } = await startGoogleAuth(safeNext(req.nextUrl.searchParams.get("next")));
  (await cookies()).set(GOOGLE_STATE_COOKIE, state, { httpOnly: true, secure: await cookieSecure(), sameSite: "lax", path: "/api/auth/google", maxAge });
  return NextResponse.redirect(url);
}
