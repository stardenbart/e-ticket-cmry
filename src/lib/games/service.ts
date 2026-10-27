// Logika games di server: sesi TTS (satu kesempatan), skor arkade, dan leaderboard gabungan.
import { sql } from "../db";
import { ApiError } from "../http";
import { ENTRIES, POINTS_PER_ENTRY, cellsOf, entryKey, findEntry, normalizeAnswer } from "./tts-puzzle";

export const ARCADE_GAMES = ["snake", "flappy", "dino"] as const;
export type ArcadeGame = (typeof ARCADE_GAMES)[number];
export type Game = "tts" | ArcadeGame;

/** TTS dikunci bila browser berhenti mengirim heartbeat selama ini (keluar aplikasi / tab ditutup). */
export const TTS_STALE_MS = 45_000;

type Run = {
  id: string;
  user_id: string;
  game: Game;
  status: "ACTIVE" | "FINISHED" | "SURRENDERED" | "LOCKED" | "INVALID";
  score: number;
  started_at: Date;
  last_seen_at: Date;
  finished_at: Date | null;
  duration_ms: number | null;
  state: { solved?: Record<string, true> };
};

// ---------------------------------------------------------------------------
// TTS
// ---------------------------------------------------------------------------

/** Kunci sesi TTS yang sudah tidak mengirim heartbeat: skor & waktu = saat terakhir terlihat. */
async function lockIfStale(run: Run | undefined): Promise<Run | undefined> {
  if (!run || run.status !== "ACTIVE") return run;
  if (Date.now() - run.last_seen_at.getTime() < TTS_STALE_MS) return run;
  const [r] = await sql<Run[]>`
    UPDATE game_runs SET status = 'LOCKED', finished_at = last_seen_at,
      duration_ms = GREATEST(0, (EXTRACT(EPOCH FROM (last_seen_at - started_at)) * 1000)::int)
    WHERE id = ${run.id} AND status = 'ACTIVE' RETURNING *`;
  return r ?? run;
}

export async function ttsRun(userId: string) {
  const [run] = await sql<Run[]>`SELECT * FROM game_runs WHERE user_id = ${userId} AND game = 'tts'`;
  return lockIfStale(run);
}

/** Huruf dari jawaban yang sudah benar (untuk ditampilkan terkunci di grid). */
export function solvedLetters(run: Run | undefined) {
  const out: Record<string, string> = {};
  for (const key of Object.keys(run?.state.solved ?? {})) {
    const e = findEntry(key);
    if (!e) continue;
    cellsOf({ ...e, length: e.answer.length }).forEach(([r, c], i) => (out[`${r},${c}`] = e.answer[i]));
  }
  return out;
}

export function ttsView(run: Run | undefined) {
  return run
    ? {
        status: run.status,
        score: run.score,
        startedAt: run.started_at.toISOString(),
        finishedAt: run.finished_at?.toISOString() ?? null,
        durationMs: run.duration_ms,
        solved: Object.keys(run.state.solved ?? {}),
        letters: solvedLetters(run),
      }
    : null;
}

export async function ttsStart(userId: string) {
  await sql`INSERT INTO game_runs (user_id, game) VALUES (${userId}, 'tts') ON CONFLICT (user_id) WHERE game = 'tts' DO NOTHING`;
  return ttsRun(userId);
}

async function activeTts(userId: string) {
  const run = await ttsRun(userId);
  if (!run) throw new ApiError(409, "NOT_STARTED", "Mulai permainan TTS terlebih dulu.");
  if (run.status !== "ACTIVE") throw new ApiError(409, "TTS_LOCKED", "Permainan TTS Anda sudah selesai — skor sudah dikunci.");
  return run;
}

export async function ttsHeartbeat(userId: string) {
  const run = await activeTts(userId);
  await sql`UPDATE game_runs SET last_seen_at = now() WHERE id = ${run.id} AND status = 'ACTIVE'`;
  return ttsView(await ttsRun(userId));
}

