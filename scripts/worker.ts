// Worker terpisah dari proses web:
//   - membaca outbox dan mengirim email (retry backoff eksponensial, maks 6x dalam ~1 jam)
//   - rekonsiliasi kuota setiap 5 menit (alert bila claimed ≠ jumlah tiket aktif)
//   - pembersihan: akun belum terverifikasi > 24 jam, sesi kedaluwarsa, anonimisasi data pasca-acara
//   - pengingat H-3 dan alert backlog email
import type { SendMailOptions } from "nodemailer";
import { sql } from "@/lib/db";
import { redis } from "@/lib/redis";
import { decrypt } from "@/lib/crypto";
import { enqueue } from "@/lib/outbox";
import { MAIL_FROM, mailer, otpEmail, simpleEmail, ticketEmail } from "@/lib/email";
import { getTicket, ticketPdf, qrTokenFor } from "@/lib/tickets";
import { qrPng } from "@/lib/qr";
import { env } from "@/lib/env";
import { fmtDateTime } from "@/lib/format";

const BACKOFF_SEC = [60, 120, 240, 480, 960, 1740]; // total ≈ 1 jam
const MAX_ATTEMPTS = BACKOFF_SEC.length;
const CONCURRENCY = 5;

type OutboxRow = { id: string; type: string; payload: Record<string, unknown>; attempts: number };

const log = (msg: string, extra?: unknown) => console.log(JSON.stringify({ t: new Date().toISOString(), msg, ...(extra ? { extra } : {}) }));

async function adminRecipients(): Promise<string[]> {
  const rows = await sql<{ email: string }[]>`SELECT email FROM users WHERE role = 'SUPER_ADMIN' AND disabled_at IS NULL`;
  const list = rows.map((r) => r.email);
  if (env.ADMIN_ALERT_EMAIL) list.push(env.ADMIN_ALERT_EMAIL);
  return [...new Set(list)];
}

/** Kirim satu pesan outbox. Kembalikan false bila tidak perlu dikirim lagi (mis. tiket sudah batal). */
async function deliver(row: OutboxRow) {
  const p = row.payload;
  const send = (to: string | string[], m: { subject: string; html: string; text: string }, attachments?: SendMailOptions["attachments"]) =>
    mailer().sendMail({ from: MAIL_FROM(), to, subject: m.subject, html: m.html, text: m.text, attachments });

  switch (row.type) {
    case "OTP_EMAIL": {
      if (!p.code_enc) return; // sudah dibersihkan
      const code = decrypt(String(p.code_enc));
      await send(String(p.to), otpEmail(String(p.name), String(p.purpose), code));
      return;
    }
    case "TICKET_ISSUED":
    case "TICKET_RESEND":
    case "TICKET_REISSUED":
    case "REMINDER_H3": {
      const t = await getTicket(String(p.ticketId));
      if (!t || t.status !== "ACTIVE") return;
      const kind = row.type === "TICKET_ISSUED" ? "ISSUED" : row.type === "TICKET_RESEND" ? "RESEND" : row.type === "TICKET_REISSUED" ? "REISSUED" : "REMINDER";
      const qr = await qrPng(qrTokenFor(t), 480);
      const pdf = Buffer.from(await ticketPdf(t));
      await send(t.email, ticketEmail(t, kind), [
        { filename: "qr.png", content: qr, cid: "qr" },
        { filename: `tiket-${t.id.slice(0, 8)}.pdf`, content: pdf, contentType: "application/pdf" },
      ]);
      await sql`UPDATE tickets SET email_status = 'SENT' WHERE id = ${t.id}`;
      return;
    }
    case "TICKET_CANCELLED": {
      const t = await getTicket(String(p.ticketId));
      if (!t) return;
      await send(
        t.email,
        simpleEmail(`Tiket dibatalkan: ${t.event_name}`, [
          `Halo ${t.holder_name},`,
          `Tiket Anda untuk ${t.event_name} (${t.category_name}) sudah dibatalkan. QR tiket ini tidak berlaku lagi di gate.`,
          t.event_status === "CANCELLED" ? "Event ini dibatalkan oleh penyelenggara. Mohon maaf atas ketidaknyamanannya." : "",
        ].filter(Boolean)),
      );
      return;
    }
    case "STAFF_INVITE": {
      await send(
        String(p.to),
        simpleEmail(
          `Undangan staf gate: ${p.eventName}`,
          [
            `Halo ${p.name},`,
            `Anda ditugaskan sebagai staf gate untuk ${p.eventName} (${(p.gates as string[]).join(", ")}). Akses berlaku sampai ${p.validUntil}.`,
            p.newAccount ? "Akun Anda baru dibuat. Atur password lewat menu Lupa Password memakai email ini, lalu login di aplikasi scanner." : "Login di aplikasi scanner memakai akun Anda.",
          ],
          { label: "Buka aplikasi scanner", url: `${env.APP_URL}/scanner` },
        ),
      );
      return;
    }
    case "ADMIN_ALERT": {
      const to = await adminRecipients();
      if (to.length) await send(to, simpleEmail(`[ALERT] ${p.subject}`, [String(p.body)], { label: "Buka dashboard", url: `${env.APP_URL}/admin` }));
      return;
    }
    default:
      log("outbox.unknown_type", { id: row.id, type: row.type });
  }
}

