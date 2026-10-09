// QA skenario kritis 1–5 dan 12 dari PRD, dijalankan terhadap API HTTP sungguhan.
//   npm run qa            (server harus jalan di APP_URL, default http://localhost:3100)
//
// Membuat event uji + akun uji sementara, menembakkan klaim paralel, memeriksa hasil, lalu
// menjalankan query rekonsiliasi PRD. Data uji dihapus di akhir (kecuali audit/checkins yang append-only).
import crypto from "node:crypto";
import { Agent, fetch as ufetch } from "undici";
import { sql } from "@/lib/db";
import { identityHash, randomToken, sha256, signToken } from "@/lib/crypto";

const BASE = process.env.APP_URL ?? "http://localhost:3100";
// Pool koneksi keep-alive seperti load-test tool (1.000 virtual user, koneksi TCP dipakai ulang).
const agent = new Agent({ connections: Number(process.env.QA_CONNECTIONS ?? 200), headersTimeout: 60_000, bodyTimeout: 60_000 });
const RUN = crypto.randomBytes(3).toString("hex");
const results: { name: string; ok: boolean; detail: string }[] = [];

type Claim = { status: number; code: string; ticketId?: string; ms: number };

async function makeUsers(n: number, prefix: string, sharedIdentity?: string) {
  const users: { id: string; cookie: string }[] = [];
  const rows = Array.from({ length: n }, (_, i) => {
    const num = sharedIdentity ?? `9${RUN.replace(/[^0-9]/g, "1").padEnd(6, "1").slice(0, 6)}${String(i).padStart(9, "0")}`;
    return {
      email: `${prefix}${i}-${RUN}@qa.local`,
      full_name: `QA ${prefix} ${i}`,
      id_type: "KTP",
      identity_hash: identityHash("KTP", num),
      id_last4: num.slice(-4),
    };
  });
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const inserted = await sql<{ id: string }[]>`
      INSERT INTO users ${sql(chunk.map((r) => ({ ...r, email_verified_at: new Date(), terms_accepted_at: new Date() })))}
      RETURNING id`;
    const sessions = inserted.map((u) => ({ token: randomToken(24), user_id: u.id }));
    await sql`INSERT INTO sessions ${sql(sessions.map((s) => ({ token_hash: sha256(s.token), user_id: s.user_id, expires_at: new Date(Date.now() + 3600_000) })))}`;
    sessions.forEach((s) => users.push({ id: s.user_id, cookie: `sid=${s.token}` }));
  }
  return users;
}

async function makeEvent(cats: { name: string; quota: number; openOffsetMs: number; closeOffsetMs: number }[]) {
  const now = Date.now();
  const [ev] = await sql<{ id: string }[]>`
    INSERT INTO events (slug, name, start_at, end_at, status, published_at, venue, city)
    VALUES (${`qa-${RUN}-${crypto.randomBytes(2).toString("hex")}`}, ${`QA ${RUN}`}, ${new Date(now + 7 * 86400_000)}, ${new Date(now + 7 * 86400_000 + 3600_000)}, 'PUBLISHED', now(), 'QA Hall', 'QA')
    RETURNING id`;
  const ids: string[] = [];
  for (const c of cats) {
    const [row] = await sql<{ id: string }[]>`
      INSERT INTO ticket_categories (event_id, name, quota, open_at, close_at)
      VALUES (${ev.id}, ${c.name}, ${c.quota}, ${new Date(now + c.openOffsetMs)}, ${new Date(now + c.closeOffsetMs)})
      RETURNING id`;
    ids.push(row.id);
  }
  return { eventId: ev.id, categoryIds: ids };
}

/** Admission token dibuat langsung (melewati waiting room) — yang diuji adalah transaksi klaim. */
function admission(userId: string, categoryId: string, eventId: string) {
  return signToken({ uid: userId, cid: categoryId, eid: eventId, jti: crypto.randomUUID(), exp: Date.now() + 300_000 });
}

async function claim(cookie: string, categoryId: string, token: string, idem = crypto.randomUUID()): Promise<Claim> {
  const t0 = performance.now();
  try {
    const r = await ufetch(`${BASE}/api/claim`, {
      dispatcher: agent,
      method: "POST",
      headers: { "content-type": "application/json", cookie, origin: BASE },
      body: JSON.stringify({ categoryId, admissionToken: token, idempotencyKey: idem, agree: true }),
    });
    const data = (await r.json()) as { code?: string; ticketId?: string; error?: { code: string } };
    return { status: r.status, code: data.code ?? data.error?.code ?? "?", ticketId: data.ticketId, ms: performance.now() - t0 };
  } catch (e) {
    return { status: 0, code: `NETWORK:${(e as Error).message}`, ms: performance.now() - t0 };
  }
}

const count = (rs: Claim[], code: string) => rs.filter((r) => r.code === code).length;
const p95 = (rs: Claim[]) => {
  const s = rs.map((r) => r.ms).sort((a, b) => a - b);
  return Math.round(s[Math.floor(s.length * 0.95)] ?? 0);
};