/** Cek satu jawaban. Benar → dikunci (+10). Salah → tidak ada penalti, boleh diubah. */
export async function ttsAnswer(userId: string, key: string, raw: string) {
  const run = await activeTts(userId);
  const e = findEntry(key);
  if (!e) throw new ApiError(400, "VALIDATION", "Soal tidak dikenal.");
  if (run.state.solved?.[key]) return { correct: true, view: ttsView(run) };
  const correct = normalizeAnswer(raw) === e.answer;
  if (!correct) {
    await sql`UPDATE game_runs SET last_seen_at = now() WHERE id = ${run.id} AND status = 'ACTIVE'`;
    return { correct: false, view: ttsView(await ttsRun(userId)) };
  }
  // Atomik: hanya menambah skor bila soal belum pernah tercatat benar (aman dari klik ganda).
  const [r] = await sql<Run[]>`
    UPDATE game_runs SET
      state = jsonb_set(state, '{solved}', COALESCE(state->'solved', '{}'::jsonb) || jsonb_build_object(${key}::text, true)),
      score = score + ${POINTS_PER_ENTRY}, last_seen_at = now()
    WHERE id = ${run.id} AND status = 'ACTIVE' AND NOT COALESCE(state->'solved' ? ${key}, false)
    RETURNING *`;
  let latest = r ?? (await ttsRun(userId));
  if (latest && latest.status === "ACTIVE" && Object.keys(latest.state.solved ?? {}).length >= ENTRIES.length) {
    [latest] = await sql<Run[]>`
      UPDATE game_runs SET status = 'FINISHED', finished_at = now(),
        duration_ms = (EXTRACT(EPOCH FROM (now() - started_at)) * 1000)::int
      WHERE id = ${latest.id} AND status = 'ACTIVE' RETURNING *`;
  }
  return { correct: true, view: ttsView(latest) };
}

/** Menyerah atau keluar halaman: kunci skor & waktu saat ini. */
export async function ttsEnd(userId: string, how: "SURRENDERED" | "LOCKED") {
  const run = await ttsRun(userId);
  if (!run || run.status !== "ACTIVE") return ttsView(run);
  const [r] = await sql<Run[]>`
    UPDATE game_runs SET status = ${how}, finished_at = now(), last_seen_at = now(),
      duration_ms = (EXTRACT(EPOCH FROM (now() - started_at)) * 1000)::int
    WHERE id = ${run.id} AND status = 'ACTIVE' RETURNING *`;
  return ttsView(r ?? run);
}

// ---------------------------------------------------------------------------
// Arkade
// ---------------------------------------------------------------------------

/**
 * Batas skor masuk akal per detik permainan (longgar untuk pemain jago, ketat untuk skor palsu).
 *   snake  : 10/makanan + bonus 50 tiap 5 makanan; makanan paling cepat ~0,5 detik
 *   flappy : 1 per pipa; pipa muncul ~tiap 1,3 detik
 *   dino   : ±10 poin/detik, makin cepat seiring waktu
 */
const MAX_RATE: Record<ArcadeGame, { perSec: number; slack: number }> = {
  snake: { perSec: 45, slack: 100 },
  flappy: { perSec: 1.2, slack: 3 },
  dino: { perSec: 30, slack: 60 },
};

export async function arcadeStart(userId: string, game: ArcadeGame) {
  // Sesi lama yang tidak pernah diselesaikan dibersihkan agar tabel tidak menumpuk.
  await sql`DELETE FROM game_runs WHERE user_id = ${userId} AND game = ${game} AND status = 'ACTIVE' AND started_at < now() - interval '2 hours'`;
  const [r] = await sql<{ id: string }[]>`INSERT INTO game_runs (user_id, game) VALUES (${userId}, ${game}) RETURNING id`;
  return r.id;
}

export async function arcadeFinish(userId: string, game: ArcadeGame, runId: string, score: number, meta: Record<string, number> = {}) {
  const [run] = await sql<Run[]>`SELECT * FROM game_runs WHERE id = ${runId} AND user_id = ${userId} AND game = ${game}`;
  if (!run) throw new ApiError(404, "NOT_FOUND", "Sesi permainan tidak ditemukan.");
  if (run.status !== "ACTIVE") throw new ApiError(409, "ALREADY_FINISHED", "Sesi permainan ini sudah selesai.");
  const elapsedSec = (Date.now() - run.started_at.getTime()) / 1000;
  const lim = MAX_RATE[game];
  const plausible = score <= Math.ceil(elapsedSec * lim.perSec + lim.slack);
  const [r] = await sql<Run[]>`
    UPDATE game_runs SET status = ${plausible ? "FINISHED" : "INVALID"}, score = ${plausible ? score : 0},
      finished_at = now(), last_seen_at = now(), state = ${sql.json(meta)},
      duration_ms = (EXTRACT(EPOCH FROM (now() - started_at)) * 1000)::int
    WHERE id = ${run.id} AND status = 'ACTIVE' RETURNING *`;
  const [best] = await sql<{ best: number }[]>`
    SELECT COALESCE(max(score), 0)::int AS best FROM game_runs WHERE user_id = ${userId} AND game = ${game} AND status = 'FINISHED'`;
  return { accepted: plausible, score: r?.score ?? 0, best: best.best };
}

// ---------------------------------------------------------------------------
// Leaderboard gabungan
// ---------------------------------------------------------------------------

export type LeaderRow = {
  user_id: string;
  name: string;
  dept: string | null;
  tts_score: number;
  tts_ms: number | null;
  tts_status: string | null;
  tts_done_at: Date | null;
  snake_best: number;
  flappy_best: number;
  dino_best: number;
  snake_pts: number;
  flappy_pts: number;
  dino_pts: number;
  total: number;
  first_at: Date;
  rank: number;
};