async function processOne(): Promise<boolean> {
  return sql.begin(async (tx) => {
    const [row] = await tx<OutboxRow[]>`
      SELECT id, type, payload, attempts FROM outbox
      WHERE sent_at IS NULL AND failed_at IS NULL AND next_try_at <= now()
      ORDER BY next_try_at, id
      FOR UPDATE SKIP LOCKED
      LIMIT 1`;
    if (!row) return false;
    try {
      await deliver(row);
      // Kode OTP plaintext (terenkripsi) dihapus begitu terkirim.
      await tx`UPDATE outbox SET sent_at = now(), attempts = attempts + 1, last_error = NULL, payload = payload - 'code_enc' WHERE id = ${row.id}`;
      log("outbox.sent", { id: row.id, type: row.type });
    } catch (e) {
      const attempts = row.attempts + 1;
      const err = e instanceof Error ? e.message : String(e);
      if (attempts >= MAX_ATTEMPTS) {
        await tx`UPDATE outbox SET attempts = ${attempts}, failed_at = now(), last_error = ${err}, payload = payload - 'code_enc' WHERE id = ${row.id}`;
        if (row.payload.ticketId) await tx`UPDATE tickets SET email_status = 'FAILED' WHERE id = ${String(row.payload.ticketId)}`;
        log("outbox.failed", { id: row.id, type: row.type, err });
      } else {
        await tx`UPDATE outbox SET attempts = ${attempts}, last_error = ${err},
                 next_try_at = now() + make_interval(secs => ${BACKOFF_SEC[attempts - 1]}) WHERE id = ${row.id}`;
        log("outbox.retry", { id: row.id, type: row.type, attempts, err });
      }
    }
    return true;
  });
}

