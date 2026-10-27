// Aturan NIK karyawan, nama, dan ukuran baju — dipakai server dan form di browser.

export type EmployeeCategory = "CMD" | "OS";

/** CMD: 04.xxxx — OS (outsourcing): A1.xx.xxxx. x = angka, jumlah digit boleh berbeda. */
export const NIK_PATTERNS: Record<EmployeeCategory, RegExp> = {
  CMD: /^04\.\d{1,8}$/,
  OS: /^A1\.\d{1,4}\.\d{1,8}$/,
};

export const NIK_HINT = "Format NIK: 04.xxxx untuk karyawan CMD, A1.xx.xxxx untuk karyawan OS (x = angka; jumlah digit boleh berbeda).";

/** Ukuran yang bisa dipilih saat klaim (mulai S). Tiket lama berukuran 2S–XS tetap sah di database. */
export const SHIRT_SIZES = ["S", "M", "L", "XL", "XXL", "3XL", "4XL", "5XL"] as const;
export type ShirtSize = (typeof SHIRT_SIZES)[number];

/** NIK KTP (Nomor Induk Kependudukan): 16 digit angka. */
export const KTP_PATTERN = /^\d{16}$/;

export type IdentityInput =
  | { ok: true; kind: "NIK"; nik: string; category: EmployeeCategory }
  | { ok: true; kind: "KTP"; ktp: string }
  | { ok: false; message: string };

/**
 * Input "NIK" peserta: boleh Nomor Induk Karyawan (04.xxxx / A1.xx.xxxx) ATAU NIK KTP (16 digit).
 * Cukup salah satu; sistem mencari karyawannya dari yang diisi.
 */
export function parseIdentity(raw: string): IdentityInput {
  const v = cleanNik(raw);
  if (!v) return { ok: false, message: "NIK wajib diisi." };
  const ktp = v.replace(/[.\-]/g, "");
  if (KTP_PATTERN.test(ktp)) return { ok: true, kind: "KTP", ktp };
  const category = nikCategory(v);
  if (category) return { ok: true, kind: "NIK", nik: v, category };
  if (/^\d+$/.test(ktp)) return { ok: false, message: `NIK tidak sesuai format: NIK KTP harus 16 digit (Anda mengisi ${ktp.length} digit), NIK karyawan memakai titik (04.xxxx / A1.xx.xxxx).` };
  return { ok: false, message: `NIK tidak sesuai format. Isi Nomor Induk Karyawan (04.xxxx / A1.xx.xxxx) atau NIK KTP 16 digit.` };
}

/** Nomor HP Indonesia → format 08xxxxxxxxxx (menerima +62 / 62 / spasi / tanda hubung). */
export function validatePhone(raw: string): { ok: true; phone: string } | { ok: false; message: string } {
  let v = raw.replace(/[\s\-().]/g, "");
  if (!v) return { ok: false, message: "Nomor HP wajib diisi." };
  if (v.startsWith("+62")) v = `0${v.slice(3)}`;
  else if (v.startsWith("62")) v = `0${v.slice(2)}`;
  if (!/^08\d{8,12}$/.test(v)) return { ok: false, message: "Nomor HP tidak valid. Contoh: 081234567890." };
  return { ok: true, phone: v };
}

/** Rapikan input NIK: huruf besar, tanpa spasi. Tidak menebak titik yang hilang. */
export function cleanNik(raw: string): string {
  return raw.toUpperCase().replace(/\s+/g, "");
}

export function nikCategory(nik: string): EmployeeCategory | null {
  if (NIK_PATTERNS.CMD.test(nik)) return "CMD";
  if (NIK_PATTERNS.OS.test(nik)) return "OS";
  return null;
}

export function validateNik(raw: string): { ok: true; nik: string; category: EmployeeCategory } | { ok: false; message: string } {
  const nik = cleanNik(raw);
  if (!nik) return { ok: false, message: "NIK wajib diisi." };
  const category = nikCategory(nik);
  if (!category) return { ok: false, message: `NIK tidak sesuai format. ${NIK_HINT}` };
  return { ok: true, nik, category };
}

/** Tanda petik/apostrof pada nama diganti spasi: RIVA'I → RIVA I (sama dengan data karyawan). */
export function apostropheToSpace(name: string): string {
  return name.replace(/['’‘`´]/g, " ");
}

/** Nama wajib huruf kapital sesuai Kartu Karyawan: hanya huruf A–Z, spasi, titik, koma, apostrof, tanda hubung. */
export function validateName(raw: string): { ok: true; name: string } | { ok: false; message: string } {
  const name = apostropheToSpace(raw).replace(/\s+/g, " ").trim();
  if (name.length < 2) return { ok: false, message: "Nama wajib diisi sesuai Kartu Karyawan." };
  if (name.length > 150) return { ok: false, message: "Nama terlalu panjang." };
  if (/[a-z]/.test(name)) return { ok: false, message: "Nama wajib ditulis HURUF KAPITAL semua, sesuai Kartu Karyawan." };
  if (!/^[A-Z .,'\-]+$/.test(name)) return { ok: false, message: "Nama hanya boleh berisi huruf, spasi, titik, koma, apostrof, atau tanda hubung." };
  return { ok: true, name };
}

/** Kunci pencocokan nama: abaikan tanda baca & spasi ganda ("MUH. RIZKI" = "MUH RIZKI"). */
export function nameKey(name: string): string {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}
