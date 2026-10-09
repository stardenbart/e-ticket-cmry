"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, Card, Field, Input, Spinner, cx } from "@/components/ui";
import { api, ClientApiError } from "@/lib/client-api";
import { ID_TYPES, ID_TYPE_LABEL, validateIdNumber, type IdType } from "@/lib/validation";

const PLACEHOLDER: Record<IdType, string> = { KTP: "16 digit NIK", SIM: "12–16 digit nomor SIM", PASPOR: "Contoh: X1234567" };

export function ProfileForm({
  initial,
  complete,
  locked,
  next,
  isNew,
}: {
  initial: { fullName: string; idType: IdType | null; idLast4: string | null };
  complete: boolean;
  locked: boolean;
  next: string | null;
  isNew: boolean;
}) {
  const router = useRouter();
  const [fullName, setFullName] = useState(initial.fullName);
  const [idType, setIdType] = useState<IdType | null>(initial.idType);
  const [idNumber, setIdNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ tone: "green" | "red"; text: string } | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const fe: Record<string, string> = {};
    if (fullName.trim().length < 2) fe.fullName = "Nama minimal 2 karakter.";
    if (!idType) fe.idType = "Pilih jenis identitas.";
    else {
      const v = validateIdNumber(idType, idNumber);
      if (!v.ok) fe.idNumber = v.message;
    }
    setErr(fe);
    if (Object.keys(fe).length) return;
    setBusy(true);
    setMsg(null);
    try {
      await api("/api/profile", { method: "PUT", json: { fullName: fullName.trim(), idType, idNumber } });
      setIdNumber("");
      if (next) {
        router.push(next);
        router.refresh();
        return;
      }
      setMsg({ tone: "green", text: "Profil tersimpan. Anda siap ikut war tiket!" });
      router.refresh();
    } catch (e2) {
      const e = e2 instanceof ClientApiError ? e2 : null;
      if (e?.data.fields) setErr(Object.fromEntries(e.data.fields.map((x) => [x.path, x.message])));
      setMsg({ tone: "red", text: e?.message ?? "Gagal menyimpan profil." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {isNew && <Alert tone="green" title="Email terverifikasi">Satu langkah lagi: lengkapi identitas agar bisa klaim tiket.</Alert>}
      {!complete && !isNew && <Alert tone="amber" title="Profil belum lengkap">Lengkapi nama dan identitas sebelum masuk antrean atau klaim tiket.</Alert>}
      {locked && (
        <Alert tone="blue" title="Profil terkunci">
          Anda memegang tiket aktif, jadi nama dan identitas dikunci agar sama dengan data di tiket. Untuk perubahan, hubungi admin penyelenggara (perubahan tercatat di audit log).
        </Alert>
      )}

      <Card className="p-5 sm:p-6">
        <form onSubmit={save} className="space-y-5" noValidate>
          <Field label="Nama lengkap sesuai identitas" htmlFor="fullName" error={err.fullName} hint="Nama ini tercetak di tiket dan dicocokkan dengan kartu identitas fisik di gate.">
            <Input id="fullName" value={fullName} disabled={locked} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
          </Field>

          <fieldset>
            <legend className="mb-1.5 text-sm font-semibold">Jenis identitas</legend>
            <div className="grid grid-cols-3 gap-2" role="radiogroup">
              {ID_TYPES.map((t) => (
                <label
                  key={t}
                  className={cx(
                    "flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold transition",
                    idType === t ? "border-cimory-blue bg-blue-50 text-cimory-blue ring-2 ring-cimory-blue/20" : "border-line bg-white hover:bg-slate-50",
                    locked && "cursor-not-allowed opacity-60",
                  )}
                >
                  <input type="radio" name="idType" value={t} checked={idType === t} disabled={locked} onChange={() => setIdType(t)} className="sr-only" />
                  {idType === t && <span aria-hidden>✓</span>}
                  {ID_TYPE_LABEL[t]}
                </label>
              ))}
            </div>
            {err.idType && <p className="mt-1 text-sm text-cimory-red-dark">{err.idType}</p>}
          </fieldset>

          <Field
            label="Nomor identitas"
            htmlFor="idNumber"
            error={err.idNumber}
            hint={
              initial.idLast4
                ? `Tersimpan: •••• ${initial.idLast4}. Isi ulang nomor lengkap untuk mengubah atau menyimpan profil.`
                : "Wajib diisi untuk klaim tiket."
            }
          >
            <Input
              id="idNumber"
              value={idNumber}
              disabled={locked || !idType}
              onChange={(e) => setIdNumber(e.target.value)}
              placeholder={idType ? PLACEHOLDER[idType] : "Pilih jenis identitas dulu"}
              inputMode={idType === "PASPOR" ? "text" : "numeric"}
              autoComplete="off"
            />
          </Field>

          {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
          {!locked && (
            <Button type="submit" disabled={busy} className="w-full">
              {busy && <Spinner />} {next ? "Simpan & lanjutkan" : "Simpan profil"}
            </Button>
          )}
        </form>
      </Card>

      <Card className="p-5 text-sm text-slate-700">
        <p className="font-semibold text-ink">Bagaimana data identitas Anda disimpan?</p>
        <ul className="mt-2 space-y-1.5">
          <li>• Nomor identitas lengkap <b>tidak disimpan</b>. Kami hanya menyimpan hash satu arah (untuk memastikan satu identitas = satu tiket per event) dan 4 digit terakhir (untuk dicocokkan di gate).</li>
          <li>• Data dipakai untuk verifikasi di gate dan mencegah calo.</li>
          <li>• 4 digit terakhir di tiket dianonimkan 30 hari setelah acara selesai. Lihat <a href="/privasi" className="font-semibold text-cimory-blue underline">Kebijakan Privasi</a>.</li>
        </ul>
      </Card>
    </div>
  );
}