async function outboxLoop() {
  for (;;) {
    try {
      const results = await Promise.all(Array.from({ length: CONCURRENCY }, () => processOne()));
      if (!results.some(Boolean)) await new Promise((r) => setTimeout(r, 1000));
    } catch (e) {
      log("outbox.loop_error", String(e));
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

/** Alert dengan dedupe agar admin tidak dibanjiri. */
async function alertOnce(key: string, ttlSec: number, subject: string, body: string) {
  const ok = await redis.set(`alert:${key}`, "1", "EX", ttlSec, "NX");
  if (ok) await enqueue("ADMIN_ALERT", { subject, body });
}

export async function reconcile() {
  const rows = await sql<{ id: string; name: string; event_name: string; claimed: number; actual: number }[]>`
    SELECT c.id, c.name, e.name AS event_name, c.claimed,
           (SELECT count(*)::int FROM tickets t WHERE t.category_id = c.id AND t.status IN ('ACTIVE','CHECKED_IN')) AS actual
    FROM ticket_categories c JOIN events e ON e.id = c.event_id
    WHERE c.claimed <> (SELECT count(*) FROM tickets t WHERE t.category_id = c.id AND t.status IN ('ACTIVE','CHECKED_IN'))`;
  for (const r of rows) {
    log("reconcile.mismatch", r);
    await alertOnce(`reconcile:${r.id}`, 1800, `Selisih kuota: ${r.event_name} / ${r.name}`,
      `Kategori ${r.name} (${r.event_name}) mencatat claimed=${r.claimed}, padahal tiket aktif=${r.actual}. Periksa audit log.`);
  }
  log("reconcile.done", { mismatches: rows.length });
}

async function cleanup() {
  const unverified = await sql`
    DELETE FROM users u WHERE u.email_verified_at IS NULL AND u.role = 'ATTENDEE'
      AND u.created_at < now() - interval '24 hours'
      AND NOT EXISTS (SELECT 1 FROM tickets t WHERE t.user_id = u.id)`;
  const sessions = await sql`DELETE FROM sessions WHERE expires_at < now()`;
  const otps = await sql`DELETE FROM otp_codes WHERE created_at < now() - interval '2 days'`;
  // Retensi UU PDP: anonimkan 4 digit identitas di tiket & data perangkat check-in 30 hari setelah acara.
  const anonTickets = await sql`
    UPDATE tickets t SET id_last4 = NULL FROM events e
    WHERE e.id = t.event_id AND e.end_at < now() - interval '30 days' AND t.id_last4 IS NOT NULL`;
  const anonCheckins = await sql`
    UPDATE checkins c SET device_id = NULL FROM events e
    WHERE e.id = c.event_id AND e.end_at < now() - interval '30 days' AND c.device_id IS NOT NULL`;
  log("cleanup.done", { unverified: unverified.count, sessions: sessions.count, otps: otps.count, anonTickets: anonTickets.count, anonCheckins: anonCheckins.count });
}

async function remindersAndAlerts() {
  // Pengingat H-3 dengan ajakan batal bila tidak hadir.
  const due = await sql<{ id: string }[]>`
    SELECT t.id FROM tickets t JOIN events e ON e.id = t.event_id
    WHERE t.status = 'ACTIVE' AND e.status = 'PUBLISHED'
      AND e.start_at BETWEEN now() + interval '71 hours' AND now() + interval '72 hours'`;
  for (const t of due) {
    if (await redis.set(`reminder:${t.id}`, "1", "EX", 7 * 86400, "NX")) await enqueue("REMINDER_H3", { ticketId: t.id });
  }
  const [{ backlog }] = await sql<{ backlog: number }[]>`
    SELECT count(*)::int AS backlog FROM outbox WHERE sent_at IS NULL AND failed_at IS NULL AND type <> 'ADMIN_ALERT'`;
  if (backlog > 100) await alertOnce("email-backlog", 1800, "Backlog email tinggi", `Ada ${backlog} email yang belum terkirim (batas 100).`);
  const [{ conflicts }] = await sql<{ conflicts: number }[]>`
    SELECT count(*)::int AS conflicts FROM checkins WHERE result = 'CONFLICT' AND resolved_at IS NULL`;
  if (conflicts > 0) await alertOnce(`conflicts:${conflicts}`, 3600, "Konflik check-in perlu ditinjau", `Ada ${conflicts} konflik check-in yang belum ditinjau (dicek ${fmtDateTime(new Date())}).`);
}

function every(ms: number, name: string, fn: () => Promise<void>) {
  const run = () => fn().catch((e) => log(`${name}.error`, String(e)));
  run();
  setInterval(run, ms);
}

if (process.argv[2] === "reconcile") {
  reconcile().then(() => process.exit(0));
} else {
  log("worker.start");
  outboxLoop();
  every(5 * 60_000, "reconcile", reconcile);
  every(10 * 60_000, "cleanup", cleanup);
  every(15 * 60_000, "reminders", remindersAndAlerts);
}
