import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/site/auth-shell";
import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = { title: "Lupa Password" };

export default function ForgotPage() {
  return (
    <AuthShell
      title="Atur ulang password"
      subtitle={
        <>
          Ingat password Anda?{" "}
          <Link href="/login" className="font-semibold text-cimory-blue hover:underline">
            Masuk
          </Link>
        </>
      }
    >
      <ForgotForm />
    </AuthShell>
  );
}
