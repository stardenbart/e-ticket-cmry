// Data demo: akun per peran, daftar blokir email sekali pakai, dan beberapa event dengan status berbeda.
// Aman dijalankan ulang (akun di-upsert; event demo dibuat ulang hanya bila belum ada tiketnya).
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { sql } from "@/lib/db";
import { hashPassword, identityHash, randomToken } from "@/lib/crypto";

const PW = {
  admin: process.env.SEED_ADMIN_PASSWORD || "Admin12345!",
  staff: process.env.SEED_STAFF_PASSWORD || "Staf12345!",
  attendee: process.env.SEED_ATTENDEE_PASSWORD || "Peserta123!",
};

const UPLOADS = path.join(process.cwd(), "storage", "uploads");

const DISPOSABLE = [
  "mailinator.com", "10minutemail.com", "guerrillamail.com", "temp-mail.org", "tempmail.com", "yopmail.com",
  "trashmail.com", "getnada.com", "sharklasers.com", "dispostable.com", "maildrop.cc", "throwawaymail.com",
  "fakeinbox.com", "mintemail.com", "mohmal.com", "emailondeck.com", "tempail.com", "moakt.com", "mailnesia.com", "spamgourmet.com",
];

async function upsertUser(email: string, name: string, role: string, password: string, identity?: { type: string; number: string }) {
  const hash = await hashPassword(password);
  const [u] = await sql<{ id: string }[]>`
    INSERT INTO users (email, password_hash, full_name, role, email_verified_at, terms_accepted_at, id_type, identity_hash, id_last4)
    VALUES (${email}, ${hash}, ${name}, ${role}, now(), now(),
            ${identity?.type ?? null}, ${identity ? identityHash(identity.type, identity.number) : null}, ${identity?.number.slice(-4) ?? null})
    ON CONFLICT ((lower(email))) DO UPDATE SET role = EXCLUDED.role, full_name = EXCLUDED.full_name
    RETURNING id`;
  return u.id;
}

// Banner demo bergaya neon (tanpa teks): gradien malam, matahari synthwave, lantai grid pink/cyan.
async function banner(file: string, hueA: string, hueB: string) {
  const svg = (w: number, h: number) => {
    const horizon = h * 0.62;
    const stars = Array.from({ length: 60 }, (_, i) => {
      const x = (i * 137.5) % w;
      const y = ((i * 89.3) % (horizon * 0.9)) + 4;
      const r = (i % 5 === 0 ? 2.2 : i % 3 === 0 ? 1.5 : 1) * (w / 1440 + 0.4);
      const c = i % 4 === 0 ? "#22e5ff" : i % 5 === 0 ? "#ff2bd6" : "#ffffff";
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}" fill="${c}" fill-opacity="${(0.5 + (i % 4) * 0.12).toFixed(2)}"/>`;
    }).join("");
    // Garis lantai grid perspektif
    const cx = w / 2;
    const rays = Array.from({ length: 17 }, (_, i) => {
      const x = (i - 8) * (w / 5);
      return `<line x1="${cx}" y1="${horizon}" x2="${cx + x}" y2="${h}" stroke="#22e5ff" stroke-opacity=".55" stroke-width="2"/>`;
    }).join("");
    const rows = Array.from({ length: 8 }, (_, i) => {
      const y = horizon + (h - horizon) * Math.pow((i + 1) / 8, 1.8);
      return `<line x1="0" y1="${y.toFixed(1)}" x2="${w}" y2="${y.toFixed(1)}" stroke="#ff2bd6" stroke-opacity=".6" stroke-width="2"/>`;
    }).join("");
    const sunR = h * 0.24;
    const sunY = horizon - sunR * 0.35;
    const cuts = Array.from({ length: 5 }, (_, i) => {
      const y = sunY + sunR * (0.15 + i * 0.17);
      return `<rect x="${cx - sunR}" y="${y.toFixed(1)}" width="${sunR * 2}" height="${(3 + i * 2.2).toFixed(1)}" fill="${hueA}"/>`;
    }).join("");
    return `
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${hueA}"/><stop offset="0.55" stop-color="#1b0b4d"/><stop offset="1" stop-color="${hueB}"/>
    </linearGradient>
    <linearGradient id="sun" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe3f8"/><stop offset=".45" stop-color="#ff2bd6"/><stop offset="1" stop-color="#8b5cf6"/></linearGradient>
    <radialGradient id="glow"><stop offset="0" stop-color="#ff2bd6" stop-opacity=".55"/><stop offset="1" stop-color="#ff2bd6" stop-opacity="0"/></radialGradient>
    <clipPath id="sky"><rect width="${w}" height="${horizon}"/></clipPath>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  ${stars}
  <circle cx="${cx}" cy="${sunY}" r="${sunR * 1.9}" fill="url(#glow)"/>
  <g clip-path="url(#sky)"><circle cx="${cx}" cy="${sunY}" r="${sunR}" fill="url(#sun)"/>${cuts}</g>
  <rect y="${horizon}" width="${w}" height="${h - horizon}" fill="#05061a" fill-opacity=".82"/>
  ${rays}${rows}
  <line x1="0" y1="${horizon}" x2="${w}" y2="${horizon}" stroke="#22e5ff" stroke-width="3"/>
</svg>`;
  };
  fs.mkdirSync(path.join(UPLOADS, "seed"), { recursive: true });
  await sharp(Buffer.from(svg(1440, 720))).webp({ quality: 82 }).toFile(path.join(UPLOADS, "seed", `${file}-banner.webp`));
  await sharp(Buffer.from(svg(800, 800))).webp({ quality: 82 }).toFile(path.join(UPLOADS, "seed", `${file}-thumb.webp`));
  return { banner: `/media/seed/${file}-banner.webp`, thumb: `/media/seed/${file}-thumb.webp` };
}

