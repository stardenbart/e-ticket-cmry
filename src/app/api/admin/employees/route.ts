import { z } from "zod";
import { sql } from "@/lib/db";
import { body, clientIp, json, route, ApiError } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { employeeStats, normalizeEmployee, queryEmployees, saveEmployee } from "@/lib/admin/employees";

export const dynamic = "force-dynamic";

const PAGE = 50;

/** GET /api/admin/employees?q=&category=&dept=&status=&page= — daftar karyawan + akun & tiket yang tertaut. */
export const GET = route(async (req) => {
  const u = await requireAdmin();
  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, Number(sp.get("page") ?? 1) || 1);
  const f = { q: sp.get("q") ?? undefined, category: sp.get("category") ?? undefined, dept: sp.get("dept") ?? undefined, status: sp.get("status") ?? undefined };
  const [{ rows, total }, stats] = await Promise.all([queryEmployees({ ...f, limit: PAGE, offset: (page - 1) * PAGE }), employeeStats()]);
  if (page === 1 && f.q) await audit({ actorId: u.id, action: "employees.search", entity: "employees", after: f, ip: clientIp(req) });
  return json({ rows, total, page, pageSize: PAGE, stats });
});

const schema = z.object({ nik: z.string(), name: z.string(), dept: z.string().default(""), category: z.string().default("") });

/** POST /api/admin/employees — tambah satu karyawan. */
export const POST = route(async (req) => {
  const u = await requireAdmin();
  const d = await body(req, schema);
  const n = normalizeEmployee(d);
  if (!n.ok) throw new ApiError(400, "VALIDATION", n.errors.join("; "));
  const [exists] = await sql`SELECT 1 FROM employees WHERE nik = ${n.value.nik}`;
  if (exists) throw new ApiError(409, "DUPLICATE", "NIK ini sudah ada di daftar karyawan.");
  await saveEmployee(n.value, { actorId: u.id, ip: clientIp(req) });
  return json({ ok: true, employee: n.value }, { status: 201 });
});
