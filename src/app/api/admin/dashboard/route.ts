import { sql } from "@/lib/db";
import { json, route } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { eventStatus, type CategoryRow, type EventRow } from "@/lib/events";
import { getRemaining } from "@/lib/quota";
import { queueLength } from "@/lib/queue";

export const dynamic = "force-dynamic";

/** Ringkasan operasional: klaim, check-in, sisa kuota, antrean, email gagal, konflik, rekonsiliasi. */
export const GET = route(async () => {
  await requireAdmin();
  const events = await sql<EventRow[]>`
    SELECT * FROM events WHERE status <> 'DRAFT' AND end_at > now() - interval '7 days' ORDER BY start_at`;
  const ids = events.map((e) => e.id);
  const cats = ids.length ? await sql<CategoryRow[]>`SELECT * FROM ticket_categories WHERE event_id IN ${sql(ids)} ORDER BY sort_order, name` : [];
  const counts = ids.length
    ? await sql<{ category_id: string; active: number; checked_in: number; cancelled: number }[]>`
        SELECT category_id,
               count(*) FILTER (WHERE status = 'ACTIVE')::int AS active,
               count(*) FILTER (WHERE status = 'CHECKED_IN')::int AS checked_in,
               count(*) FILTER (WHERE status IN ('CANCELLED','REVOKED'))::int AS cancelled
        FROM tickets WHERE event_id IN ${sql(ids)} GROUP BY category_id`
    : [];
  const rem = await getRemaining(cats);
  const qlen = await Promise.all(cats.map((c) => queueLength(c.id).catch(() => 0)));

  const eventsOut = events.map((e) => {
    const ec = cats.map((c, i) => ({ c, q: qlen[i] })).filter(({ c }) => c.event_id === e.id);
    return {
      id: e.id,
      name: e.name,
      slug: e.slug,
      start_at: e.start_at,
      timezone: e.timezone,
      status: eventStatus(e, ec.map((x) => x.c)),
      categories: ec.map(({ c, q }) => {
        const n = counts.find((x) => x.category_id === c.id);
        return {
          id: c.id,
          name: c.name,
          quota: c.quota,
          claimed: c.claimed,
          remaining: rem[c.id] ?? c.quota - c.claimed,
          checked_in: n?.checked_in ?? 0,
          cancelled: n?.cancelled ?? 0,
          queue: q,
          open_at: c.open_at,
          close_at: c.close_at,
          is_closed: c.is_closed,
        };
      }),
    };
  });

  const [outbox] = await sql<{ backlog: number; failed: number }[]>`
    SELECT count(*) FILTER (WHERE sent_at IS NULL AND failed_at IS NULL)::int AS backlog,
           count(*) FILTER (WHERE failed_at IS NOT NULL AND created_at > now() - interval '7 days')::int AS failed
    FROM outbox`;
  const emailFailed = await sql`
    SELECT t.id, t.holder_name, u.email, e.name AS event_name, t.issued_at
    FROM tickets t JOIN users u ON u.id = t.user_id JOIN events e ON e.id = t.event_id
    WHERE t.email_status = 'FAILED' AND t.status = 'ACTIVE' ORDER BY t.issued_at DESC LIMIT 50`;
  const conflicts = await sql`
    SELECT k.id, k.ticket_id, k.gate, k.scanned_at, k.reason, k.device_id, t.holder_name, e.name AS event_name, s.full_name AS staff_name,
           t.checked_in_at, t.checked_in_gate
    FROM checkins k
    LEFT JOIN tickets t ON t.id = k.ticket_id
    JOIN events e ON e.id = k.event_id
    LEFT JOIN users s ON s.id = k.staff_id
    WHERE k.result = 'CONFLICT' AND k.resolved_at IS NULL
    ORDER BY k.scanned_at DESC LIMIT 100`;
  // Query rekonsiliasi PRD: hasil harus kosong.
  const mismatches = await sql`
    SELECT c.id AS category_id, c.name, e.name AS event_name, c.claimed,
           (SELECT count(*)::int FROM tickets t WHERE t.category_id = c.id AND t.status IN ('ACTIVE','CHECKED_IN')) AS actual
    FROM ticket_categories c JOIN events e ON e.id = c.event_id
    WHERE c.claimed <> (SELECT count(*) FROM tickets t WHERE t.category_id = c.id AND t.status IN ('ACTIVE','CHECKED_IN'))`;

  const all = eventsOut.flatMap((e) => e.categories);
  return json({
    generatedAt: new Date(),
    totals: {
      quota: all.reduce((s, c) => s + c.quota, 0),
      claimed: all.reduce((s, c) => s + c.claimed, 0),
      checkedIn: all.reduce((s, c) => s + c.checked_in, 0),
      queue: all.reduce((s, c) => s + c.queue, 0),
      emailBacklog: outbox.backlog,
      emailFailed: emailFailed.length,
      conflicts: conflicts.length,
      mismatches: mismatches.length,
    },
    events: eventsOut,
    emailFailed,
    conflicts,
    mismatches,
  });
});
