import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { AuthShell, safeNext } from "@/components/site/auth-shell";
import { GOOGLE_PENDING_COOKIE, readPending } from "@/lib/google";
import { GoogleCompleteForm } from "./google-complete-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Lengkapi pendaftaran" };

export default async function GoogleCompletePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next, "/");
  if (await currentUser()) redirect(next);
  const pending = await readPending((await cookies()).get(GOOGLE_PENDING_COOKIE)?.value);
  if (!pending) redirect(`/daftar?next=${encodeURIComponent(next)}`);
  return (
    <AuthShell
      title="Satu langkah lagi"
      subtitle={
        <>
          Masuk sebagai <b>{pending.email}</b>. Isi NIK dan nama sesuai data karyawan.{" "}
          <Link href={`/daftar?next=${encodeURIComponent(next)}`} className="font-semibold text-cimory-blue hover:underline">
            Bukan akun Anda?
          </Link>
        </>
      }
    >
      <GoogleCompleteForm next={next} />
    </AuthShell>
  );
}
