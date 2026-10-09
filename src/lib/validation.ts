import { z } from "zod";

export const emailSchema = z.string().trim().toLowerCase().email("Format email tidak valid.").max(254);
export const passwordSchema = z.string().min(8, "Password minimal 8 karakter.").max(128);
export const otpSchema = z.string().trim().regex(/^\d{6}$/, "Kode OTP terdiri dari 6 digit angka.");
export const nameSchema = z.string().trim().min(2, "Nama minimal 2 karakter.").max(100, "Nama maksimal 100 karakter.");

export const ID_TYPES = ["KTP", "SIM", "PASPOR"] as const;
export type IdType = (typeof ID_TYPES)[number];
export const ID_TYPE_LABEL: Record<IdType, string> = { KTP: "KTP", SIM: "SIM", PASPOR: "Paspor" };

/** Validasi nomor identitas per jenis. Mengembalikan nomor ternormalisasi atau pesan error. */
export function validateIdNumber(type: IdType, raw: string): { ok: true; value: string } | { ok: false; message: string } {
  const v = raw.toUpperCase().replace(/[\s.-]/g, "");
  if (type === "KTP") return /^\d{16}$/.test(v) ? { ok: true, value: v } : { ok: false, message: "NIK KTP harus 16 digit angka." };
  if (type === "SIM") return /^\d{12,16}$/.test(v) ? { ok: true, value: v } : { ok: false, message: "Nomor SIM harus 12–16 digit angka." };
  return /^[A-Z0-9]{6,9}$/.test(v) ? { ok: true, value: v } : { ok: false, message: "Nomor paspor harus 6–9 karakter huruf/angka." };
}
