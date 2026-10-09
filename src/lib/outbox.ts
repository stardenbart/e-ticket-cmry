import { sql, type Tx } from "./db";

export type OutboxType =
  | "OTP_EMAIL"
  | "TICKET_ISSUED"
  | "TICKET_RESEND"
  | "TICKET_REISSUED"
  | "TICKET_CANCELLED"
  | "EVENT_CANCELLED"
  | "STAFF_INVITE"
  | "REMINDER_H3"
  | "ADMIN_ALERT";

/** Antrekan pesan untuk worker. Panggil di transaksi yang sama dengan perubahan datanya. */
export async function enqueue(type: OutboxType, payload: Record<string, unknown>, tx: Tx | typeof sql = sql) {
  await tx`INSERT INTO outbox (type, payload) VALUES (${type}, ${tx.json(payload as never)})`;
}
