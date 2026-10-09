import { z } from "zod";
import { body, clientIp, json, route } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { categoryFields, deleteCategory, updateCategory } from "@/lib/admin/categories";

type P = { id: string; cid: string };

const patchSchema = categoryFields.extend({ version: z.number().int() });

export const PATCH = route<P>(async (req, ctx) => {
  const u = await requireAdmin();
  const { id, cid } = await ctx.params;
  const { version, ...d } = await body(req, patchSchema);
  const c = await updateCategory(id, cid, version, d, u.id, clientIp(req));
  return json({ category: c });
});

export const DELETE = route<P>(async (req, ctx) => {
  const u = await requireAdmin();
  const { id, cid } = await ctx.params;
  const version = Number(req.nextUrl.searchParams.get("version"));
  await deleteCategory(id, cid, version, u.id, clientIp(req));
  return json({ ok: true });
});