/**
 * Total = skor TTS (maks 100) + poin tiap game arkade (maks 100 per game).
 * Poin arkade = 100 × skor terbaik pemain ÷ skor terbaik tertinggi di game itu, sehingga ketiga game
 * berbobot sama walau skalanya berbeda (dino ratusan, flappy puluhan). Total maks 400.
 * Seri diurutkan: waktu TTS lebih cepat → selesai lebih dulu.
 */
export async function leaderboard(opts: { limit?: number; userId?: string } = {}) {
  const rows = await sql<LeaderRow[]>`
    WITH best AS (
      SELECT user_id, game, max(score) AS best, min(finished_at) AS first_at
      FROM game_runs WHERE game <> 'tts' AND status = 'FINISHED' GROUP BY user_id, game
    ),
    top AS (SELECT game, max(best) AS top FROM best GROUP BY game),
    tts AS (
      SELECT user_id, score, duration_ms, status, finished_at FROM game_runs WHERE game = 'tts' AND status <> 'ACTIVE'
    ),
    players AS (SELECT user_id FROM best UNION SELECT user_id FROM tts),
    agg AS (
      SELECT p.user_id,
        COALESCE(t.score, 0) AS tts_score, t.duration_ms AS tts_ms, t.status AS tts_status, t.finished_at AS tts_done_at,
        COALESCE(max(b.best) FILTER (WHERE b.game = 'snake'), 0) AS snake_best,
        COALESCE(max(b.best) FILTER (WHERE b.game = 'flappy'), 0) AS flappy_best,
        COALESCE(max(b.best) FILTER (WHERE b.game = 'dino'), 0) AS dino_best,
        COALESCE(round(100.0 * max(b.best) FILTER (WHERE b.game = 'snake') / NULLIF(max(tp.top) FILTER (WHERE tp.game = 'snake'), 0)), 0)::int AS snake_pts,
        COALESCE(round(100.0 * max(b.best) FILTER (WHERE b.game = 'flappy') / NULLIF(max(tp.top) FILTER (WHERE tp.game = 'flappy'), 0)), 0)::int AS flappy_pts,
        COALESCE(round(100.0 * max(b.best) FILTER (WHERE b.game = 'dino') / NULLIF(max(tp.top) FILTER (WHERE tp.game = 'dino'), 0)), 0)::int AS dino_pts,
        LEAST(COALESCE(t.finished_at, 'infinity'), COALESCE(min(b.first_at), 'infinity')) AS first_at
      FROM players p
      LEFT JOIN tts t ON t.user_id = p.user_id
      LEFT JOIN best b ON b.user_id = p.user_id
      LEFT JOIN top tp ON tp.game = b.game
      GROUP BY p.user_id, t.score, t.duration_ms, t.status, t.finished_at
    ),
    ranked AS (
      SELECT a.*, (a.tts_score + a.snake_pts + a.flappy_pts + a.dino_pts) AS total,
        rank() OVER (ORDER BY (a.tts_score + a.snake_pts + a.flappy_pts + a.dino_pts) DESC, a.tts_ms ASC NULLS LAST, a.first_at ASC) AS rank
      FROM agg a
    )
    SELECT r.*, u.full_name AS name, e.dept
    FROM ranked r JOIN users u ON u.id = r.user_id LEFT JOIN employees e ON e.nik = u.nik
    WHERE u.role = 'ATTENDEE' AND u.disabled_at IS NULL
      ${opts.userId ? sql`AND (r.rank <= ${opts.limit ?? 50} OR r.user_id = ${opts.userId})` : sql`AND r.rank <= ${opts.limit ?? 50}`}
    ORDER BY r.rank, r.first_at`;
  return rows;
}

/** Ringkasan skor milik satu pemain untuk halaman Games. */
export async function myScores(userId: string) {
  const [tts] = await sql<Run[]>`SELECT * FROM game_runs WHERE user_id = ${userId} AND game = 'tts'`;
  const best = await sql<{ game: ArcadeGame; best: number; plays: number }[]>`
    SELECT game, COALESCE(max(score) FILTER (WHERE status = 'FINISHED'), 0)::int AS best, count(*) FILTER (WHERE status <> 'ACTIVE')::int AS plays
    FROM game_runs WHERE user_id = ${userId} AND game <> 'tts' GROUP BY game`;
  const t = await lockIfStale(tts);
  return {
    tts: t ? { status: t.status, score: t.score, durationMs: t.duration_ms } : null,
    arcade: Object.fromEntries(ARCADE_GAMES.map((g) => [g, best.find((b) => b.game === g) ?? { game: g, best: 0, plays: 0 }])),
  };
}

export const isArcade = (g: string): g is ArcadeGame => (ARCADE_GAMES as readonly string[]).includes(g);
export { entryKey };
