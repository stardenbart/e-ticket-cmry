"use client";

// Input biodata karyawan: NIK (format 04.XXXXX / A1.XX.XXXX) dan nama HURUF KAPITAL sesuai KTP.
import { Field, Input, Select } from "@/components/ui";
import { SHIRT_SIZES, cleanNik, nikCategory, validateName } from "@/lib/employee-shared";

export function NikField({ value, onChange, error, id = "nik" }: { value: string; onChange: (v: string) => void; error?: string; id?: string }) {
  const cat = nikCategory(cleanNik(value));
  return (
    <Field
      label="NIK (Nomor Induk Karyawan)"
      htmlFor={id}
      error={error}
      hint={
        cat ? (
          <span className="text-ok">✓ Format NIK karyawan {cat === "CMD" ? "CMD" : "OS (outsourcing)"}</span>
        ) : (
          <>
            Format: <b>04.XXXXX</b> untuk karyawan CMD, <b>A1.XX.XXXX</b> untuk karyawan OS (X = angka).
          </>
        )
      }
    >
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase().replace(/\s+/g, ""))}
        placeholder="04.12345 atau A1.23.4567"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        inputMode="text"
        maxLength={12}
        className="font-mono tracking-wider"
      />
    </Field>
  );
}

export function NameField({ value, onChange, error, id = "fullName", hint }: { value: string; onChange: (v: string) => void; error?: string; id?: string; hint?: React.ReactNode }) {
  return (
    <Field
      label="Nama lengkap (HURUF KAPITAL, sesuai KTP)"
      htmlFor={id}
      error={error}
      hint={hint ?? "Tulis lengkap tanpa singkatan, persis seperti di KTP. Contoh: MUHAMMAD RIZKI PRATAMA"}
    >
      <Input
        id={id}
        value={value}
        // Huruf otomatis menjadi kapital saat diketik.
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        placeholder="NAMA SESUAI KTP"
        autoComplete="name"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={150}
        className="uppercase"
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
export function checkBiodata(nik: string, name: string): Record<string, string> {
  const fe: Record<string, string> = {};
  if (!nikCategory(cleanNik(nik))) fe.nik = "NIK tidak sesuai format: 04.XXXXX (CMD) atau A1.XX.XXXX (OS).";
  const n = validateName(name);
  if (!n.ok) fe.fullName = n.message;
  return fe;
}
