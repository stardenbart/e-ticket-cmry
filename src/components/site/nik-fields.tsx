"use client";

// Input biodata karyawan: NIK (karyawan 04.xxxx / A1.xx.xxxx atau NIK KTP 16 digit), nama HURUF KAPITAL, nomor HP.
import { Field, Input, Select } from "@/components/ui";
import { SHIRT_SIZES, apostropheToSpace, parseIdentity, validateName, validatePhone } from "@/lib/employee-shared";

export function NikField({ value, onChange, error, id = "nik" }: { value: string; onChange: (v: string) => void; error?: string; id?: string }) {
  const parsed = value ? parseIdentity(value) : null;
  const detected =
    parsed?.ok && parsed.kind === "KTP"
      ? "NIK KTP"
      : parsed?.ok && parsed.kind === "NIK"
        ? `NIK karyawan ${parsed.category === "CMD" ? "CMD" : "OS (outsourcing)"}`
        : null;
  return (
    <Field
      label="NIK Karyawan atau NIK KTP"
      htmlFor={id}
      error={error}
      hint={
        detected ? (
          <span className="text-ok">✓ Terbaca sebagai {detected}</span>
        ) : (
          <>
            Cukup isi <b>salah satu</b>: Nomor Induk Karyawan (<b>04.xxxx</b> / <b>A1.xx.xxxx</b>) atau NIK KTP (<b>16 digit</b>).
          </>
        )
      }
    >
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase().replace(/\s+/g, ""))}
        placeholder="04.12345 / A1.23.4567 / 3201xxxxxxxxxxxx"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        inputMode="text"
        maxLength={20}
        className="font-mono tracking-wider"
      />
    </Field>
  );
}

export function NameField({ value, onChange, error, id = "fullName", hint }: { value: string; onChange: (v: string) => void; error?: string; id?: string; hint?: React.ReactNode }) {
  return (
    <Field
      label="Nama lengkap (HURUF KAPITAL, sesuai Kartu Karyawan)"
      htmlFor={id}
      error={error}
      hint={
        hint ?? (
          <>
            Tulis lengkap tanpa singkatan, persis seperti di Kartu Karyawan. Contoh: MUHAMMAD RIZKI PRATAMA
            <span className="mt-1 block">
              Tanda <b>&apos;</b> diganti spasi: <b>RIVA&apos;I</b> ditulis <b>RIVA I</b>.
            </span>
          </>
        )
      }
    >
      <Input
        id={id}
        value={value}
        // Huruf otomatis menjadi kapital dan tanda ' otomatis menjadi spasi saat diketik.
        onChange={(e) => onChange(apostropheToSpace(e.target.value.toUpperCase()))}
        placeholder="NAMA SESUAI KARTU KARYAWAN"
        autoComplete="name"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={150}
        className="uppercase"
      />
    </Field>
  );
}

export function PhoneField({ value, onChange, error, id = "phone" }: { value: string; onChange: (v: string) => void; error?: string; id?: string }) {
  return (
    <Field label="Nomor HP (WhatsApp)" htmlFor={id} error={error} hint="Dipakai panitia untuk menghubungi Anda bila perlu. Contoh: 081234567890.">
      <Input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d+\s-]/g, ""))}
        placeholder="08xxxxxxxxxx"
        maxLength={18}
      />
    </Field>
  );
}

export function ShirtSizeField({ value, onChange, error, id = "shirtSize" }: { value: string; onChange: (v: string) => void; error?: string; id?: string }) {
  return (
    <Field label="Ukuran baju" htmlFor={id} error={error} hint="Pilih ukuran kaos acara yang Anda inginkan.">
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Pilih ukuran…</option>
        {SHIRT_SIZES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </Select>
    </Field>
  );
}

/** Validasi di browser (server tetap memvalidasi ulang). */
export function checkBiodata(nik: string, name: string, phone?: string): Record<string, string> {
  const fe: Record<string, string> = {};
  const id = parseIdentity(nik);
  if (!id.ok) fe.nik = id.message;
  const n = validateName(name);
  if (!n.ok) fe.fullName = n.message;
  if (phone !== undefined) {
    const p = validatePhone(phone);
    if (!p.ok) fe.phone = p.message;
  }
  return fe;
}
