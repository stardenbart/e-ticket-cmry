import { sql } from "./db";
import { cleanNik, parseIdentity } from "./employee-shared";

export type AccountRef = { id: string; email: string; full_name: string };

/**
 * Kondisi SQL untuk mencari akun dari email (mengandung "@"), NIK karyawan, atau NIK KTP (16 digit,
 * dipetakan ke NIK karyawan lewat daftar karyawan). `key` dipakai untuk rate limit.
 */
export function accountLookup(identifier: string) {
  const raw = identifier.trim();
  const byEmail = raw.includes("@");
  if (byEmail) {
    const key = raw.toLowerCase();
    return { key, byEmail, where: sql`lower(email) = ${key}` };
  }
  const id = parseIdentity(raw);
  if (id.ok && id.kind === "KTP") {
    return { key: id.ktp, byEmail, where: sql`nik = (SELECT nik FROM employees WHERE nik_ktp = ${id.ktp})` };
  }
  const key = cleanNik(raw);
  return { key, byEmail, where: sql`nik = ${key}` };
}

/** Cari akun dari email, NIK karyawan, atau NIK KTP. */
export async function findAccount(identifier: string): Promise<{ key: string; byEmail: boolean; user: AccountRef | null }> {
  const { key, byEmail, where } = accountLookup(identifier);
  const [user] = await sql<AccountRef[]>`SELECT id, email, full_name FROM users WHERE ${where} AND disabled_at IS NULL`;
  return { key, byEmail, user: user ?? null };
}

/** "abdullah@gmail.com" → "ab•••••@gmail.com" */
export function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  return `${local.slice(0, 2)}${"•".repeat(Math.max(3, local.length - 2))}@${domain}`;
}
