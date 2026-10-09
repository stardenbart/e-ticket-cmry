import { sql } from "./db";

/** Domain email sekali pakai, dari daftar blokir yang bisa diperbarui admin. */
export async function isDisposableEmail(email: string) {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return true;
  const parts = domain.split(".");
  const candidates = parts.map((_, i) => parts.slice(i).join(".")).filter((d) => d.includes("."));
  const [row] = await sql`SELECT 1 FROM blocked_email_domains WHERE domain IN ${sql(candidates)} LIMIT 1`;
  return !!row;
}
