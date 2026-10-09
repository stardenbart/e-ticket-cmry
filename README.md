# E-Ticket Gathering — War Tiket

Website e-ticket gratis berbasis registrasi untuk sistem war tiket, sesuai PRD *Website E-Ticket War Tiket* (draft v0.1).
Kuota per kategori dibuka pada jam yang ditentukan, dibagikan berdasarkan urutan klaim di server, 1 akun = 1 tiket per event
atas nama sendiri, tiket QR bertanda tangan Ed25519 dikirim ke email, dan divalidasi di gate lewat scanner PWA (bisa offline).

## Menjalankan secara lokal

Prasyarat: Node.js ≥ 22, Docker Desktop.

```bash
npm install
docker compose up -d          # PostgreSQL 16 (5440), Redis 7 (6390), Mailpit (UI 8030, SMTP 1030)
npm run keys                  # membuat .env berisi secret + kunci Ed25519 QR (kid 1)
npm run migrate
npm run seed                  # akun & event demo
npm run dev                   # http://localhost:3100
npm run worker                # proses terpisah: email outbox, rekonsiliasi, cleanup
```

Semua email (OTP, tiket, undangan staf) terlihat di Mailpit: http://localhost:8030.

| Peran | Email | Password |
| --- | --- | --- |
| Super Admin | superadmin@eticket.local | Admin12345! |
| Event Admin | admin@eticket.local | Admin12345! |
| Gate Staff | staf@eticket.local | Staf12345! |
| Peserta | budi@example.com, sari@example.com | Peserta123! |

Admin & staf wajib 2FA: kode OTP dikirim ke email (lihat Mailpit).

| Area | URL |
| --- | --- |
| Publik & peserta | `/`, `/event`, `/event/[slug]`, `/tiket-saya` |
| Admin | `/admin` |
| Scanner gate (PWA) | `/scanner` |

## Keputusan yang dipakai (8 Okt 2026)

- Antrean: yang masuk T-10 menit s.d. T0 **diacak saat T0**; setelah T0 urut waktu server.
- Pembatalan tiket **boleh** sampai batas per event (default H-3, diatur di tab Pengaturan). **Tanpa overbook** — kuota tidak pernah dilampaui.
- Identitas yang diterima: **KTP, SIM, Paspor**.
- Default teknis yang belum diputuskan PRD: email via SMTP (Mailpit lokal; SES/Postmark/Resend SMTP di produksi),
  Turnstile memakai test key Cloudflare, gambar disimpan di `storage/uploads` (produksi: object storage + CDN).

## Arsitektur

```
Browser ──► Cloudflare (WAF, Turnstile, rate limit) ──► Next.js (App Router, 2 instance) ──► PostgreSQL 16 (sumber kebenaran)
                                                             │                              ▲
                                                             └──► Redis 7 (waiting room,     │ outbox
                                                                  admission token, cache     │
                                                                  sisa kuota, rate limit)    │
                                                     Worker (scripts/worker.ts) ─────────────┘──► SMTP
```

Inti anti-overbooking ada di `src/lib/claim.ts` — **satu-satunya jalur penerbitan tiket**:

1. Admission token (HMAC, terikat user + kategori, 5 menit) ditandai terpakai di Redis dengan `SET NX`.
2. Satu transaksi PostgreSQL: `UPDATE ticket_categories SET claimed = claimed + 1 WHERE claimed < quota AND now() BETWEEN open/close`
   → `INSERT tickets` (partial unique index per akun & per identitas) → `INSERT outbox`. Gagal di mana pun = rollback utuh.
3. Constraint DB sebagai jaring terakhir: `CHECK (claimed >= 0 AND claimed <= quota)`, unique `idempotency_key`.

Modul penting:

