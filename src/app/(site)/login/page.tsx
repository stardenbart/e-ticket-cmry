import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { AuthShell, safeNext } from "@/components/site/auth-shell";
import { LoginForm } from "./login-form";

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
            Daftar gratis
          </Link>
        </>
      }
    >
      {sp.reset === "1" && <p className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-ok ring-1 ring-green-200">Password berhasil diubah. Silakan masuk.</p>}
      <LoginForm next={next} />
    </AuthShell>
  );
}