// Banner event utama dari foto panggung Mooniverse (1536×1024): 2:1 dan 1:1 berpusat pada maskot.
const STAGE_PHOTO = path.join(process.cwd(), "public", "images", "mooniverse_ref.jpeg");
async function photoBanner(file: string) {
  fs.mkdirSync(path.join(UPLOADS, "seed"), { recursive: true });
  await sharp(STAGE_PHOTO).extract({ left: 0, top: 40, width: 1536, height: 768 }).resize(1440, 720).webp({ quality: 82 }).toFile(path.join(UPLOADS, "seed", `${file}-banner.webp`));
  await sharp(STAGE_PHOTO).extract({ left: 256, top: 0, width: 1024, height: 1024 }).resize(800, 800).webp({ quality: 82 }).toFile(path.join(UPLOADS, "seed", `${file}-thumb.webp`));
  return { banner: `/media/seed/${file}-banner.webp`, thumb: `/media/seed/${file}-thumb.webp` };
}

const H = 3600_000;
const M = 60_000;
const D = 24 * H;

type SeedCat = { name: string; description: string; quota: number; openIn: number; closeIn: number; color: string; claimed?: number };
type SeedEvent = {
  slug: string; name: string; type: string; city: string; venue: string; address: string; lat: number; lng: number;
  startIn: number; durationH: number; hueA: string; hueB: string; cats: SeedCat[];
  /** Pakai crop foto panggung Mooniverse sebagai banner. */
  photo?: boolean;
  description?: string;
};