| File | Isi |
| --- | --- |
| `db/migrations/001_init.sql` | Skema + constraint (partial unique, CHECK, audit log append-only via trigger) |
| `src/lib/queue.ts` | Waiting room Redis: pengacakan T0, peloloskan 50 orang / 5 detik (bisa diatur per kategori), 1 posisi per akun per event |
| `src/lib/claim.ts` | Klaim atomik + idempoten |
| `src/lib/qr-shared.ts` / `qr.ts` | Token QR Ed25519 (≈137 karakter, tanpa data pribadi), diverifikasi offline di scanner |
| `src/lib/tickets.ts` | Batal (slot kembali ke kuota), reissue (version naik), PDF tiket |
| `scripts/worker.ts` | Outbox email (retry 6× ≈ 1 jam), rekonsiliasi 5 menit, cleanup & anonimisasi UU PDP, pengingat H-3, alert |

## Pengujian

```bash
npm test          # unit test (QR Ed25519, validasi identitas, zona waktu, status event)
npm run qa        # skenario QA PRD 1–5 & 12 terhadap API HTTP sungguhan (server harus jalan)
npm run reconcile # query rekonsiliasi PRD sekali jalan
```

`npm run qa` membuat event & akun sementara, menembakkan 1.000 klaim paralel, lalu memeriksa hasil dan query rekonsiliasi.
Ukur latensi (target p95 < 1 detik) pada build produksi (`npm run build && npm start`), bukan `npm run dev`.
`QA_SPREAD_MS=10000` menyebar kedatangan klaim (100/detik) seperti laju peloloskan waiting room.

Hasil ukur lokal (8 Okt 2026; laptop Windows, 1 instance, load generator + Postgres + Redis di mesin yang sama):

| Pola | p95 klaim | Hasil |
| --- | --- | --- |
| 1.000 klaim tersebar 10 detik (10× laju default waiting room) | 46 ms | 50 SUCCESS, 950 SOLD_OUT, 0 error |
| 1.000 klaim dalam milidetik yang sama (stress) | 2,6–5,2 detik | 50 SUCCESS, 950 SOLD_OUT, 0 error |

Pada pola stress, endpoint kosong `/api/time` pun p95 1,2–1,5 detik di mesin yang sama, jadi angka itu dibatasi CPU satu instance.
Waiting room mencegah pola ini terjadi di produksi. Ulangi load test di staging setara produksi (2 instance) sebelum go-live.

## Rotasi kunci QR

```bash
npm run keys -- 2      # menambah QR_PRIVATE_KEY_2 / QR_PUBLIC_KEY_2
# set QR_ACTIVE_KID=2, restart. Kunci 1 tetap disimpan agar tiket lama valid sampai acara selesai.
```

## Catatan produksi

- Simpan isi `.env` di secret manager. Jangan commit `.env`.
- Jalankan ≥ 2 instance web di belakang load balancer + 1 worker. Bekukan deploy pada jendela war (T-30 menit s.d. T+2 jam).
- Aktifkan PITR PostgreSQL (RPO 5 menit) dan uji restore sebelum go-live.
- Konfigurasikan SPF, DKIM, DMARC untuk domain pengirim email.
- Ganti `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` dengan kunci produksi.

## Deploy (server internal 172.20.240.61)

Server memakai podman rootless + docker-compose dan dipakai bersama aplikasi lain; deploy hanya menyentuh
`~/eticket` dan container `eticket_*`. Aplikasi: http://172.20.240.61:3110.

```bash
git push                      # deploy selalu dari commit
bash scripts/deploy.sh        # upload commit HEAD, build image di server, up, health check
```

- Rahasia ada di `~/eticket/.env` di server (chmod 600, tidak di-commit): secret aplikasi, kunci QR, `POSTGRES_PASSWORD`,
  SMTP, dan `SEED_*_PASSWORD` untuk akun demo. `COOKIE_SECURE=false` karena masih HTTP; set `true` setelah ada HTTPS.
- Email sementara ditampung Mailpit di server. Lihat dengan `ssh -L 8030:127.0.0.1:3111 usersentul01@172.20.240.61`
  lalu buka http://localhost:8030. Untuk SMTP asli, isi `SMTP_HOST/PORT/SECURE/USER/PASS` dan `MAIL_FROM` di `.env`,
  lalu `docker-compose -p eticket -f docker-compose.prod.yml up -d web worker`.
- Seed sekali: `docker exec eticket_web node --import tsx scripts/seed.ts`.
- Rollback: perintahnya dicetak di akhir `deploy.sh` (memakai tag image commit sebelumnya).
