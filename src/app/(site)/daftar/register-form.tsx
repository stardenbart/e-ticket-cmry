"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, Field, Input, Spinner } from "@/components/ui";
import { api, ClientApiError } from "@/lib/client-api";
import { PasswordInput } from "@/components/site/password-input";
import { NameField, NikField, checkBiodata } from "@/components/site/nik-fields";

/** Daftar akun dengan NIK karyawan. NIK + nama dicek ke daftar karyawan eligible di server. */
export function RegisterForm({ next }: { next: string }) {
  const router = useRouter();
  const [f, setF] = useState({ nik: "", fullName: "", email: "", password: "", agree: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({});

  const pwOk = f.password.length >= 8;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const fe: Record<string, string> = checkBiodata(f.nik, f.fullName);
    if (!/^\S+@\S+\.\S+$/.test(f.email)) fe.email = "Format email tidak valid.";
    if (!pwOk) fe.password = "Password minimal 8 karakter.";
    if (!f.agree) fe.agree = "Anda harus menyetujui S&K dan kebijakan privasi.";
    setFieldErr(fe);
    if (Object.keys(fe).length) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ verified?: boolean }>("/api/auth/register", {
        json: { ...f, email: f.email.trim(), fullName: f.fullName.trim() },
      });
      if (r.verified) {
        router.push(next);
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
      <NikField value={f.nik} onChange={(nik) => setF({ ...f, nik })} error={fieldErr.nik} />
      <NameField value={f.fullName} onChange={(fullName) => setF({ ...f, fullName })} error={fieldErr.fullName} />
      <Field label="Email" htmlFor="email" error={fieldErr.email} hint="Tiket QR dan kode lupa password dikirim ke email ini.">
        <Input id="email" type="email" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="nama@email.com" />
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
            <Link href="/privasi" target="_blank" className="font-semibold text-cimory-blue underline">Kebijakan Privasi</Link>, termasuk pemakaian NIK, nama, dan departemen untuk verifikasi peserta.
          </span>
        </label>
        {fieldErr.agree && <p className="mt-1 text-sm text-cimory-red-dark">{fieldErr.agree}</p>}
      </div>
      {error && <Alert tone="red">{error}</Alert>}
      <Button type="submit" disabled={busy} className="w-full">
        {busy && <Spinner />} Daftar
      </Button>
    </form>
  );
}