const DESC = `<p>Gathering tahunan untuk keluarga besar dan komunitas. Nikmati penampilan musik, area kuliner, dan aktivitas seru sepanjang acara.</p>
<h3>Highlight</h3><ul><li>Live music &amp; talkshow</li><li>Area kuliner dan sampling produk</li><li>Photo booth &amp; doorprize</li></ul>
<p>Tiket gratis, terbatas, dan <strong>atas nama pemilik akun</strong>. Bawa identitas asli saat masuk.</p>`;
const DESC_MOONIVERSE = `<p><strong>Mooniverse — Cimory Employee Gathering 2026</strong>: malam kebersamaan seluruh karyawan Cimory bertema neon, tempat <strong>Good Food Good Mood</strong> bertemu panggung megah. MOO, maskot sapi berkacamata VR, siap menyambut kamu!</p>
<h3>Highlight</h3><ul><li>Konser live di panggung neon MOO</li><li>Area kuliner &amp; sampling produk Cimory</li><li>Photo spot menara MOO &amp; blimp neon</li><li>Light stick untuk seluruh karyawan</li></ul>
<p>Moo brings us together! Tiket gratis, terbatas, dan <strong>atas nama pemilik akun</strong>. Bawa identitas asli saat masuk.</p>`;
const TERMS = `<ol><li>Satu akun hanya bisa memegang satu tiket per event.</li><li>Tiket atas nama pemilik akun dan tidak dapat dipindahtangankan.</li>
<li>Pengunjung wajib membawa identitas asli (KTP/SIM/Paspor) yang sama dengan data di tiket.</li><li>Panitia berhak menolak masuk jika identitas tidak cocok.</li>
<li>Pembatalan tiket hanya bisa dilakukan sebelum batas waktu yang ditentukan.</li></ol>`;

