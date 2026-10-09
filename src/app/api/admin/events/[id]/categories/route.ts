import { body, clientIp, json, route } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { categoryFields, createCategory } from "@/lib/admin/categories";

export const POST = route<{ id: string }>(async (req, ctx) => {
  const u = await requireAdmin();
  const { id } = await ctx.params;
  const d = await body(req, categoryFields);
  const c = await createCategory(id, d, u.id, clientIp(req));
  return json({ category: c }, { status: 201 });
});
