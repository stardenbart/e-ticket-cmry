// Periode games: admin menetapkan waktu mulai (start_at) dan akhir (lock_at). Di luar periode semua game
// & kandang tertutup. Setelah akhir: kondisi sapi dibekukan, leaderboard & pemenang hanya untuk admin.
import { sql } from "../db";
import { ApiError } from "../http";
import { fmtDateTime } from "../format";

type Period = { startAt: Date | null; lockAt: Date | null };

export async function gamesPeriod(): Promise<Period> {
  const [r] = await sql<{ start_at: Date | null; lock_at: Date | null }[]>`SELECT start_at, lock_at FROM game_settings WHERE id`;
  return { startAt: r?.start_at ?? null, lockAt: r?.lock_at ?? null };
}

export async function gamesLockAt(): Promise<Date | null> {
  return (await gamesPeriod()).lockAt;
}

export const isLockedAt = (lockAt: Date | null, now = Date.now()) => !!lockAt && lockAt.getTime() <= now;
export const notStartedAt = (startAt: Date | null, now = Date.now()) => !!startAt && startAt.getTime() > now;

export const lockedMessage = (lockAt: Date) => `Periode games sudah berakhir sejak ${fmtDateTime(lockAt)} — permainan tidak lagi dicatat.`;
export const notStartedMessage = (startAt: Date) => `Games baru dibuka ${fmtDateTime(startAt)}. Sampai jumpa!`;

/** Lempar 409 bila di luar periode games (belum mulai / sudah berakhir). */
export async function assertGamesOpen() {
  const p = await gamesPeriod();
  if (p.lockAt && isLockedAt(p.lockAt)) throw new ApiError(409, "GAMES_LOCKED", lockedMessage(p.lockAt));
  if (p.startAt && notStartedAt(p.startAt)) throw new ApiError(409, "GAMES_NOT_STARTED", notStartedMessage(p.startAt));
  return p;
}

export type LockStatus = { startAt: string | null; lockAt: string | null; locked: boolean; notStarted: boolean };

export async function gamesLockStatus(): Promise<LockStatus> {
  const p = await gamesPeriod();
  return {
    startAt: p.startAt?.toISOString() ?? null,
    lockAt: p.lockAt?.toISOString() ?? null,
    locked: isLockedAt(p.lockAt),
    notStarted: notStartedAt(p.startAt),
  };
}

export async function setGamesPeriod(p: Period, actorId: string) {
  await sql`UPDATE game_settings SET start_at = ${p.startAt}, lock_at = ${p.lockAt}, updated_at = now(), updated_by = ${actorId} WHERE id`;
}
