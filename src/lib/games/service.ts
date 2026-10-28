// Logika games di server: sesi TTS (satu kesempatan) dan sesi arkade. Poin tiap game menjadi Moo-coins
// untuk ternak sapi (lihat src/lib/ternak).
import { sql } from "../db";
import { ApiError } from "../http";
import { ENTRIES, POINTS_PER_ENTRY, cellsOf, entryKey, findEntry, normalizeAnswer } from "./tts-puzzle";
import { assertGamesOpen, gamesLockAt, isLockedAt } from "./lock";
import { rewardArcade, rewardTts } from "../ternak/service";

export const ARCADE_GAMES = ["snake", "flappy", "dino", "race"] as const;
export type ArcadeGame = (typeof ARCADE_GAMES)[number];
export type Game = "tts" | "moordle" | ArcadeGame;

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

/**
 * Kunci sesi TTS yang sudah tidak mengirim heartbeat (skor & waktu = saat terakhir terlihat),
 * atau yang masih berjalan saat tenggat games dari admin lewat (waktu = tenggat).
 */
async function lockIfStale(run: Run | undefined): Promise<Run | undefined> {
  if (!run || run.status !== "ACTIVE") return run;
  const stale = Date.now() - run.last_seen_at.getTime() >= TTS_STALE_MS;
  const lockAt = await gamesLockAt();
  const deadline = isLockedAt(lockAt);
  if (!stale && !deadline) return run;
  const end = stale ? (deadline && lockAt! < run.last_seen_at ? lockAt! : run.last_seen_at) : lockAt!;
  const [r] = await sql<Run[]>`
    UPDATE game_runs SET status = 'LOCKED', finished_at = ${end},
      duration_ms = GREATEST(0, (EXTRACT(EPOCH FROM (${end}::timestamptz - started_at)) * 1000)::int)
    WHERE id = ${run.id} AND status = 'ACTIVE' RETURNING *`;
  if (r) await rewardTts(r.user_id, r);
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
  const existing = await ttsRun(userId);
  if (existing) return existing;
  await assertGamesOpen();
  await sql`INSERT INTO game_runs (user_id, game) VALUES (${userId}, 'tts') ON CONFLICT (user_id) WHERE game = 'tts' DO NOTHING`;
  return ttsRun(userId);
}

async function activeTts(userId: string) {
  const run = await ttsRun(userId);
  if (!run) throw new ApiError(409, "NOT_STARTED", "Mulai permainan TTS terlebih dulu.");
  if (run.status !== "ACTIVE") {
    await assertGamesOpen();
    throw new ApiError(409, "TTS_LOCKED", "Permainan TTS Anda sudah selesai — skor sudah dikunci.");
  }
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
    if (latest) await rewardTts(userId, latest);
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
  if (r) await rewardTts(userId, r);
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
 *   race   : ±5 m/detik + 10 per botol susu (baris botol bisa rapat saat kecepatan tinggi)
 */
const MAX_RATE: Record<ArcadeGame, { perSec: number; slack: number }> = {
  snake: { perSec: 45, slack: 100 },
  flappy: { perSec: 1.2, slack: 3 },
  dino: { perSec: 30, slack: 60 },
  race: { perSec: 110, slack: 150 },
};

export async function arcadeStart(userId: string, game: ArcadeGame) {
  await assertGamesOpen();
  // Sesi lama yang tidak pernah diselesaikan dibersihkan agar tabel tidak menumpuk.
  await sql`DELETE FROM game_runs WHERE user_id = ${userId} AND game = ${game} AND status = 'ACTIVE' AND started_at < now() - interval '2 hours'`;
  const [r] = await sql<{ id: string }[]>`INSERT INTO game_runs (user_id, game) VALUES (${userId}, ${game}) RETURNING id`;
  return r.id;
}

export async function arcadeFinish(userId: string, game: ArcadeGame, runId: string, score: number, meta: Record<string, number> = {}) {
  const [run] = await sql<Run[]>`SELECT * FROM game_runs WHERE id = ${runId} AND user_id = ${userId} AND game = ${game}`;
  if (!run) throw new ApiError(404, "NOT_FOUND", "Sesi permainan tidak ditemukan.");
  if (run.status !== "ACTIVE") throw new ApiError(409, "ALREADY_FINISHED", "Sesi permainan ini sudah selesai.");
  await assertGamesOpen();
  const elapsedSec = (Date.now() - run.started_at.getTime()) / 1000;
  const lim = MAX_RATE[game];
  const plausible = score <= Math.ceil(elapsedSec * lim.perSec + lim.slack);
  const [r] = await sql<Run[]>`
    UPDATE game_runs SET status = ${plausible ? "FINISHED" : "INVALID"}, score = ${plausible ? score : 0},
      finished_at = now(), last_seen_at = now(), state = ${sql.json(meta)},
      duration_ms = (EXTRACT(EPOCH FROM (now() - started_at)) * 1000)::int
    WHERE id = ${run.id} AND status = 'ACTIVE' RETURNING *`;
  const earned = r && plausible ? await rewardArcade(userId, game, r.id, r.score) : null;
  return { accepted: plausible, score: r?.score ?? 0, coins: earned?.coins ?? 0, counted: earned?.counted ?? 0, capLeft: earned?.capLeft ?? null, wallet: earned?.wallet ?? null };
}

export const isArcade = (g: string): g is ArcadeGame => (ARCADE_GAMES as readonly string[]).includes(g);
export { entryKey };
