import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { sql } from "./db";
import { ApiError } from "./http";
import { enqueue } from "./outbox";
import { audit } from "./audit";
import { setRemaining } from "./quota";
import { qrPng, signQrToken } from "./qr";
import { fmtDate, fmtTime } from "./format";

export type TicketView = {
  id: string;
  event_id: string;
  category_id: string;
  user_id: string;
  holder_name: string;
  id_type: string;
  id_last4: string | null;
  status: "ACTIVE" | "CHECKED_IN" | "CANCELLED" | "REVOKED";
  version: number;
  email_status: string;
  issued_at: Date;
  cancelled_at: Date | null;
  checked_in_at: Date | null;
  checked_in_gate: string | null;
  event_name: string;
  event_slug: string;
  event_status: string;
  venue: string;
  address: string;
  city: string;
  timezone: string;
  start_at: Date;
  end_at: Date;
  gate_open_at: Date | null;
  banner_url: string | null;
  thumb_url: string | null;
  cancel_deadline_hours: number;
  email_text: string;
  category_name: string;
  category_color: string;
  email: string;
};

const ticketSelect = () => sql`
  SELECT t.id, t.event_id, t.category_id, t.user_id, t.holder_name, t.id_type, t.id_last4, t.status, t.version,
         t.email_status, t.issued_at, t.cancelled_at, t.checked_in_at, t.checked_in_gate,
         e.name AS event_name, e.slug AS event_slug, e.status AS event_status, e.venue, e.address, e.city, e.timezone,
         e.start_at, e.end_at, e.gate_open_at, e.banner_url, e.thumb_url, e.cancel_deadline_hours, e.email_text,
         c.name AS category_name, c.color AS category_color, u.email
  FROM tickets t
  JOIN events e ON e.id = t.event_id
  JOIN ticket_categories c ON c.id = t.category_id
  JOIN users u ON u.id = t.user_id`;

export async function getTicket(ticketId: string): Promise<TicketView | null> {
  const [t] = await sql<TicketView[]>`${ticketSelect()} WHERE t.id = ${ticketId}`;
  return t ?? null;
}

export async function listUserTickets(userId: string) {
  return sql<TicketView[]>`${ticketSelect()} WHERE t.user_id = ${userId} ORDER BY e.start_at DESC, t.issued_at DESC`;
}

/** Token QR untuk tiket (versi terbaru). Hanya tampilkan untuk tiket ACTIVE / CHECKED_IN. */
export function qrTokenFor(t: Pick<TicketView, "id" | "event_id" | "version">) {
  return signQrToken({ ticketId: t.id, eventId: t.event_id, version: t.version });
}

export function cancelDeadline(t: Pick<TicketView, "start_at" | "cancel_deadline_hours">) {
  return new Date(t.start_at.getTime() - t.cancel_deadline_hours * 3600_000);
}

/**
 * Batalkan tiket: status CANCELLED, claimed - 1, QR otomatis tidak berlaku (status bukan ACTIVE).
 * Ketiganya dalam satu transaksi, lalu slot kembali ke kuota.
 */
export async function cancelTicket(opts: { ticketId: string; actorId: string; byAdmin: boolean; reason?: string; ip?: string }) {
  const t = await getTicket(opts.ticketId);
  if (!t) throw new ApiError(404, "NOT_FOUND", "Tiket tidak ditemukan.");
  if (!opts.byAdmin) {
    if (t.user_id !== opts.actorId) throw new ApiError(404, "NOT_FOUND", "Tiket tidak ditemukan.");
    if (Date.now() >= cancelDeadline(t).getTime())
      throw new ApiError(409, "CANCEL_DEADLINE_PASSED", "Batas waktu pembatalan tiket sudah lewat.");
  }
  if (t.status !== "ACTIVE") throw new ApiError(409, "NOT_ACTIVE", "Hanya tiket aktif yang bisa dibatalkan.");

  const reason = opts.reason ?? (opts.byAdmin ? "Dibatalkan admin" : "Dibatalkan pemegang tiket");
  const cat = await sql.begin(async (tx) => {
    const [row] = await tx<{ category_id: string }[]>`
      UPDATE tickets SET status = 'CANCELLED', cancelled_at = now(), cancel_reason = ${reason}
      WHERE id = ${t.id} AND status = 'ACTIVE' RETURNING category_id`;
    if (!row) throw new ApiError(409, "NOT_ACTIVE", "Tiket sudah tidak aktif.");
    const [c] = await tx<{ quota: number; claimed: number }[]>`
      UPDATE ticket_categories SET claimed = claimed - 1 WHERE id = ${row.category_id} RETURNING quota, claimed`;
    await enqueue("TICKET_CANCELLED", { ticketId: t.id }, tx);
    await audit(
      {
        actorId: opts.actorId,
        action: opts.byAdmin ? "ticket.cancel_by_admin" : "ticket.cancel",
        entity: "ticket",
        entityId: t.id,
        before: { status: "ACTIVE" },
        after: { status: "CANCELLED", reason },
        ip: opts.ip,
      },
      tx,
    );
    return { id: row.category_id, ...c };
  });
  await setRemaining(cat.id, cat.quota, cat.claimed);
}

