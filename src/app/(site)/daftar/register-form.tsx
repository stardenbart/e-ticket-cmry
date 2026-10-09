"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, Field, Input, Spinner } from "@/components/ui";
import { api, ClientApiError } from "@/lib/client-api";
import { PasswordInput } from "@/components/site/password-input";

export function RegisterForm({ next }: { next: string }) {
  const router = useRouter();
  const [f, setF] = useState({ email: "", password: "", fullName: "", agree: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({});

  const pwOk = f.password.length >= 8;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const fe: Record<string, string> = {};
    if (!/^\S+@\S+\.\S+$/.test(f.email)) fe.email = "Format email tidak valid.";
    if (!pwOk) fe.password = "Password minimal 8 karakter.";
    if (f.fullName.trim().length < 2) fe.fullName = "Nama minimal 2 karakter.";
    if (!f.agree) fe.agree = "Anda harus menyetujui S&K dan kebijakan privasi.";
    setFieldErr(fe);
    if (Object.keys(fe).length) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ verified?: boolean }>("/api/auth/register", { json: { ...f, email: f.email.trim(), fullName: f.fullName.trim() } });
      if (r.verified) {
        // Akun langsung aktif: lanjut lengkapi profil identitas.
        router.push(`/profil?next=${encodeURIComponent(next)}`);
        router.refresh();
      } else {
        router.push(`/verifikasi?email=${encodeURIComponent(f.email.trim().toLowerCase())}&next=${encodeURIComponent(next)}`);
      }
    } catch (err) {
      const e = err instanceof ClientApiError ? err : null;
      if (e?.data.fields) setFieldErr(Object.fromEntries(e.data.fields.map((x) => [x.path, x.message])));
      setError(e?.message ?? "Pendaftaran gagal. Coba lagi.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label="Email" htmlFor="email" error={fieldErr.email} hint="Tiket QR akan dikirim ke email ini — pastikan tidak salah ketik.">
        <Input id="email" type="email" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="nama@email.com" />
      </Field>
      <Field label="Nama lengkap sesuai identitas" htmlFor="fullName" error={fieldErr.fullName} hint="Nama ini akan tercetak di tiket dan dicocokkan dengan KTP/SIM/Paspor di gate.">
        <Input id="fullName" autoComplete="name" value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} placeholder="Sesuai KTP/SIM/Paspor" />
      </Field>
      <Field
        label="Password"
        htmlFor="password"
        error={fieldErr.password}
        hint={<span className={pwOk ? "text-ok" : ""}>{pwOk ? "✓ " : ""}Minimal 8 karakter.</span>}
      >
        <PasswordInput id="password" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
      </Field>
      <div>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" checked={f.agree} onChange={(e) => setF({ ...f, agree: e.target.checked })} className="mt-0.5 size-5 shrink-0 accent-cimory-blue" />
          <span>
            Saya menyetujui{" "}
            <Link href="/syarat" target="_blank" className="font-semibold text-cimory-blue underline">Syarat &amp; Ketentuan</Link> dan{" "}
            <Link href="/privasi" target="_blank" className="font-semibold text-cimory-blue underline">Kebijakan Privasi</Link>, termasuk pemrosesan data identitas untuk verifikasi di gate dan pencegahan calo.
          </span>
        </label>
        {fieldErr.agree && <p className="mt-1 text-sm text-cimory-red-dark">{fieldErr.agree}</p>}
      </div>
      {error && <Alert tone="red">{error}</Alert>}
      <Button type="submit" disabled={busy} className="w-full">
        {busy && <Spinner />} Daftar &amp; kirim kode
      </Button>
    </form>
  );
}
