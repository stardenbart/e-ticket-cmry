-- Grow your Cow, Grow your Country: game menjadi sumber Moo-coins untuk merawat sapi.
--
-- farms        : satu sapi + dompet koin per peserta. Simulasi (lapar, sakit, afeksi) dihitung malas dari
--                tick_at saat kandang dibuka; detail aturan di src/lib/ternak/engine.ts.
-- coin_ledger  : semua pemasukan/pengeluaran koin. `ref` unik per pemain mencegah hadiah ganda
--                (tts, moordle:<hari>, arcade:<runId>).
-- game_settings: start_at (mulai) + lock_at (akhir periode). Setelah akhir, kondisi sapi dibekukan,
--                leaderboard & pemenang hanya bisa dilihat admin.
CREATE TABLE farms (
  user_id     uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  coins       int NOT NULL DEFAULT 0 CHECK (coins >= 0),
  cow_name    text CHECK (cow_name IS NULL OR char_length(cow_name) BETWEEN 1 AND 24),
  named_at    timestamptz,
  kg          numeric(7, 1) NOT NULL DEFAULT 50,
  affection   int NOT NULL DEFAULT 30 CHECK (affection BETWEEN 0 AND 100),
  dirt        int NOT NULL DEFAULT 0 CHECK (dirt BETWEEN 0 AND 3),
  sick        boolean NOT NULL DEFAULT false,
  tick_at     timestamptz NOT NULL DEFAULT now(),
  milk_total  int NOT NULL DEFAULT 0,
  best_milk   int NOT NULL DEFAULT 0,
  state       jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- kapan kondisi peringkat (hati, berat, susu) terakhir berubah — penentu seri "siapa lebih dulu"
  reached_at  timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX farms_rank_idx ON farms (affection DESC, kg DESC, milk_total DESC);

CREATE TABLE coin_ledger (
  id      bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delta   int NOT NULL,
  kind    text NOT NULL, -- tts | moordle | arcade | buy | milk
  ref     text,
  game    text,
  points  int,
  note    text,
  at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX coin_ledger_ref_uq ON coin_ledger (user_id, ref) WHERE ref IS NOT NULL;
CREATE INDEX coin_ledger_user_idx ON coin_ledger (user_id, at DESC);

ALTER TABLE game_settings ADD COLUMN start_at timestamptz;
-- Periode default (bisa diubah admin): 30 Okt 2026 00.00 – 16 Nov 2026 23.59 WIB.
UPDATE game_settings SET start_at = '2026-10-30 00:00:00+07', lock_at = '2026-11-16 23:59:59+07' WHERE id;
