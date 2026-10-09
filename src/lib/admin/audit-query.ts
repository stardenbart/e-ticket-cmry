import { sql } from "../db";
import type { Role } from "../auth";

/** Entitas audit yang boleh dilihat Event Admin. Super Admin melihat semuanya (global). */
export const EVENT_ADMIN_ENTITIES = ["event", "category", "ticket", "gate_staff", "checkin", "user"];

export type AuditRow = {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  before: unknown;
  after: unknown;
  ip: string | null;
  at: Date;
};

export async function queryAudit(role: Role, f: { entity?: string; action?: string; actor?: string; entityId?: string; from?: string; to?: string; page?: number }) {
  const PAGE = 50;
  const page = Math.max(1, f.page ?? 1);
  const scope = role === "SUPER_ADMIN" ? null : EVENT_ADMIN_ENTITIES;
  const actor = f.actor?.trim() ? `%${f.actor.trim().replace(/[%_]/g, "")}%` : null;
  const action = f.action?.trim() ? `%${f.action.trim().replace(/[%_]/g, "")}%` : null;
  const where = () => sql`
    WHERE true
      ${scope ? sql`AND a.entity IN ${sql(scope)} AND a.action <> 'auth.login'` : sql``}
      ${f.entity ? sql`AND a.entity = ${f.entity}` : sql``}
      ${f.entityId ? sql`AND a.entity_id = ${f.entityId}` : sql``}
      ${action ? sql`AND a.action ILIKE ${action}` : sql``}
      ${actor ? sql`AND u.email ILIKE ${actor}` : sql``}
      ${f.from ? sql`AND a.at >= ${new Date(f.from + "T00:00:00+07:00")}` : sql``}
      ${f.to ? sql`AND a.at < ${new Date(new Date(f.to + "T00:00:00+07:00").getTime() + 86400_000)}` : sql``}`;
  const rows = await sql<AuditRow[]>`
    SELECT a.id, a.actor_id, u.email AS actor_email, a.action, a.entity, a.entity_id, a.before, a.after, a.ip, a.at
    FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id
    ${where()}
    ORDER BY a.at DESC, a.id DESC
    LIMIT ${PAGE} OFFSET ${(page - 1) * PAGE}`;
  const [{ total }] = await sql<{ total: number }[]>`
    SELECT count(*)::int AS total FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id ${where()}`;
  const entities = (await sql<{ entity: string }[]>`SELECT DISTINCT entity FROM audit_log ORDER BY entity`)
    .map((r) => r.entity)
    .filter((e) => !scope || scope.includes(e));
  return { rows, total, page, pageSize: PAGE, entities };
}
