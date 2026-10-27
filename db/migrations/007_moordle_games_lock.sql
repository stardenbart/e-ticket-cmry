-- Moordle (tebak kata harian) + kunci games oleh admin.
--
-- Moordle : satu kata per hari (tanggal WIB) — tiap akun hanya SATU kali main per hari (unique index di
--           bawah). Tebakan dicek di server; skor harian 60/50/40/30/20/10 untuk benar di tebakan ke-1..6,
--           0 bila gagal. state = {"day": 1, "guesses": [...], "won": true}.
-- Kunci   : game_settings.lock_at — setelah waktu ini semua game ditutup (tidak bisa mulai/kirim skor)
--           dan leaderboard dibekukan; dipakai untuk menetapkan pemenang sebelum hari H.
ALTER TABLE game_runs DROP CONSTRAINT game_runs_game_check;
ALTER TABLE game_runs ADD CONSTRAINT game_runs_game_check CHECK (game IN ('tts', 'snake', 'flappy', 'dino', 'race', 'moordle'));

CREATE UNIQUE INDEX game_runs_moordle_daily ON game_runs (user_id, ((state->>'day')::int)) WHERE game = 'moordle';

CREATE TABLE game_settings (
  id         boolean PRIMARY KEY DEFAULT true CHECK (id),
  lock_at    timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL
);
INSERT INTO game_settings (id) VALUES (true);
