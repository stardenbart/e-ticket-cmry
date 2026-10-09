import { z } from "zod";
import { sql } from "@/lib/db";
import { body, clientIp, json, route, ApiError } from "@/lib/http";
import { requireSuperAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const domainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^(?=.{3,253}$)([a-z0-9-]+\.)+[a-z]{2,}$/, "Format domain tidak valid, contoh: mailinator.com");

export const GET = route(async () => {
  await requireSuperAdmin();
  const rows = await sql`SELECT domain, created_at FROM blocked_email_domains ORDER BY domain`;
  return json({ domains: rows });
});

/** Tambah satu atau beberapa domain (dipisah baris/koma). */
export const POST = route(async (req) => {
  const me = await requireSuperAdmin();
  const d = await body(req, z.object({ domains: z.string().min(3).max(20_000) }));
  const list = [...new Set(d.domains.split(/[\s,;]+/).filter(Boolean))].map((x) => domainSchema.parse(x));
  if (!list.length) throw new ApiError(400, "VALIDATION", "Masukkan minimal satu domain.");
  const r = await sql`INSERT INTO blocked_email_domains ${sql(list.map((domain) => ({ domain })))} ON CONFLICT DO NOTHING`;
  await audit({ actorId: me.id, action: "blocked_domain.add", entity: "blocked_domain", after: { domains: list }, ip: clientIp(req) });
  return json({ ok: true, added: r.count });
});

export const DELETE = route(async (req) => {
  const me = await requireSuperAdmin();
  const domain = domainSchema.parse(req.nextUrl.searchParams.get("domain") ?? "");
  const r = await sql`DELETE FROM blocked_email_domains WHERE domain = ${domain}`;
  if (!r.count) throw new ApiError(404, "NOT_FOUND", "Domain tidak ada di daftar.");
  await audit({ actorId: me.id, action: "blocked_domain.remove", entity: "blocked_domain", entityId: domain, ip: clientIp(req) });
  return json({ ok: true });
});
