// Ternak di server: dompet Moo-coins, aksi kandang, hadiah koin dari games, dan leaderboard peternak.
import { createHmac } from "node:crypto";
import { sql, type Tx } from "../db";
import { env } from "../env";
import { ApiError } from "../http";
import { gamesPeriod, isLockedAt, notStartedAt } from "../games/lock";
import {
  FEEDS,
  MAX_KG,
  MAX_STOCK,
  MEDICINE,
  MILK,
  OUTFITS,
  SCHEDULE_TEXT,
  FarmError,
  act,
  advance,
  currentWindow,
  hearts,
  isHungry,
  moodOf,
  MOOD_EMOJI,
  newFarm,
  nextWindow,
  playBonus,
  spriteOf,
  stageOf,
  titleOf,
  wibDayOf,
  type Action,
  type FarmState,
} from "./engine";
import { ARCADE_RATE, arcadeCoins, moordleCoins, ttsCoins, type ArcadeKey } from "./earn";

type FarmRow = {
  user_id: string;
  coins: number;
  cow_name: string | null;
  kg: string | number;
  affection: number;
  dirt: number;
  sick: boolean;
  tick_at: Date;
  milk_total: number;
  best_milk: number;
  state: FarmState["s"];
  reached_at: Date;
};

const toState = (r: FarmRow): FarmState => ({
  kg: Number(r.kg),
  affection: r.affection,
  dirt: r.dirt,
  sick: r.sick,
  tickAt: r.tick_at.getTime(),
  milkTotal: r.milk_total,
  bestMilk: r.best_milk,
  coins: r.coins,
  s: r.state ?? {},
});

/** Angka acak deterministik per sapi per kejadian (tidak bisa ditebak dari browser). */
const randFor = (userId: string) => (key: string) => parseInt(createHmac("sha256", env.APP_SECRET).update(`${userId}:${key}`).digest("hex").slice(0, 8), 16) / 2 ** 32;

/** Waktu simulasi: sekarang, tapi tidak melewati akhir periode (sapi dibekukan setelah games berakhir). */
async function simNow() {
  const p = await gamesPeriod();
  const now = Date.now();
  return { now: p.lockAt ? Math.min(now, p.lockAt.getTime()) : now, period: p, ended: isLockedAt(p.lockAt), notStarted: notStartedAt(p.startAt) };
}

const rankKey = (f: FarmState) => `${hearts(f.affection)}|${f.kg}|${f.milkTotal}`;

/** Kunci baris kandang, majukan simulasi, jalankan `fn`, simpan. */
async function withFarm<T>(userId: string, fn: (f: FarmState, ctx: { tx: Tx; now: number; named: boolean }) => Promise<T> | T) {
  const t = await simNow();
  return sql.begin(async (tx) => {
    await tx`INSERT INTO farms (user_id) VALUES (${userId}) ON CONFLICT DO NOTHING`;
    const [row] = await tx<FarmRow[]>`SELECT * FROM farms WHERE user_id = ${userId} FOR UPDATE`;
    const f = toState(row);
    const named = !!row.cow_name;
    // Sapi belum diberi nama → belum dipelihara: waktu tidak berjalan.
    if (named) advance(f, t.now, randFor(userId), t.period.startAt?.getTime() ?? 0);
    else f.tickAt = Math.max(f.tickAt, t.now);
    const before = rankKey(toState(row));
    const out = await fn(f, { tx, now: t.now, named });
    await tx`
      UPDATE farms SET coins = ${f.coins}, kg = ${f.kg}, affection = ${f.affection}, dirt = ${f.dirt}, sick = ${f.sick},
        tick_at = ${new Date(f.tickAt)}, milk_total = ${f.milkTotal}, best_milk = ${f.bestMilk}, state = ${tx.json(f.s as never)}
        ${rankKey(f) !== before ? tx`, reached_at = now()` : tx``}
      WHERE user_id = ${userId}`;
    return out;
  });
}

