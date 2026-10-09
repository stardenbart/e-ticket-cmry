import { NextResponse, type NextRequest } from "next/server";

// Pemeriksaan optimistis saja: teruskan pathname ke server component (untuk redirect ?next=)
// dan arahkan cepat ke login bila cookie sesi tidak ada. Otorisasi sebenarnya dicek di server per endpoint.
export function proxy(req: NextRequest) {
  const headers = new Headers(req.headers);
  headers.set("x-pathname", req.nextUrl.pathname + req.nextUrl.search);
  const hasSession = req.cookies.has("sid");
  const p = req.nextUrl.pathname;
  if (!hasSession) {
    if (p.startsWith("/admin") && !p.startsWith("/admin/login")) return NextResponse.redirect(new URL(`/admin/login?next=${encodeURIComponent(p)}`, req.url));
    if (p.startsWith("/tiket-saya") || p.startsWith("/profil") || p.startsWith("/antrean") || p.startsWith("/konfirmasi")) {
      return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(p + req.nextUrl.search)}`, req.url));
    }
  }
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|media|favicon.ico|sw.js|manifest.webmanifest).*)"],
};
