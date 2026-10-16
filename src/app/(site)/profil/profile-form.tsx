"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, ButtonLink, Card, Spinner } from "@/components/ui";
import { api, ClientApiError } from "@/lib/client-api";
import { NameField, NikField, PhoneField, checkBiodata } from "@/components/site/nik-fields";
import { validatePhone } from "@/lib/employee-shared";

type Linked = { nik: string; name: string; dept: string | null; category: "CMD" | "OS" | null; eligible: boolean };

/**
 * Profil karyawan: tampilkan data NIK yang tertaut, atau form menautkan NIK (akun lama / akun Google yang
 * belum punya NIK). NIK + nama dicek ke daftar karyawan; nama akun mengikuti data resmi.
 */
export function ProfileForm({ linked, locked, next }: { linked: Linked | null; locked: boolean; next: string | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(!linked);
  const [f, setF] = useState({ nik: linked?.nik ?? "", fullName: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({});

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const fe = checkBiodata(f.nik, f.fullName);
    setFieldErr(fe);
    if (Object.keys(fe).length) return;
    setBusy(true);
    setError(null);
    try {
      await api("/api/profile", { method: "PUT", json: { nik: f.nik, fullName: f.fullName.trim() } });
      if (next) router.push(next);
      else setEditing(false);
      router.refresh();
    } catch (err) {
      const e = err instanceof ClientApiError ? err : null;
      if (e?.data.fields) setFieldErr(Object.fromEntries(e.data.fields.map((x) => [x.path, x.message])));
      setError(e?.message ?? "Gagal menyimpan. Coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  if (linked && !editing) {
    return (
      <Card className="space-y-5 p-6">
        {!linked.eligible && (
          <Alert tone="red" title="NIK tidak ada di daftar karyawan eligible">
            Anda belum bisa memesan tiket. Hubungi panitia bila menurut Anda ini keliru.
          </Alert>
        )}
        <dl className="grid gap-4 sm:grid-cols-2">
          <Item label="NIK" value={<span className="font-mono">{linked.nik}</span>} />
          <Item label="Kategori" value={linked.category === "CMD" ? "Karyawan CMD" : linked.category === "OS" ? "Karyawan OS" : "—"} />
          <Item label="Nama" value={linked.name} />
          <Item label="Departemen" value={linked.dept || "—"} />
        </dl>
        <p className="text-sm text-muted">Nama di tiket mengikuti data karyawan di atas. Saat pemesanan Anda akan diminta mengisi ulang nama, NIK, dan ukuran baju.</p>
        <div className="flex flex-wrap gap-3">
          {next && linked.eligible && <ButtonLink href={next}>Lanjutkan</ButtonLink>}
          {locked ? (
            <p className="text-sm text-muted">Data terkunci karena Anda memegang tiket aktif. Hubungi admin untuk perubahan.</p>
          ) : (
            <Button variant="secondary" onClick={() => setEditing(true)}>
              Ganti NIK
            </Button>
          )}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Alert tone="blue" title={linked ? "Ganti NIK karyawan" : "Tautkan akun ke NIK karyawan"}>
          Hanya karyawan yang terdaftar di daftar peserta yang bisa memesan tiket. Isi NIK karyawan atau NIK KTP (salah satu) dan nama persis seperti data karyawan.
        </Alert>
        <NikField value={f.nik} onChange={(nik) => setF({ ...f, nik })} error={fieldErr.nik} />
        <NameField value={f.fullName} onChange={(fullName) => setF({ ...f, fullName })} error={fieldErr.fullName} />
        {error && <Alert tone="red">{error}</Alert>}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={busy || locked}>
            {busy && <Spinner />} Simpan
          </Button>
          {linked && (
            <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
              Batal
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}

/** Nomor HP akun: bisa diubah kapan saja (juga setelah memegang tiket). */
export function PhoneCard({ phone }: { phone: string | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(!phone);
  const [v, setV] = useState(phone ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const p = validatePhone(v);
    if (!p.ok) return setErr(p.message);
    setBusy(true);
    setErr(null);
    try {
      await api("/api/profile", { method: "PATCH", json: { phone: v } });
      setEditing(false);
      router.refresh();
    } catch (x) {
      setErr(x instanceof ClientApiError ? x.message : "Gagal menyimpan. Coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mt-6 p-6">
      {editing ? (
        <form onSubmit={save} className="space-y-4" noValidate>
          {!phone && <Alert tone="amber">Lengkapi nomor HP Anda agar panitia bisa menghubungi bila perlu.</Alert>}
          <PhoneField value={v} onChange={setV} error={err ?? undefined} />
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={busy}>
              {busy && <Spinner />} Simpan nomor HP
            </Button>
            {phone && (
              <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                Batal
              </Button>
            )}
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <Item label="Nomor HP" value={<span className="font-mono">{phone}</span>} />
          <Button variant="secondary" onClick={() => setEditing(true)}>
            Ubah nomor HP
          </Button>
        </div>
      )}
    </Card>
  );
}

function Item({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</dt>
      <dd className="mt-1 text-lg font-semibold">{value}</dd>
    </div>
  );
}
