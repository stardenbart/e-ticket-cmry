-- Games Mooniverse: TTS (teka-teki silang) + 3 game arkade (snake, flappy, dino).
--
-- Satu baris = satu kali main.
--   TTS     : hanya SATU kesempatan per akun (unique index). Jawaban dicek di server; skor 10 per jawaban
--             benar (10 soal = 100). Selesai saat semua benar (FINISHED), menyerah (SURRENDERED), atau keluar
--             dari halaman / berhenti mengirim heartbeat (LOCKED — skor & waktu terakhir dikunci).
--   Arkade  : boleh main berkali-kali; skor terbaik yang dihitung. Server mencatat waktu mulai sendiri dan
--             menolak skor yang tidak masuk akal untuk durasi permainannya (INVALID).
CREATE TABLE game_runs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game         text NOT NULL CHECK (game IN ('tts', 'snake', 'flappy', 'dino')),
  status       text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'FINISHED', 'SURRENDERED', 'LOCKED', 'INVALID')),
  score        int  NOT NULL DEFAULT 0 CHECK (score >= 0),
  started_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  finished_at  timestamptz,
  duration_ms  int CHECK (duration_ms >= 0),
  -- TTS: {"solved": {"1D": true, ...}}; arkade: info tambahan (mis. jumlah makanan snake).
  state        jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX game_runs_tts_once ON game_runs (user_id) WHERE game = 'tts';
CREATE INDEX game_runs_leaderboard_idx ON game_runs (game, status, score DESC);
CREATE INDEX game_runs_user_idx ON game_runs (user_id, game);
