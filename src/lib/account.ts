import { sql } from "./db";
import { cleanNik } from "./employee-shared";

export type AccountRef = { id: string; email: string; full_name: string };

/** Cari akun dari NIK karyawan atau email (mengandung "@"). */
export async function findAccount(identifier: string): Promise<{ key: string; byEmail: boolean; user: AccountRef | null }> {
  const raw = identifier.trim();
  const byEmail = raw.includes("@");
  const key = byEmail ? raw.toLowerCase() : cleanNik(raw);
  const [user] = await sql<AccountRef[]>`
    SELECT id, email, full_name FROM users
    WHERE ${byEmail ? sql`lower(email) = ${key}` : sql`nik = ${key}`} AND disabled_at IS NULL`;
  return { key, byEmail, user: user ?? null };
}

/** "abdullah@gmail.com" → "ab•••••@gmail.com" */
export function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  return `${local.slice(0, 2)}${"•".repeat(Math.max(3, local.length - 2))}@${domain}`;
}
