// Aturan NIK karyawan, nama, dan ukuran baju — dipakai server dan form di browser.

export type EmployeeCategory = "CMD" | "OS";

/** CMD: 04.xxxx — OS (outsourcing): A1.xx.xxxx. x = angka, jumlah digit boleh berbeda. */
export const NIK_PATTERNS: Record<EmployeeCategory, RegExp> = {
  CMD: /^04\.\d{1,8}$/,
  OS: /^A1\.\d{1,4}\.\d{1,8}$/,
};

export const NIK_HINT = "Format NIK: 04.xxxx untuk karyawan CMD, A1.xx.xxxx untuk karyawan OS (x = angka; jumlah digit boleh berbeda).";

export const SHIRT_SIZES = ["2S", "3S", "4S", "XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL", "5XL"] as const;
export type ShirtSize = (typeof SHIRT_SIZES)[number];

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

/** Nama wajib huruf kapital sesuai KTP: hanya huruf A–Z, spasi, titik, koma, apostrof, tanda hubung. */
export function validateName(raw: string): { ok: true; name: string } | { ok: false; message: string } {
  const name = raw.replace(/\s+/g, " ").trim();
  if (name.length < 2) return { ok: false, message: "Nama wajib diisi sesuai KTP." };
  if (name.length > 150) return { ok: false, message: "Nama terlalu panjang." };
  if (/[a-z]/.test(name)) return { ok: false, message: "Nama wajib ditulis HURUF KAPITAL semua, sesuai KTP." };
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
