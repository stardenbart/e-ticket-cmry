import { z } from "zod";
import { sql } from "@/lib/db";
import { body, clientIp, json, route, ApiError } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { enqueue } from "@/lib/outbox";
import { cancelTicket, reissueTicket } from "@/lib/tickets";

const schema = z.object({
  action: z.enum(["reissue", "cancel", "resend"]),
  reason: z.string().trim().max(300).optional(),
});

/** Aksi admin atas tiket: reissue (QR baru, versi lama ditolak), batal, kirim ulang email. */
export const POST = route<{ id: string }>(async (req, ctx) => {
  const u = await requireAdmin();
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) throw new ApiError(404, "NOT_FOUND", "Tiket tidak ditemukan.");
  const d = await body(req, schema);
  const ip = clientIp(req);
  if (d.action === "reissue") {
    await reissueTicket({ ticketId: id, actorId: u.id, reason: d.reason, ip });
    return json({ ok: true, message: "Tiket diterbitkan ulang. QR lama tidak berlaku setelah manifest scanner tersinkron." });
  }
  if (d.action === "cancel") {
    if (!d.reason || d.reason.length < 3) throw new ApiError(400, "VALIDATION", "Tulis alasan pembatalan.");
    await cancelTicket({ ticketId: id, actorId: u.id, byAdmin: true, reason: d.reason, ip });
    return json({ ok: true, message: "Tiket dibatalkan dan slot dikembalikan ke kuota." });
  }
  const [t] = await sql<{ status: string }[]>`
    UPDATE tickets SET email_status = 'PENDING' WHERE id = ${id} AND status = 'ACTIVE' RETURNING status`;
  if (!t) throw new ApiError(409, "NOT_ACTIVE", "Hanya tiket aktif yang bisa dikirim ulang.");
  await enqueue("TICKET_RESEND", { ticketId: id });
  await audit({ actorId: u.id, action: "ticket.resend_by_admin", entity: "ticket", entityId: id, ip });
  return json({ ok: true, message: "Email tiket diantrekan untuk dikirim ulang." });
});
