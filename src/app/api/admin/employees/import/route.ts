import crypto from "node:crypto";
import { z } from "zod";
import { redis } from "@/lib/redis";
import { clientIp, json, route, ApiError } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { commitEmployeeImport, parseEmployeeFile, type EmployeeInput } from "@/lib/admin/employees";

export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024;
const TOKEN_TTL_SEC = 20 * 60;

/**
 * POST /api/admin/employees/import
 *   multipart (file)          → pratinjau: jumlah baris baru/berubah, error per baris, token
 *   JSON { token, replace }   → simpan hasil pratinjau (sekali pakai, terikat ke admin yang sama)
 */
export const POST = route(async (req) => {
  const u = await requireAdmin();
  const type = req.headers.get("content-type") ?? "";

  if (type.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError(400, "NO_FILE", "Pilih file Excel (.xlsx) atau CSV.");
    if (!/\.(xlsx|csv)$/i.test(file.name)) throw new ApiError(400, "BAD_TYPE", "Format file harus .xlsx atau .csv.");
    if (file.size > MAX_BYTES) throw new ApiError(400, "TOO_LARGE", "Ukuran file maksimal 5 MB.");
    let preview;
    try {
      preview = await parseEmployeeFile(Buffer.from(await file.arrayBuffer()), file.name);
    } catch (e) {
      throw new ApiError(400, "PARSE_ERROR", e instanceof Error ? e.message : "File tidak bisa dibaca.");
    }
    const token = crypto.randomUUID();
    await redis.set(`empimport:${token}`, JSON.stringify({ by: u.id, filename: file.name, rows: preview.rows }), "EX", TOKEN_TTL_SEC);
    return json({ token, filename: file.name, stats: preview.stats, errors: preview.errors.slice(0, 300), moreErrors: Math.max(0, preview.errors.length - 300) });
  }

  const d = z.object({ token: z.string().uuid(), replace: z.boolean().default(false) }).parse(await req.json());
  const raw = await redis.getdel(`empimport:${d.token}`);
  if (!raw) throw new ApiError(410, "EXPIRED", "Pratinjau kedaluwarsa. Unggah ulang file.");
  const saved = JSON.parse(raw) as { by: string; filename: string; rows: EmployeeInput[] };
  if (saved.by !== u.id) throw new ApiError(403, "FORBIDDEN", "Pratinjau ini milik admin lain.");
  if (!saved.rows.length) throw new ApiError(400, "EMPTY", "Tidak ada baris valid untuk disimpan.");
  const res = await commitEmployeeImport(saved.rows, { actorId: u.id, replace: d.replace, ip: clientIp(req), filename: saved.filename });
  return json({ ok: true, ...res, rows: saved.rows.length });
});
