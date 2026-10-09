import nodemailer, { type Transporter } from "nodemailer";
import type { TicketView } from "./tickets";
import { fmtDate, fmtTime } from "./format";
import { env } from "./env";

let transport: Transporter | null = null;

export function mailer() {
  if (!transport) {
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? "localhost",
      port: Number(process.env.SMTP_PORT ?? 1025),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  }
  return transport;
}

export const MAIL_FROM = () => process.env.MAIL_FROM ?? "E-Ticket <no-reply@eticket.local>";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Kerangka email bermerek: header gradien biru → merah, isi putih. */
export function layout(title: string, inner: string) {
  return `<!doctype html><html lang="id"><body style="margin:0;background:#F8FAFC;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0F172A">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;padding:24px 0"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #E2E8F0">
<tr><td style="background:#1B3A6F;background-image:linear-gradient(135deg,#1B3A6F,#2A4F8F,#E63946);padding:24px 28px;color:#fff">
<div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;opacity:.85">E-Ticket Gathering</div>
<div style="font-size:20px;font-weight:700;margin-top:6px">${esc(title)}</div></td></tr>
<tr><td style="padding:28px">${inner}</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid #E2E8F0;font-size:12px;color:#64748B">Email ini dikirim otomatis. Jangan balas email ini.</td></tr>
</table></td></tr></table></body></html>`;
}

const PURPOSE_TEXT: Record<string, string> = {
  VERIFY_EMAIL: "verifikasi email Anda",
  RESET_PASSWORD: "mengatur ulang password",
  LOGIN_2FA: "masuk ke panel admin/staf",
};

export function otpEmail(name: string, purpose: string, code: string) {
  const subject = `Kode verifikasi: ${code}`;
  const html = layout("Kode verifikasi Anda", `
<p>Halo ${esc(name)},</p>
<p>Gunakan kode berikut untuk ${PURPOSE_TEXT[purpose] ?? "melanjutkan"}:</p>
<div style="font-size:34px;font-weight:700;letter-spacing:10px;color:#1B3A6F;background:#F1F5F9;border-radius:12px;padding:16px;text-align:center;margin:16px 0">${code}</div>
<p style="color:#475569">Kode berlaku 5 menit dan hanya bisa dipakai sekali. Jangan berikan kode ini kepada siapa pun, termasuk panitia.</p>`);
  return { subject, html, text: `Kode verifikasi Anda: ${code} (berlaku 5 menit).` };
}

export function ticketEmail(t: TicketView, kind: "ISSUED" | "RESEND" | "REISSUED" | "REMINDER") {
  const when = `${fmtDate(t.start_at, t.timezone)}, ${fmtTime(t.start_at, t.timezone)}`;
  const intro = {
    ISSUED: "Selamat! Tiket Anda berhasil diklaim.",
    RESEND: "Berikut tiket Anda yang diminta untuk dikirim ulang.",
    REISSUED: "Tiket Anda diterbitkan ulang. QR sebelumnya sudah tidak berlaku — gunakan QR di bawah ini.",
    REMINDER: "Acara tinggal beberapa hari lagi. Jika Anda tidak bisa hadir, batalkan tiket agar slotnya bisa dipakai orang lain.",
  }[kind];
  const subject = {
    ISSUED: `Tiket Anda: ${t.event_name}`,
    RESEND: `Tiket Anda: ${t.event_name}`,
    REISSUED: `Tiket baru (QR diperbarui): ${t.event_name}`,
    REMINDER: `Pengingat: ${t.event_name}`,
  }[kind];
  const ticketUrl = `${env.APP_URL}/tiket-saya/${t.id}`;
  const html = layout(t.event_name, `
<p>Halo ${esc(t.holder_name)},</p>
<p>${esc(intro)}</p>
${t.email_text ? `<p style="color:#334155">${esc(t.email_text)}</p>` : ""}
<div style="text-align:center;margin:20px 0"><img src="cid:qr" width="240" height="240" alt="QR tiket" style="border:1px solid #E2E8F0;border-radius:12px"/></div>
<table role="presentation" width="100%" style="font-size:14px;border-collapse:collapse">
<tr><td style="color:#64748B;padding:6px 0;width:38%">Nama pemegang</td><td style="font-weight:600">${esc(t.holder_name)}</td></tr>
<tr><td style="color:#64748B;padding:6px 0">Kategori</td><td style="font-weight:600">${esc(t.category_name)}</td></tr>
<tr><td style="color:#64748B;padding:6px 0">Tanggal</td><td style="font-weight:600">${esc(when)}</td></tr>
<tr><td style="color:#64748B;padding:6px 0">Lokasi</td><td style="font-weight:600">${esc(t.venue)}${t.address ? `<br><span style="font-weight:400;color:#475569">${esc(t.address)}</span>` : ""}</td></tr>
<tr><td style="color:#64748B;padding:6px 0">ID tiket</td><td style="font-family:monospace;font-size:12px">${t.id}</td></tr>
</table>
<div style="background:#FEF2F2;border-left:4px solid #E63946;padding:12px 14px;margin:20px 0;border-radius:8px;font-size:14px">
<b>Bawa ${esc(t.id_type)} asli</b> (akhiran ${esc(t.id_last4 ?? "-")}). Nama di tiket dicocokkan dengan identitas fisik di gate. Jangan bagikan foto QR ini.</div>
<p style="text-align:center"><a href="${ticketUrl}" style="display:inline-block;background:#1B3A6F;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600">Buka di Tiket Saya</a></p>`);
  return { subject, html, text: `${intro}\n${t.event_name} — ${when}\n${t.venue}\nKategori: ${t.category_name}\nLihat tiket: ${ticketUrl}` };
}

export function simpleEmail(title: string, paragraphs: string[], cta?: { label: string; url: string }) {
  const html = layout(title, `${paragraphs.map((p) => `<p>${esc(p)}</p>`).join("")}${
    cta ? `<p style="text-align:center;margin-top:20px"><a href="${cta.url}" style="display:inline-block;background:#1B3A6F;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600">${esc(cta.label)}</a></p>` : ""
  }`);
  return { subject: title, html, text: paragraphs.join("\n\n") + (cta ? `\n\n${cta.label}: ${cta.url}` : "") };
}