// ---------------------------------------------------------------------------
// Kandang
// ---------------------------------------------------------------------------

export function farmView(row: { cow_name: string | null }, f: FarmState, now: number) {
  const mood = moodOf(f, now);
  const day = wibDayOf(now);
  const win = currentWindow(now);
  const nx = nextWindow(now);
  return {
    name: row.cow_name,
    coins: f.coins,
    kg: f.kg,
    affection: f.affection,
    hearts: hearts(f.affection),
    dirt: f.dirt,
    sick: f.sick,
    mood,
    hungry: !f.sick && isHungry(f, now),
    emoji: MOOD_EMOJI[mood],
    sprite: spriteOf(f, mood),
    title: titleOf(f),
    stage: stageOf(f.kg).name,
    milkTotal: f.milkTotal,
    bestMilk: f.bestMilk,
    outfits: f.s.outfits ?? [],
    inv: { asteroid: f.s.inv?.asteroid ?? 0, nebula: f.s.inv?.nebula ?? 0, supernova: f.s.inv?.supernova ?? 0 },
    wear: f.s.wear ?? null,
    log: (f.s.log ?? []).slice(0, 12).map((l) => ({ ...l, at: new Date(l.at).toISOString() })),
    window: win ? { ...win, end: new Date(win.end).toISOString() } : null,
    next: nx ? { label: nx.label, start: new Date(nx.start).toISOString() } : null,
    fedNow: win?.kind === "feed" ? !!f.s.fed?.[`${day}-${win.slot}`] : false,
    petToday: f.s.pet === day,
    harvestedToday: f.s.harvest === day,
  };
}
export type FarmView = ReturnType<typeof farmView>;

export const CATALOG = { feeds: FEEDS, medicine: MEDICINE, outfits: OUTFITS, milk: MILK, schedule: SCHEDULE_TEXT, maxKg: MAX_KG, maxStock: MAX_STOCK };

export async function getFarm(userId: string) {
  const t = await simNow();
  const v = await withFarm(userId, (f, c) => ({ f, now: c.now }));
  const [row] = await sql<{ cow_name: string | null }[]>`SELECT cow_name FROM farms WHERE user_id = ${userId}`;
  return { farm: farmView(row, v.f, v.now), ended: t.ended, notStarted: t.notStarted };
}

export async function nameCow(userId: string, rawName: string) {
  const name = rawName.trim().replace(/\s+/g, " ");
  if (name.length < 1 || name.length > 24) throw new ApiError(400, "VALIDATION", "Nama sapi 1–24 karakter.");
  const t = await simNow();
  if (t.ended) throw new ApiError(409, "GAMES_LOCKED", "Periode games sudah berakhir.");
  await sql`INSERT INTO farms (user_id) VALUES (${userId}) ON CONFLICT DO NOTHING`;
  const r = await sql`
    UPDATE farms SET cow_name = ${name}, named_at = now(), tick_at = now(),
      state = jsonb_set(jsonb_set(state, '{log}', ${sql.json([{ at: Date.now(), text: `🐮 ${name} resmi bergabung di peternakanmu!`, tone: "good" }])}), '{since}', to_jsonb(${Date.now()}::bigint))
    WHERE user_id = ${userId} AND cow_name IS NULL`;
  if (!r.count) throw new ApiError(409, "ALREADY_NAMED", "Sapi sudah punya nama.");
  return getFarm(userId);
}