async function main() {
  for (const d of DISPOSABLE) await sql`INSERT INTO blocked_email_domains (domain) VALUES (${d}) ON CONFLICT DO NOTHING`;

  // Di server, set SEED_*_PASSWORD agar tidak memakai password demo yang ada di README.
  const superId = await upsertUser("superadmin@eticket.local", "Super Admin", "SUPER_ADMIN", PW.admin);
  const adminId = await upsertUser("admin@eticket.local", "Event Admin", "EVENT_ADMIN", PW.admin);
  const staffId = await upsertUser("staf@eticket.local", "Staf Gate A", "GATE_STAFF", PW.staff);
  await upsertUser("budi@example.com", "Budi Santoso", "ATTENDEE", PW.attendee, { type: "KTP", number: "3201010101900001" });
  await upsertUser("sari@example.com", "Sari Wulandari", "ATTENDEE", PW.attendee, { type: "SIM", number: "120198765432" });

  const now = Date.now();
  const events: SeedEvent[] = [
    {
      slug: "mooniverse-2026", name: "Mooniverse Cimory Employee Gathering 2026", type: "Employee Gathering", city: "Bogor",
      venue: "Cimory Dairyland Puncak", address: "Jl. Raya Puncak No.KM. 77, Cisarua, Bogor", lat: -6.6976, lng: 106.9516,
      startIn: 14 * D, durationH: 8, hueA: "#05061a", hueB: "#e81cff", photo: true, description: DESC_MOONIVERSE,
      cats: [
        { name: "Festival", description: "Akses area festival, panggung utama & kuliner.", quota: 300, openIn: -30 * M, closeIn: 7 * D, color: "#22E5FF", claimed: 0 },
        { name: "VIP Moo Zone", description: "Area depan panggung + light stick & goodie bag.", quota: 50, openIn: -10 * M, closeIn: 7 * D, color: "#FF2BD6", claimed: 0 },
      ],
    },
  ];
  // `npm run seed -- --banners-only`: hanya buat ulang gambar banner demo.
  if (process.argv.includes("--banners-only")) {
    for (const e of events) await (e.photo ? photoBanner(e.slug) : banner(e.slug, e.hueA, e.hueB));
    console.log("banner demo dibuat ulang");
    await sql.end();
    return;
  }

  for (const e of events) {
    const [existing] = await sql<{ id: string }[]>`SELECT id FROM events WHERE slug = ${e.slug}`;
    if (existing) {
      const [hasTickets] = await sql`SELECT 1 FROM tickets WHERE event_id = ${existing.id} LIMIT 1`;
      if (hasTickets) {
        console.log(`skip ${e.slug} (sudah ada tiket)`);
        continue;
      }
      await sql`DELETE FROM events WHERE id = ${existing.id}`;
    }
    const img = e.photo ? await photoBanner(e.slug) : await banner(e.slug, e.hueA, e.hueB);
    const start = new Date(now + e.startIn);
    const [ev] = await sql<{ id: string }[]>`
      INSERT INTO events (slug, name, event_type, organizer, description, terms, banner_url, thumb_url, venue, address, city, lat, lng,
                          timezone, start_at, end_at, gate_open_at, gates, status, published_at, created_by)
      VALUES (${e.slug}, ${e.name}, ${e.type}, 'PT Cisarua Mountain Dairy Tbk', ${e.description ?? DESC}, ${TERMS}, ${img.banner}, ${img.thumb},
              ${e.venue}, ${e.address}, ${e.city}, ${e.lat}, ${e.lng}, 'Asia/Jakarta', ${start}, ${new Date(start.getTime() + e.durationH * H)},
              ${new Date(start.getTime() - H)}, ${["Gate A", "Gate B"]}, 'PUBLISHED', now(), ${adminId})
      RETURNING id`;
    let i = 0;
    for (const c of e.cats) {
      const openAt = new Date(now + c.openIn);
      const closeAt = new Date(Math.min(now + c.closeIn, start.getTime() - M));
      await sql`
        INSERT INTO ticket_categories (event_id, name, description, quota, claimed, open_at, close_at, sort_order, color)
        VALUES (${ev.id}, ${c.name}, ${c.description}, ${c.quota}, 0, ${openAt}, ${closeAt > openAt ? closeAt : new Date(openAt.getTime() + H)}, ${i++}, ${c.color})`;
    }
    await sql`INSERT INTO gate_staff (event_id, user_id, gates, valid_until) VALUES (${ev.id}, ${staffId}, ${["Gate A", "Gate B"]}, ${new Date(start.getTime() + e.durationH * H + D)})`;
    console.log(`event ${e.slug}`);

    // Event "habis": isi kuota dengan peserta dummy lewat jalur yang menjaga konsistensi (claimed = jumlah tiket).
    const full = e.cats.find((c) => c.claimed && c.claimed > 0);
    if (full) {
      const [cat] = await sql<{ id: string }[]>`SELECT id FROM ticket_categories WHERE event_id = ${ev.id} AND name = ${full.name}`;
      for (let k = 0; k < full.claimed!; k++) {
        const uid = await upsertUser(`dummy${k + 1}@example.com`, `Peserta Dummy ${k + 1}`, "ATTENDEE", randomToken(18), { type: "KTP", number: `32010101019000${String(k + 10).padStart(2, "0")}` });
        await sql.begin(async (tx) => {
          await tx`UPDATE ticket_categories SET claimed = claimed + 1 WHERE id = ${cat.id}`;
          await tx`
            INSERT INTO tickets (event_id, category_id, user_id, identity_hash, holder_name, id_type, id_last4, idempotency_key, email_status)
            SELECT ${ev.id}, ${cat.id}, id, identity_hash, full_name, id_type, id_last4, gen_random_uuid()::text, 'SENT' FROM users WHERE id = ${uid}`;
        });
      }
    }
  }
  console.log("\nAkun demo:");
  const shown = (v: string, envName: string) => (process.env[envName] ? `(dari ${envName})` : v);
  console.log(`  Super Admin : superadmin@eticket.local / ${shown(PW.admin, "SEED_ADMIN_PASSWORD")}`);
  console.log(`  Event Admin : admin@eticket.local / ${shown(PW.admin, "SEED_ADMIN_PASSWORD")}`);
  console.log(`  Gate Staff  : staf@eticket.local / ${shown(PW.staff, "SEED_STAFF_PASSWORD")}`);
  console.log(`  Peserta     : budi@example.com, sari@example.com / ${shown(PW.attendee, "SEED_ATTENDEE_PASSWORD")}`);
  console.log("  (OTP 2FA & email lain terlihat di Mailpit: http://localhost:8030)");
  void superId;
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
