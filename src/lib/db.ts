import postgres from "postgres";
import { env } from "./env";

type Sql = postgres.Sql<Record<string, never>>;

const g = globalThis as unknown as { __sql?: Sql };

/** Pool koneksi PostgreSQL bersama (di-cache di globalThis agar aman saat HMR). */
export const sql: Sql =
  g.__sql ??
  (g.__sql = postgres(env.DATABASE_URL, {
    max: Number(process.env.DB_POOL_MAX ?? 40),
    idle_timeout: 30,
    connect_timeout: 10,
    transform: { undefined: null },
    onnotice: () => {},
  }) as Sql);

export type Tx = postgres.TransactionSql<Record<string, never>>;

/** Nama constraint dari error unique/check PostgreSQL, atau null. */
export function pgConstraint(err: unknown): string | null {
  const e = err as { code?: string; constraint_name?: string };
  if (e && (e.code === "23505" || e.code === "23514")) return e.constraint_name ?? null;
  return null;
}

const TRANSIENT = new Set(["UNSAFE_TRANSACTION", "CONNECTION_CLOSED", "CONNECTION_ENDED", "CONNECTION_DESTROYED", "CONNECT_TIMEOUT", "ECONNRESET", "40001", "40P01"]);

/**
 * Ulangi transaksi bila gagal karena error koneksi sementara / serialization / deadlock.
 * Aman karena transaksi yang gagal selalu rollback utuh.
 */
export async function withTxRetry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (i >= tries || !code || !TRANSIENT.has(code)) throw e;
      await new Promise((r) => setTimeout(r, 20 * i + Math.random() * 30));
    }
  }
}