export async function farmAction(userId: string, a: Action) {
  const t = await simNow();
  if (t.ended) throw new ApiError(409, "GAMES_LOCKED", "Periode games sudah berakhir — kondisi sapi dibekukan.");
  if (t.notStarted) throw new ApiError(409, "GAMES_NOT_STARTED", "Peternakan belum dibuka.");
  const res = await withFarm(userId, async (f, c) => {
    if (!c.named) throw new ApiError(409, "NO_COW", "Beri nama sapimu dulu.");
    try {
      const r = act(f, a, c.now, randFor(userId));
      if (r.spent) await c.tx`INSERT INTO coin_ledger (user_id, delta, kind, note) VALUES (${userId}, ${-r.spent}, 'buy', ${r.note})`;
      if (r.earned) await c.tx`INSERT INTO coin_ledger (user_id, delta, kind, note) VALUES (${userId}, ${r.earned}, 'milk', ${r.note})`;
      return r;
    } catch (e) {
      if (e instanceof FarmError) throw new ApiError(409, e.code, e.message);
      throw e;
    }
  });
  return { result: res, ...(await getFarm(userId)) };
}

// ---------------------------------------------------------------------------
// Hadiah koin dari games
// ---------------------------------------------------------------------------

/** Tambah koin sekali per `ref` (aman dipanggil berulang). `play` = bonus afeksi main game hari ini. */
async function grant(userId: string, g: { delta: number; kind: string; ref: string; game?: string; points?: number; note: string; play?: boolean }) {
  return withFarm(userId, async (f, c) => {
    const [ins] = await c.tx<{ id: string }[]>`
      INSERT INTO coin_ledger (user_id, delta, kind, ref, game, points, note)
      VALUES (${userId}, ${g.delta}, ${g.kind}, ${g.ref}, ${g.game ?? null}, ${g.points ?? null}, ${g.note})
      ON CONFLICT (user_id, ref) WHERE ref IS NOT NULL DO NOTHING RETURNING id`;
    if (!ins) return 0;
    f.coins += g.delta;
    if (g.play && c.named) playBonus(f, c.now);
    return g.delta;
  });
}

export async function rewardTts(userId: string, run: { status: string; score: number; duration_ms: number | null }) {
  if (run.status === "ACTIVE" || run.status === "INVALID") return 0;
  const coins = ttsCoins(run.score, run.duration_ms, run.status === "FINISHED");
  return grant(userId, { delta: coins, kind: "tts", ref: "tts", game: "tts", points: run.score, note: `Modal awal TTS (skor ${run.score})` });
}

export async function rewardMoordle(userId: string, day: number, won: boolean, guesses: number, durationMs: number) {
  const coins = moordleCoins(won, guesses, durationMs);
  return grant(userId, {
    delta: coins,
    kind: "moordle",
    ref: `moordle:${day}`,
    game: "moordle",
    points: won ? guesses : 0,
    note: won ? `Moordle tertebak di percobaan ke-${guesses}` : "Moordle belum tertebak",
    play: true,
  });
}

/** Poin arkade yang sudah dihitung jadi koin hari ini (WIB), per game. */
async function arcadePointsToday(userId: string, tx: Tx | typeof sql = sql) {
  const rows = await tx<{ game: ArcadeKey; points: number }[]>`
    SELECT game, COALESCE(sum(points), 0)::int AS points FROM coin_ledger
    WHERE user_id = ${userId} AND kind = 'arcade'
      AND at >= to_timestamp(${(wibDayOf(Date.now()) * 86_400_000 - 7 * 3_600_000) / 1000})
    GROUP BY game`;
  return Object.fromEntries((Object.keys(ARCADE_RATE) as ArcadeKey[]).map((g) => [g, rows.find((r) => r.game === g)?.points ?? 0])) as Record<ArcadeKey, number>;
}

