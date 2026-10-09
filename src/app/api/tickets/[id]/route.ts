import { z } from "zod";
import { NextResponse } from "next/server";
import { body, clientIp, json, route, ApiError } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { cancelTicket, getTicket, qrTokenFor, ticketPdf } from "@/lib/tickets";
import { qrSvg } from "@/lib/qr";
import { enqueue } from "@/lib/outbox";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

async function ownTicket(id: string) {
  const u = await requireUser();
  if (!z.string().uuid().safeParse(id).success) throw new ApiError(404, "NOT_FOUND", "Tiket tidak ditemukan.");
  const t = await getTicket(id);
  // Selalu 404 untuk tiket milik orang lain (tidak membocorkan keberadaan).
  if (!t || t.user_id !== u.id) throw new ApiError(404, "NOT_FOUND", "Tiket tidak ditemukan.");
  return { u, t };
}

/**
 * GET /api/tickets/:id?format=qr|pdf
 *   qr  → SVG QR (hanya tiket ACTIVE/CHECKED_IN, versi terbaru)
 *   pdf → unduhan PDF tiket
 */
export const GET = route<{ id: string }>(async (req, ctx) => {
  const { id } = await ctx.params;
  const { t } = await ownTicket(id);
  const format = req.nextUrl.searchParams.get("format");
  const usable = t.status === "ACTIVE" || t.status === "CHECKED_IN";
  const noStore = { "cache-control": "private, no-store" };
  if (format === "qr") {
    if (!usable) throw new ApiError(410, "NOT_ACTIVE", "Tiket ini tidak berlaku.");
    return new NextResponse(await qrSvg(qrTokenFor(t)), { headers: { "content-type": "image/svg+xml", ...noStore } });
  }
  if (format === "pdf") {
    if (!usable) throw new ApiError(410, "NOT_ACTIVE", "Tiket ini tidak berlaku.");
    const pdf = await ticketPdf(t);
    return new NextResponse(new Uint8Array(pdf), {
      headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="tiket-${t.id.slice(0, 8)}.pdf"`, ...noStore },
    });
  }
  return json({ ticket: { ...t, user_id: undefined } }, { headers: noStore });
});

const actionSchema = z.object({ action: z.enum(["resend", "cancel"]) });

/** POST /api/tickets/:id { action: resend | cancel } */
export const POST = route<{ id: string }>(async (req, ctx) => {
  const { id } = await ctx.params;
  const { u, t } = await ownTicket(id);
  const d = await body(req, actionSchema);
  if (d.action === "resend") {
    if (t.status !== "ACTIVE") throw new ApiError(409, "NOT_ACTIVE", "Hanya tiket aktif yang bisa dikirim ulang.");
    await rateLimit(`resend:${t.id}`, 3, 3600, "Kirim ulang email dibatasi 3 kali per jam per tiket.");
    await enqueue("TICKET_RESEND", { ticketId: t.id });
    return json({ ok: true, message: "Email tiket sedang dikirim ulang." });
  }
  await cancelTicket({ ticketId: t.id, actorId: u.id, byAdmin: false, ip: clientIp(req) });
  return json({ ok: true, message: "Tiket dibatalkan. Slot dikembalikan ke kuota." });
});
