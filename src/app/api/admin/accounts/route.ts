import { z } from "zod";
import { sql } from "@/lib/db";
import { body, clientIp, json, route, ApiError } from "@/lib/http";
import { requireSuperAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { emailSchema, nameSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = ["EVENT_ADMIN", "SUPER_ADMIN"] as const;

export const GET = route(async () => {
  await requireSuperAdmin();
  const rows = await sql`
    SELECT id, email, full_name, role, disabled_at, created_at, (password_hash IS NULL) AS pending
    FROM users WHERE role IN ('EVENT_ADMIN','SUPER_ADMIN','GATE_STAFF') ORDER BY role DESC, full_name`;
  return json({ accounts: rows });
});

const createSchema = z.object({ email: emailSchema, fullName: nameSchema, role: z.enum(ADMIN_ROLES) });

/** Buat akun admin. Password diatur pemilik akun lewat Lupa Password (OTP email). */
export const POST = route(async (req) => {
  const me = await requireSuperAdmin();
  const d = await body(req, createSchema);
  const [existing] = await sql<{ id: string; role: string }[]>`SELECT id, role FROM users WHERE lower(email) = ${d.email}`;
  if (existing) throw new ApiError(409, "EMAIL_TAKEN", "Email sudah terdaftar. Ubah perannya dari daftar akun bila perlu.");
  const [u] = await sql<{ id: string }[]>`
    INSERT INTO users (email, full_name, role) VALUES (${d.email}, ${d.fullName}, ${d.role}) RETURNING id`;
  await audit({ actorId: me.id, action: "admin_account.create", entity: "admin_account", entityId: u.id, after: { email: d.email, role: d.role }, ip: clientIp(req) });
  return json({ ok: true, id: u.id }, { status: 201 });
});
