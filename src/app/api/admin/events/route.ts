import crypto from "node:crypto";
import { z } from "zod";
import { sql } from "@/lib/db";
import { body, clientIp, json, route } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { eventStatus, type CategoryRow, type EventRow } from "@/lib/events";
import { slugify } from "@/lib/admin/events";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  await requireAdmin();
  const events = await sql<EventRow[]>`SELECT * FROM events ORDER BY start_at DESC`;
  const cats = await sql<CategoryRow[]>`SELECT * FROM ticket_categories`;
  return json({
    events: events.map((e) => {
      const ec = cats.filter((c) => c.event_id === e.id);
      return {
        id: e.id,
        slug: e.slug,
        name: e.name,
        city: e.city,
        start_at: e.start_at,
        status: eventStatus(e, ec),
        quota: ec.reduce((s, c) => s + c.quota, 0),
        claimed: ec.reduce((s, c) => s + c.claimed, 0),
        categories: ec.length,
      };
    }),
  });
});

const createSchema = z.object({ name: z.string().trim().min(1, "Nama event wajib diisi.").max(100, "Nama maksimal 100 karakter.") });

/** Buat event baru sebagai DRAFT dengan nilai awal, lalu admin melengkapi lewat form multi-tab. */
export const POST = route(async (req) => {
  const u = await requireAdmin();
  const d = await body(req, createSchema);
  const slug = `${slugify(d.name)}-${crypto.randomBytes(2).toString("hex")}`;
  const start = new Date(Date.now() + 30 * 86400_000);
  start.setUTCMinutes(0, 0, 0);
  const [e] = await sql<{ id: string }[]>`
    INSERT INTO events (slug, name, start_at, end_at, created_by)
    VALUES (${slug}, ${d.name}, ${start}, ${new Date(start.getTime() + 4 * 3600_000)}, ${u.id})
    RETURNING id`;
  await audit({ actorId: u.id, action: "event.create", entity: "event", entityId: e.id, after: { name: d.name, slug }, ip: clientIp(req) });
  return json({ id: e.id }, { status: 201 });
});