/** Reissue: version naik (QR lama otomatis ditolak di gate), QR baru dikirim. */
export async function reissueTicket(opts: { ticketId: string; actorId: string; reason?: string; ip?: string }) {
  await sql.begin(async (tx) => {
    const [t] = await tx<{ version: number }[]>`
      UPDATE tickets SET version = version + 1 WHERE id = ${opts.ticketId} AND status = 'ACTIVE' RETURNING version`;
    if (!t) throw new ApiError(409, "NOT_ACTIVE", "Hanya tiket aktif yang bisa di-reissue.");
    await enqueue("TICKET_REISSUED", { ticketId: opts.ticketId }, tx);
    await audit(
      {
        actorId: opts.actorId,
        action: "ticket.reissue",
        entity: "ticket",
        entityId: opts.ticketId,
        before: { version: t.version - 1 },
        after: { version: t.version, reason: opts.reason ?? null },
        ip: opts.ip,
      },
      tx,
    );
  });
}

const BLUE = rgb(0x1b / 255, 0x3a / 255, 0x6f / 255);
const RED = rgb(0xe6 / 255, 0x39 / 255, 0x46 / 255);
const GREY = rgb(0.35, 0.38, 0.45);
const INK = rgb(0.06, 0.09, 0.16);

/** PDF tiket satu halaman dengan QR. Font standar PDF hanya WinAnsi, jadi teks dibersihkan dulu. */
export async function ticketPdf(t: TicketView): Promise<Uint8Array> {
  const clean = (s: string) => s.replace(/[^\x20-\x7E -ÿ]/g, "?");
  const doc = await PDFDocument.create();
  doc.setTitle(clean(`Tiket ${t.event_name}`));
  const page = doc.addPage([420, 595]);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const reg = await doc.embedFont(StandardFonts.Helvetica);
  const { width, height } = page.getSize();

  page.drawRectangle({ x: 0, y: height - 90, width, height: 90, color: BLUE });
  page.drawRectangle({ x: 0, y: height - 94, width, height: 4, color: RED });
  page.drawText("E-TICKET", { x: 28, y: height - 40, size: 11, font: bold, color: rgb(1, 1, 1) });
  const title = t.event_name.length > 38 ? t.event_name.slice(0, 37) + "..." : t.event_name;
  page.drawText(clean(title), { x: 28, y: height - 66, size: 16, font: bold, color: rgb(1, 1, 1) });

  const png = await doc.embedPng(await qrPng(qrTokenFor(t), 600));
  const qrSize = 220;
  page.drawImage(png, { x: (width - qrSize) / 2, y: height - 110 - qrSize, width: qrSize, height: qrSize });

  let y = height - 110 - qrSize - 30;
  const line = (label: string, value: string) => {
    page.drawText(label.toUpperCase(), { x: 28, y, size: 8, font: bold, color: GREY });
    y -= 14;
    page.drawText(clean(value.slice(0, 60)), { x: 28, y, size: 12, font: reg, color: INK });
    y -= 22;
  };
  line("Nama pemegang", t.holder_name);
  line("Kategori", t.category_name);
  line("Tanggal", `${fmtDate(t.start_at, t.timezone)}, ${fmtTime(t.start_at, t.timezone)}`);
  line("Lokasi", `${t.venue}${t.city ? ", " + t.city : ""}`);
  line("ID Tiket", t.id);

  page.drawRectangle({ x: 20, y: 24, width: width - 40, height: 40, color: rgb(1, 0.95, 0.95) });
  page.drawText(clean(`Bawa ${t.id_type} asli (akhiran ${t.id_last4 ?? "-"}) untuk dicocokkan di gate.`), { x: 30, y: 46, size: 9, font: bold, color: RED });
  page.drawText("Jangan bagikan QR ini. Tiket tidak dapat dipindahtangankan.", { x: 30, y: 33, size: 8, font: reg, color: GREY });

  return doc.save();
}
