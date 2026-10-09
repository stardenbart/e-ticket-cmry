import crypto from "node:crypto";
import { env } from "@/lib/env";
import { json, route } from "@/lib/http";
import { requireEventAccess, requireScannerUser } from "@/lib/scanner/access";

export const dynamic = "force-dynamic";

/**
 * GET /api/scanner/events/:id/key — materi kunci AES-256-GCM per staf + event untuk mengenkripsi
 * manifest di IndexedDB. Klien mengimpornya sebagai CryptoKey non-extractable lalu membuang bytes mentahnya.
 */
export const GET = route<{ id: string }>(async (_req, ctx) => {
  const u = await requireScannerUser();
  const { id } = await ctx.params;
  const e = await requireEventAccess(u, id);
  const key = crypto.createHmac("sha256", env.APP_SECRET).update(`scanner-manifest:${u.id}:${e.id}`).digest("base64url");
  return json({ key, validUntil: e.valid_until }, { headers: { "cache-control": "no-store" } });
});
