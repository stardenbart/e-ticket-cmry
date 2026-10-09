import { sql, type Tx } from "./db";

export type AuditEntry = {
  actorId: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
};

/** Catat aksi ke audit log (append-only). Bisa dipanggil di dalam transaksi. */
export async function audit(e: AuditEntry, tx: Tx | typeof sql = sql) {
  await tx`
    INSERT INTO audit_log (actor_id, action, entity, entity_id, before, after, ip)
    VALUES (${e.actorId}, ${e.action}, ${e.entity}, ${e.entityId ?? null},
            ${e.before === undefined ? null : tx.json(e.before as never)},
            ${e.after === undefined ? null : tx.json(e.after as never)},
            ${e.ip ?? null})`;
}
