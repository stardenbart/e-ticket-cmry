import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { AuthShell, safeNext } from "@/components/site/auth-shell";
import { RegisterForm } from "./register-form";
import { GoogleButton, OrDivider } from "@/components/site/google-button";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Daftar" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next, "/");
  if (await currentUser()) redirect(next);
  return (
    <AuthShell
      title="Daftar dengan NIK"
      subtitle={
        <>
          Sudah punya akun?{" "}
          <Link href={`/login${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-cimory-blue hover:underline">
            Masuk
          </Link>
        </>
      }
    >
      {env.GOOGLE_ENABLED && (
        <>
          <GoogleButton next={next} label="Daftar dengan Google" />
          <OrDivider />
        </>
      )}
      <RegisterForm next={next} />
    </AuthShell>
  );
}