async function activeCount(categoryId: string) {
  const [r] = await sql<{ n: number; claimed: number }[]>`
    SELECT (SELECT count(*)::int FROM tickets WHERE category_id = ${categoryId} AND status IN ('ACTIVE','CHECKED_IN')) AS n,
           (SELECT claimed FROM ticket_categories WHERE id = ${categoryId}) AS claimed`;
  return r;
}

function check(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}\n      ${detail}`);
}

async function reconciliation() {
  return sql`
    SELECT category_id FROM (
      SELECT c.id AS category_id FROM ticket_categories c
      WHERE claimed <> (SELECT count(*) FROM tickets t WHERE t.category_id = c.id AND status IN ('ACTIVE','CHECKED_IN'))
    ) x`;
}

async function main() {
  const createdEvents: string[] = [];
  const N1 = Number(process.env.QA_USERS ?? 1000);
  try {
    // Pemanasan (kompilasi route di mode dev).
    await fetch(`${BASE}/api/time`);
    await fetch(`${BASE}/api/claim`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });

    // ---- Skenario 1: 1.000 akun klaim bersamaan pada kuota 50 ----
    {
      const e = await makeEvent([{ name: "S1", quota: 50, openOffsetMs: -60_000, closeOffsetMs: 3600_000 }]);
      createdEvents.push(e.eventId);
      const users = await makeUsers(N1, "s1u");
      // QA_SPREAD_MS > 0: sebar kedatangan klaim (mensimulasikan laju peloloskan waiting room).
      const spread = Number(process.env.QA_SPREAD_MS ?? 0);
      const rs = await Promise.all(
        users.map(async (u, i) => {
          if (spread) await new Promise((r) => setTimeout(r, (i * spread) / users.length));
          return claim(u.cookie, e.categoryIds[0], admission(u.id, e.categoryIds[0], e.eventId));
        }),
      );
      const a = await activeCount(e.categoryIds[0]);
      const fivexx = rs.filter((r) => r.status >= 500 || r.status === 0).length;
      check(
        `S1 ${N1} akun → kuota 50${spread ? ` (tersebar ${spread} ms)` : " (serentak)"}`,
        count(rs, "SUCCESS") === 50 && a.n === 50 && a.claimed === 50 && count(rs, "SOLD_OUT") === N1 - 50 && fivexx === 0,
        `SUCCESS=${count(rs, "SUCCESS")} SOLD_OUT=${count(rs, "SOLD_OUT")} 5xx/net=${fivexx} ${[...new Set(rs.filter((r) => r.status === 0 || r.status >= 500).map((r) => r.code + "/" + r.status))].slice(0, 3).join(" ")} tiket aktif=${a.n} claimed=${a.claimed} p95=${p95(rs)}ms`,
      );
    }

    // ---- Skenario 2: 200 akun pada sisa 1 slot ----
    {
      const e = await makeEvent([{ name: "S2", quota: 1, openOffsetMs: -60_000, closeOffsetMs: 3600_000 }]);
      createdEvents.push(e.eventId);
      const users = await makeUsers(200, "s2u");
      const rs = await Promise.all(users.map((u) => claim(u.cookie, e.categoryIds[0], admission(u.id, e.categoryIds[0], e.eventId))));
      const a = await activeCount(e.categoryIds[0]);
      check("S2 200 akun → sisa 1 slot", count(rs, "SUCCESS") === 1 && count(rs, "SOLD_OUT") === 199 && a.n === 1 && a.claimed === 1,
        `SUCCESS=${count(rs, "SUCCESS")} SOLD_OUT=${count(rs, "SOLD_OUT")} lain=${rs.filter((r) => !["SUCCESS", "SOLD_OUT"].includes(r.code)).map((r) => r.code).join(",") || "-"}`);
    }

    // ---- Skenario 3: satu akun, 20 request paralel (beberapa tab + retry) ----
    {
      const e = await makeEvent([
        { name: "S3a", quota: 100, openOffsetMs: -60_000, closeOffsetMs: 3600_000 },
        { name: "S3b", quota: 100, openOffsetMs: -60_000, closeOffsetMs: 3600_000 },
      ]);
      createdEvents.push(e.eventId);
      const [u] = await makeUsers(1, "s3u");
      const sameToken = admission(u.id, e.categoryIds[0], e.eventId);
      const retryIdem = crypto.randomUUID();
      const reqs: Promise<Claim>[] = [];
      for (let i = 0; i < 20; i++) {
        if (i < 8) reqs.push(claim(u.cookie, e.categoryIds[0], sameToken, retryIdem)); // retry jaringan: idem key sama
        else if (i < 14) reqs.push(claim(u.cookie, e.categoryIds[0], sameToken)); // tab lain, token sama
        else reqs.push(claim(u.cookie, e.categoryIds[i % 2], admission(u.id, e.categoryIds[i % 2], e.eventId))); // tab lain, kategori lain
      }
      const rs = await Promise.all(reqs);
      const [{ n }] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM tickets WHERE event_id = ${e.eventId} AND user_id = ${u.id} AND status = 'ACTIVE'`;
      const ticketIds = new Set(rs.filter((r) => r.ticketId).map((r) => r.ticketId));
      const okCodes = rs.every((r) => ["SUCCESS", "ALREADY_HAS_TICKET"].includes(r.code));
      check("S3 1 akun × 20 request paralel", n === 1 && ticketIds.size <= 1 && okCodes,
        `tiket=${n} kode=${JSON.stringify(Object.fromEntries([...new Set(rs.map((r) => r.code))].map((c) => [c, count(rs, c)])))}`);
    }

    // ---- Skenario 4: identitas sama di 2 akun ----
    {
      const e = await makeEvent([{ name: "S4", quota: 10, openOffsetMs: -60_000, closeOffsetMs: 3600_000 }]);
      createdEvents.push(e.eventId);
      const shared = `3201${RUN.replace(/[^0-9]/g, "7").padEnd(6, "7").slice(0, 6)}777777`;
      const [a, b] = await makeUsers(2, "s4u", shared);
      const r1 = await claim(a.cookie, e.categoryIds[0], admission(a.id, e.categoryIds[0], e.eventId));
      const r2 = await claim(b.cookie, e.categoryIds[0], admission(b.id, e.categoryIds[0], e.eventId));
      const c = await activeCount(e.categoryIds[0]);
      check("S4 identitas sama di 2 akun", r1.code === "SUCCESS" && r2.code === "IDENTITY_ALREADY_USED" && c.claimed === 1,
        `akun1=${r1.code} akun2=${r2.code} claimed=${c.claimed}`);
    }

    // ---- Skenario 5: klaim 1 detik sebelum open_at dan 1 detik sesudah close_at (token "dimanipulasi") ----
    {
      const [u, v] = await makeUsers(2, "s5u");
      // Kategori dibuat tepat sebelum klaim agar "1 detik sebelum open_at" deterministik.
      const e = await makeEvent([
        { name: "S5-belum", quota: 10, openOffsetMs: 1_000, closeOffsetMs: 3600_000 },
        { name: "S5-tutup", quota: 10, openOffsetMs: -3600_000, closeOffsetMs: -1_000 },
      ]);
      createdEvents.push(e.eventId);
      const before = await claim(u.cookie, e.categoryIds[0], admission(u.id, e.categoryIds[0], e.eventId));
      const after = await claim(v.cookie, e.categoryIds[1], admission(v.id, e.categoryIds[1], e.eventId));
      check("S5 sebelum open_at / sesudah close_at", before.code === "CLOSED" && after.code === "CLOSED", `sebelum=${before.code} sesudah=${after.code}`);
    }

    // ---- Skenario 12: batal sebelum batas waktu, lalu orang lain klaim slot itu ----
    {
      const e = await makeEvent([{ name: "S12", quota: 1, openOffsetMs: -60_000, closeOffsetMs: 3600_000 }]);
      createdEvents.push(e.eventId);
      const [a, b] = await makeUsers(2, "s12u");
      const r1 = await claim(a.cookie, e.categoryIds[0], admission(a.id, e.categoryIds[0], e.eventId));
      const full = await claim(b.cookie, e.categoryIds[0], admission(b.id, e.categoryIds[0], e.eventId));
      const c1 = await activeCount(e.categoryIds[0]);
      const cancel = await fetch(`${BASE}/api/tickets/${r1.ticketId}`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: a.cookie, origin: BASE },
        body: JSON.stringify({ action: "cancel" }),
      });
      const c2 = await activeCount(e.categoryIds[0]);
      const r2 = await claim(b.cookie, e.categoryIds[0], admission(b.id, e.categoryIds[0], e.eventId));
      const c3 = await activeCount(e.categoryIds[0]);
      const [old] = await sql<{ status: string }[]>`SELECT status FROM tickets WHERE id = ${r1.ticketId!}`;
      check("S12 batal lalu slot diklaim orang lain",
        r1.code === "SUCCESS" && full.code === "SOLD_OUT" && cancel.ok && c1.claimed === 1 && c2.claimed === 0 && r2.code === "SUCCESS" && c3.claimed === 1 && old.status === "CANCELLED",
        `klaim1=${r1.code} penuh=${full.code} batal=${cancel.status} claimed ${c1.claimed}→${c2.claimed}→${c3.claimed} klaim2=${r2.code} tiket lama=${old.status} (QR lama ditolak gate karena status ≠ ACTIVE)`);
    }

    const rec = await reconciliation();
    check("Rekonsiliasi PRD (harus kosong)", rec.length === 0, `kategori selisih=${rec.length}`);
  } finally {
    // Bersihkan data uji.
    if (createdEvents.length) {
      await sql`DELETE FROM outbox WHERE payload->>'ticketId' IN (SELECT id::text FROM tickets WHERE event_id IN ${sql(createdEvents)})`;
      await sql`DELETE FROM tickets WHERE event_id IN ${sql(createdEvents)}`;
      await sql`DELETE FROM events WHERE id IN ${sql(createdEvents)}`;
    }
    await sql`DELETE FROM users WHERE email LIKE ${`%-${RUN}@qa.local`} AND NOT EXISTS (SELECT 1 FROM audit_log a WHERE a.actor_id = users.id)`;
    await sql.end();
  }
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} skenario lulus`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
