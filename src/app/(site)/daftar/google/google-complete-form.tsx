"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, Spinner } from "@/components/ui";
import { api, ClientApiError } from "@/lib/client-api";
import { NameField, NikField, PhoneField, checkBiodata } from "@/components/site/nik-fields";

export function GoogleCompleteForm({ next }: { next: string }) {
  const router = useRouter();
  const [f, setF] = useState({ nik: "", fullName: "", phone: "", agree: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({});

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const fe = checkBiodata(f.nik, f.fullName, f.phone);
    if (!f.agree) fe.agree = "Anda harus menyetujui S&K dan kebijakan privasi.";
    setFieldErr(fe);
    if (Object.keys(fe).length) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ next: string }>("/api/auth/google/complete", { json: { ...f, fullName: f.fullName.trim() } });
      router.push(r.next || next);
      router.refresh();
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
      <PhoneField value={f.phone} onChange={(phone) => setF({ ...f, phone })} error={fieldErr.phone} />
      <div>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" checked={f.agree} onChange={(e) => setF({ ...f, agree: e.target.checked })} className="mt-0.5 size-5 shrink-0 accent-cimory-blue" />
          <span>
            Saya menyetujui{" "}
            <Link href="/syarat" target="_blank" className="font-semibold text-cimory-blue underline">Syarat &amp; Ketentuan</Link> dan{" "}
            <Link href="/privasi" target="_blank" className="font-semibold text-cimory-blue underline">Kebijakan Privasi</Link>.
          </span>
        </label>
        {fieldErr.agree && <p className="mt-1 text-sm text-cimory-red-dark">{fieldErr.agree}</p>}
      </div>
      {error && <Alert tone="red">{error}</Alert>}
      <Button type="submit" disabled={busy} className="w-full">
        {busy && <Spinner />} Selesaikan pendaftaran
      </Button>
    </form>
  );
}
