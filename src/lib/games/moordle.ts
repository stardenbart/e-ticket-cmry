// Moordle di server: satu kesempatan per akun per hari (WIB). Tebakan dievaluasi di server; jawaban baru
// dikirim ke browser setelah permainan hari itu selesai.
import { sql } from "../db";
import { ApiError } from "../http";
import { assertGamesOpen } from "./lock";
import { MAX_GUESSES, WORD_LEN, evaluate, nextResetAt, normalizeGuess, pointsFor, puzzleNo, wibDay, wordOf, type Mark } from "./moordle-words";

type MoordleRun = {
  id: string;
  status: "ACTIVE" | "FINISHED" | "SURRENDERED" | "LOCKED" | "INVALID";
  score: number;
  started_at: Date;
  finished_at: Date | null;
  duration_ms: number | null;
  state: { day: number; guesses: string[]; won?: boolean };
};

/** Petunjuk tema muncul setelah tebakan ke-3. */
const HINT_AFTER = 3;

export async function moordleRun(userId: string, day = wibDay()) {
  const [r] = await sql<MoordleRun[]>`
    SELECT id, status, score, started_at, finished_at, duration_ms, state FROM game_runs
    WHERE user_id = ${userId} AND game = 'moordle' AND (state->>'day')::int = ${day}`;
  return r;
}

export function moordleView(run: MoordleRun | undefined, day = wibDay()) {
  const w = wordOf(day);
  const guesses = run?.state.guesses ?? [];
  const done = !!run && run.status !== "ACTIVE";
  return {
    no: puzzleNo(day),
    nextResetAt: new Date(nextResetAt(day)).toISOString(),
    status: run?.status ?? null,
    startedAt: run?.started_at.toISOString() ?? null,
    durationMs: run?.duration_ms ?? null,
    score: run?.score ?? 0,
    won: run?.state.won ?? false,
    guesses: guesses.map((g) => ({ word: g, marks: evaluate(g, w.word) as Mark[] })),
    theme: done || guesses.length >= HINT_AFTER ? w.theme : null,
    answer: done ? { word: w.word, desc: w.desc } : null,
  };
}

export async function moordleStart(userId: string) {
  await assertGamesOpen();
  const day = wibDay();
  await sql`
    INSERT INTO game_runs (user_id, game, state) VALUES (${userId}, 'moordle', ${sql.json({ day, guesses: [] })})
    ON CONFLICT (user_id, ((state->>'day')::int)) WHERE game = 'moordle' DO NOTHING`;
  return moordleView(await moordleRun(userId, day), day);
}

export async function moordleGuess(userId: string, raw: string) {
  await assertGamesOpen();
  const day = wibDay();
  const run = await moordleRun(userId, day);
  if (!run) throw new ApiError(409, "NOT_STARTED", "Tekan Mulai terlebih dulu.");
  if (run.status !== "ACTIVE") throw new ApiError(409, "MOORDLE_DONE", "Moordle hari ini sudah selesai. Kembali besok untuk kata baru!");
  const g = normalizeGuess(raw);
  if (g.length !== WORD_LEN) throw new ApiError(400, "VALIDATION", `Tebakan harus ${WORD_LEN} huruf.`);
  const answer = wordOf(day).word;
  const guesses = [...run.state.guesses, g];
  const won = g === answer;
  const finished = won || guesses.length >= MAX_GUESSES;
  const state = { day, guesses, ...(finished ? { won } : {}) };
  // Atomik: hanya berlaku bila jumlah tebakan belum berubah (aman dari kirim ganda).
  const [r] = finished
    ? await sql<MoordleRun[]>`
        UPDATE game_runs SET state = ${sql.json(state)}, status = 'FINISHED', score = ${won ? pointsFor(guesses.length) : 0},
          finished_at = now(), last_seen_at = now(), duration_ms = (EXTRACT(EPOCH FROM (now() - started_at)) * 1000)::int
        WHERE id = ${run.id} AND status = 'ACTIVE' AND jsonb_array_length(state->'guesses') = ${run.state.guesses.length}
        RETURNING id, status, score, started_at, finished_at, duration_ms, state`
    : await sql<MoordleRun[]>`
        UPDATE game_runs SET state = ${sql.json(state)}, last_seen_at = now()
        WHERE id = ${run.id} AND status = 'ACTIVE' AND jsonb_array_length(state->'guesses') = ${run.state.guesses.length}
        RETURNING id, status, score, started_at, finished_at, duration_ms, state`;
  return moordleView(r ?? (await moordleRun(userId, day)), day);
}

/** Statistik pribadi (semua hari): main, menang, beruntun, sebaran tebakan, total poin. */
export async function moordleStats(userId: string) {
  const rows = await sql<{ day: number; won: boolean; n: number; score: number }[]>`
    SELECT (state->>'day')::int AS day, COALESCE((state->>'won')::boolean, false) AS won,
      jsonb_array_length(state->'guesses')::int AS n, score
    FROM game_runs WHERE user_id = ${userId} AND game = 'moordle' AND status = 'FINISHED' ORDER BY 1`;
  const dist = Array(MAX_GUESSES).fill(0) as number[];
  let streak = 0;
  let best = 0;
  let prev = -9;
  for (const r of rows) {
    if (r.won) {
      dist[r.n - 1]++;
      streak = r.day === prev + 1 ? streak + 1 : 1;
      best = Math.max(best, streak);
      prev = r.day;
    } else {
      streak = 0;
      prev = -9;
    }
  }
  if (prev < wibDay() - 1) streak = 0;
  return { played: rows.length, won: rows.filter((r) => r.won).length, streak, best, dist, points: rows.reduce((s, r) => s + r.score, 0) };
}
