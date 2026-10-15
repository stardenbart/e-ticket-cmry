import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { AuthShell, safeNext } from "@/components/site/auth-shell";
import { LoginForm } from "./login-form";
import { GoogleButton, OrDivider } from "@/components/site/google-button";
import { env } from "@/lib/env";

const GOOGLE_MSG: Record<string, string> = {
  batal: "Login dengan Google dibatalkan.",
  gagal: "Login dengan Google gagal. Coba lagi, atau masuk dengan NIK + password.",
  nonaktif: "Login dengan Google belum diaktifkan.",
  "nonaktif-akun": "Akun ini dinonaktifkan. Hubungi panitia.",
  "akun-lain": "Email ini sudah tertaut ke akun Google lain. Masuk dengan NIK + password.",
};

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Masuk" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next, "/");
  const u = await currentUser();
  if (u) redirect(next);
  return (
    <AuthShell
      title="Masuk ke akun Anda"
      subtitle={
        <>
          Belum punya akun?{" "}
          <Link href={`/daftar${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-cimory-blue hover:underline">
            Daftar dengan NIK
          </Link>
        </>
      }
    >
      {sp.google && GOOGLE_MSG[sp.google] && (
        <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-warn ring-1 ring-amber-200">{GOOGLE_MSG[sp.google]}</p>
      )}
      {env.GOOGLE_ENABLED && (
        <>
          <GoogleButton next={next} />
          <OrDivider />
        </>
      )}
      {sp.reset === "1" && <p className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-ok ring-1 ring-green-200">Password berhasil diubah. Silakan masuk.</p>}
      <LoginForm next={next} />
    </AuthShell>
  );
}