/** Poin arkade → koin, dibatasi batas poin harian per game. */
export async function rewardArcade(userId: string, game: ArcadeKey, runId: string, score: number) {
  return withFarm(userId, async (f, c) => {
    const used = (await arcadePointsToday(userId, c.tx))[game];
    const counted = Math.max(0, Math.min(score, ARCADE_RATE[game].dailyCap - used));
    const coins = arcadeCoins(game, counted);
    const [ins] = await c.tx<{ id: string }[]>`
      INSERT INTO coin_ledger (user_id, delta, kind, ref, game, points, note)
      VALUES (${userId}, ${coins}, 'arcade', ${`arcade:${runId}`}, ${game}, ${counted}, ${`${ARCADE_RATE[game].name}: ${score} poin`})
      ON CONFLICT (user_id, ref) WHERE ref IS NOT NULL DO NOTHING RETURNING id`;
    if (ins) {
      f.coins += coins;
      if (c.named) playBonus(f, c.now);
    }
    return { coins: ins ? coins : 0, counted, capLeft: ARCADE_RATE[game].dailyCap - used - counted, wallet: f.coins };
  });
}

/** Ringkasan untuk halaman Games: saldo + sisa batas poin harian per game. */
export async function earnings(userId: string) {
  const [w] = await sql<{ coins: number; cow_name: string | null }[]>`SELECT coins, cow_name FROM farms WHERE user_id = ${userId}`;
  const today = await arcadePointsToday(userId);
  return {
    coins: w?.coins ?? 0,
    cowName: w?.cow_name ?? null,
    today: Object.fromEntries((Object.keys(ARCADE_RATE) as ArcadeKey[]).map((g) => [g, { used: today[g], cap: ARCADE_RATE[g].dailyCap }])) as Record<ArcadeKey, { used: number; cap: number }>,
  };
}

// ---------------------------------------------------------------------------
// Leaderboard peternak
// ---------------------------------------------------------------------------

export type FarmRank = {
  rank: number;
  user_id: string;
  name: string;
  dept: string | null;
  cow: string;
  hearts: number;
  kg: number;
  stage: string;
  bestMilk: number;
  bestGrade: string | null;
  milkTotal: number;
  title: { name: string; emoji: string };
  sprite: string;
  sick: boolean;
  wear: string | null;
};

/**
 * Peringkat: hati → berat → total susu → siapa lebih dulu mencapainya.
 * Kondisi tiap sapi dimajukan dulu sampai sekarang (atau akhir periode) supaya peternak yang
 * lama tidak merawat ikut turun walau tidak membuka kandang.
 */
export async function farmLeaderboard(opts: { limit?: number; userId?: string } = {}): Promise<FarmRank[]> {
  const t = await simNow();
  const rows = await sql<(FarmRow & { name: string; dept: string | null })[]>`
    SELECT f.*, u.full_name AS name, e.dept FROM farms f
    JOIN users u ON u.id = f.user_id LEFT JOIN employees e ON e.nik = u.nik
    WHERE f.cow_name IS NOT NULL AND u.role = 'ATTENDEE' AND u.disabled_at IS NULL`;
  const start = t.period.startAt?.getTime() ?? 0;
  const list = rows.map((r) => {
    const f = advance(toState(r), t.now, randFor(r.user_id), start);
    const mood = moodOf(f, t.now);
    const best = MILK.find((m) => m.ml === f.bestMilk);
    return {
      user_id: r.user_id,
      name: r.name,
      dept: r.dept,
      cow: r.cow_name!,
      hearts: hearts(f.affection),
      affection: f.affection,
      kg: f.kg,
      stage: stageOf(f.kg).name,
      bestMilk: f.bestMilk,
      bestGrade: best?.grade ?? null,
      milkTotal: f.milkTotal,
      title: titleOf(f),
      sprite: spriteOf(f, mood).src,
      sick: f.sick,
      wear: f.s.wear ? OUTFITS[f.s.wear].emoji : null,
      reached: r.reached_at.getTime(),
    };
  });
  list.sort((a, b) => b.hearts - a.hearts || b.kg - a.kg || b.milkTotal - a.milkTotal || a.reached - b.reached);
  const ranked = list.map((x, i) => ({ ...x, rank: i + 1 }));
  const limit = opts.limit ?? 50;
  return ranked
    .filter((x) => x.rank <= limit || x.user_id === opts.userId)
    .map(({ reached: _r, affection: _a, ...x }) => x);
}
