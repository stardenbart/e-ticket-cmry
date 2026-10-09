import { sql } from "../db";

export type ParticipantRow = {
  id: string;
  holder_name: string;
  email: string;
  user_id: string;
  category_id: string;
  category_name: string;
  status: string;
  version: number;
  id_type: string;
  id_last4: string | null;
  email_status: string;
  issued_at: Date;
  cancelled_at: Date | null;
  checked_in_at: Date | null;
  checked_in_gate: string | null;
};

export const STATUS_FILTER: Record<string, string[]> = {
  aktif: ["ACTIVE"],
  batal: ["CANCELLED", "REVOKED"],
  checkin: ["CHECKED_IN"],
};

export async function queryParticipants(eventId: string, f: { q?: string; status?: string; categoryId?: string; limit?: number; offset?: number }) {
  const q = f.q?.trim();
  const like = q ? `%${q.replace(/[%_]/g, "")}%` : null;
  const statuses = f.status ? STATUS_FILTER[f.status] : null;
  const where = () => sql`
    WHERE t.event_id = ${eventId}
      ${statuses ? sql`AND t.status IN ${sql(statuses)}` : sql``}
      ${f.categoryId ? sql`AND t.category_id = ${f.categoryId}` : sql``}
      ${like ? sql`AND (t.holder_name ILIKE ${like} OR u.email ILIKE ${like} OR t.id::text ILIKE ${like})` : sql``}`;
  const rows = await sql<ParticipantRow[]>`
    SELECT t.id, t.holder_name, u.email, t.user_id, t.category_id, c.name AS category_name, t.status, t.version, t.id_type, t.id_last4,
           t.email_status, t.issued_at, t.cancelled_at, t.checked_in_at, t.checked_in_gate
    FROM tickets t JOIN users u ON u.id = t.user_id JOIN ticket_categories c ON c.id = t.category_id
    ${where()}
    ORDER BY t.issued_at DESC
    ${f.limit ? sql`LIMIT ${f.limit} OFFSET ${f.offset ?? 0}` : sql``}`;
  const [{ total }] = await sql<{ total: number }[]>`
    SELECT count(*)::int AS total FROM tickets t JOIN users u ON u.id = t.user_id ${where()}`;
  return { rows, total };
}
