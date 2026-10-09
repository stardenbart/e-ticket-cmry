import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import sharp, { type Metadata } from "sharp";
import { z } from "zod";
import { sql } from "@/lib/db";
import { body, clientIp, json, route, ApiError } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { loadEventOr404 } from "@/lib/admin/events";

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_GALLERY = 8;

type Kind = "banner" | "thumb" | "gallery";

/** Upload banner (2:1, min 1440×720), thumbnail (1:1) atau galeri. JPG/PNG/WebP ≤ 2 MB, dikompresi otomatis ke WebP. */
export const POST = route<{ id: string }>(async (req, ctx) => {
  const u = await requireAdmin();
  const { id } = await ctx.params;
  const e = await loadEventOr404(id);
  const form = await req.formData().catch(() => null);
  if (!form) throw new ApiError(400, "BAD_FORM", "Unggahan tidak valid.");
  const kind = String(form.get("kind")) as Kind;
  if (!["banner", "thumb", "gallery"].includes(kind)) throw new ApiError(400, "VALIDATION", "Jenis gambar tidak valid.");
  const file = form.get("file");
  if (!(file instanceof File)) throw new ApiError(400, "VALIDATION", "Pilih file gambar.");
  if (file.size > MAX_BYTES) throw new ApiError(400, "TOO_LARGE", "Ukuran gambar maksimal 2 MB.");

  const buf = Buffer.from(await file.arrayBuffer());
  let meta: Metadata;
  try {
    meta = await sharp(buf).metadata();
  } catch {
    throw new ApiError(400, "BAD_IMAGE", "File bukan gambar yang valid.");
  }
  if (!meta.format || !["jpeg", "png", "webp"].includes(meta.format)) throw new ApiError(400, "BAD_FORMAT", "Format harus JPG, PNG, atau WebP.");
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  const ratio = w / Math.max(h, 1);
  if (kind === "banner") {
    if (Math.abs(ratio - 2) > 0.02) throw new ApiError(400, "BAD_RATIO", `Banner harus rasio 2:1 (gambar Anda ${w}×${h}).`);
    if (w < 1440 || h < 720) throw new ApiError(400, "TOO_SMALL", `Banner minimal 1440×720 (gambar Anda ${w}×${h}).`);
  }
  if (kind === "thumb") {
    if (Math.abs(ratio - 1) > 0.02) throw new ApiError(400, "BAD_RATIO", `Thumbnail harus rasio 1:1 (gambar Anda ${w}×${h}).`);
    if (w < 400) throw new ApiError(400, "TOO_SMALL", "Thumbnail minimal 400×400.");
  }

  const maxW = kind === "banner" ? 1920 : kind === "thumb" ? 800 : 1600;
  const name = `${kind}-${Date.now()}-${crypto.randomBytes(3).toString("hex")}.webp`;
  const dir = path.join(process.cwd(), "storage", "uploads", "events", id);
  await fs.mkdir(dir, { recursive: true });
  await sharp(buf).rotate().resize({ width: maxW, withoutEnlargement: true }).webp({ quality: 80 }).toFile(path.join(dir, name));
  const url = `/media/events/${id}/${name}`;

  let version: number;
  if (kind === "gallery") {
    if (e.gallery.length >= MAX_GALLERY) throw new ApiError(400, "GALLERY_FULL", `Galeri maksimal ${MAX_GALLERY} gambar.`);
    [{ version }] = await sql<{ version: number }[]>`
      UPDATE events SET gallery = gallery || ${sql.json([url])}, version = version + 1 WHERE id = ${id} RETURNING version`;
  } else {
    const col = kind === "banner" ? "banner_url" : "thumb_url";
    [{ version }] = await sql<{ version: number }[]>`
      UPDATE events SET ${sql(col)} = ${url}, version = version + 1 WHERE id = ${id} RETURNING version`;
  }
  await audit({ actorId: u.id, action: `event.media_${kind}`, entity: "event", entityId: id, after: { url }, ip: clientIp(req) });
  return json({ ok: true, url, version });
});

/** Hapus satu gambar galeri. */
export const DELETE = route<{ id: string }>(async (req, ctx) => {
  const u = await requireAdmin();
  const { id } = await ctx.params;
  const d = await body(req, z.object({ url: z.string().startsWith(`/media/events/${id}/`) }));
  const [r] = await sql<{ version: number }[]>`
    UPDATE events SET gallery = gallery - ${d.url}, version = version + 1 WHERE id = ${id} RETURNING version`;
  if (!r) throw new ApiError(404, "NOT_FOUND", "Event tidak ditemukan.");
  await audit({ actorId: u.id, action: "event.media_gallery_remove", entity: "event", entityId: id, before: { url: d.url }, ip: clientIp(req) });
  return json({ ok: true, version: r.version });
});
