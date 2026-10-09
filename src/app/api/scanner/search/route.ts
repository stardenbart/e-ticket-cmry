import { z } from "zod";
import { sql } from "@/lib/db";
import { clientIp, json, route } from "@/lib/http";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { requireEventAccess, requireScannerUser } from "@/lib/scanner/access";

export const dynamic = "force-dynamic";

const schema = z.object({
  eventId: z.string().uuid(),
  q: z.string().trim().min(3, "Ketik minimal 3 karakter.").max(100),
});

/**
 * GET /api/scanner/search?eventId=&q= — pencarian manual (QR tidak terbaca) berdasarkan nama atau ID tiket.
 * Maks 10 hasil, field terbatas. Setiap pencarian dicatat di audit log sebagai pencarian manual.
 */
export const GET = route(async (req) => {
  const u = await requireScannerUser();
  await rateLimit(`scan-search:${u.id}`, 60, 60);
  const d = schema.parse(Object.fromEntries(req.nextUrl.searchParams));
  const e = await requireEventAccess(u, d.eventId);
  const like = `%${d.q.replace(/[%_\\]/g, "")}%`;
  const idPrefix = `${d.q.toLowerCase().replace(/[^0-9a-f-]/g, "")}%`;
  const rows = await sql<
    { id: string; version: number; status: string; holder_name: string; category_name: string; id_type: string; id_last4: string | null; checked_in_at: Date | null; checked_in_gate: string | null }[]
  >`
    SELECT t.id, t.version, t.status, t.holder_name, c.name AS category_name, t.id_type, t.id_last4, t.checked_in_at, t.checked_in_gate
    FROM tickets t JOIN ticket_categories c ON c.id = t.category_id
    WHERE t.event_id = ${e.id}
      AND (t.holder_name ILIKE ${like} ${idPrefix.length > 4 ? sql`OR t.id::text LIKE ${idPrefix}` : sql``})
    ORDER BY (t.status = 'ACTIVE') DESC, t.holder_name
    LIMIT 10`;
  await audit({
    actorId: u.id,
    action: "scanner.manual_search",
    entity: "event",
    entityId: e.id,
    after: { manual: true, query: d.q, results: rows.map((r) => r.id) },
    ip: clientIp(req),
  });
  return json({ results: rows }, { headers: { "cache-control": "no-store" } });
});
