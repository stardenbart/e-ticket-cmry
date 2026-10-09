import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

// Melayani gambar hasil upload (banner/thumbnail). Di produksi: object storage + CDN.
const ROOT = path.join(process.cwd(), "storage", "uploads");
const TYPES: Record<string, string> = { ".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png" };

export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await ctx.params;
  const rel = parts.join("/");
  if (!/^[a-zA-Z0-9/_-]+\.(webp|jpe?g|png)$/.test(rel) || rel.includes("..")) return new NextResponse("Not found", { status: 404 });
  const file = path.join(ROOT, rel);
  try {
    const data = await fs.readFile(file);
    return new NextResponse(new Uint8Array(data), {
      headers: { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream", "cache-control": "public, max-age=31536000, immutable" },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
