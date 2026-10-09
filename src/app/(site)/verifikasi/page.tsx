import type { Metadata } from "next";
import { AuthShell, safeNext } from "@/components/site/auth-shell";
import { VerifyForm } from "./verify-form";

export const metadata: Metadata = { title: "Verifikasi Email" };

export default async function VerifyPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const email = (sp.email ?? "").toLowerCase();
  const next = safeNext(sp.next, "/");
  return (
    <AuthShell
      title="Verifikasi email"
      subtitle={
        email ? (
          <>
            Masukkan 6 digit kode yang kami kirim ke <span className="font-semibold text-ink">{email}</span>. Kode berlaku 5 menit.
          </>
        ) : (
          "Masukkan email dan kode verifikasi yang kami kirim."
        )
      }
    >
      <VerifyForm initialEmail={email} next={next} />
    </AuthShell>
  );
}
