// Kunci games: admin menetapkan tenggat (game_settings.lock_at). Setelah lewat, semua game ditutup,
// skor tidak lagi dicatat, dan leaderboard dibekukan untuk menetapkan pemenang sebelum hari H.
import { sql } from "../db";
import { ApiError } from "../http";
import { fmtDateTime } from "../format";

export async function gamesLockAt(): Promise<Date | null> {
  const [r] = await sql<{ lock_at: Date | null }[]>`SELECT lock_at FROM game_settings WHERE id`;
  return r?.lock_at ?? null;
}

export const isLockedAt = (lockAt: Date | null, now = Date.now()) => !!lockAt && lockAt.getTime() <= now;

export const lockedMessage = (lockAt: Date) => `Games sudah ditutup sejak ${fmtDateTime(lockAt)} — skor tidak lagi dicatat.`;

/** Lempar 409 GAMES_LOCKED bila tenggat sudah lewat. */
export async function assertGamesOpen() {
  const lockAt = await gamesLockAt();
  if (lockAt && isLockedAt(lockAt)) throw new ApiError(409, "GAMES_LOCKED", lockedMessage(lockAt));
  return lockAt;
}

/** Status untuk halaman: { lockAt, locked }. */
export async function gamesLockStatus() {
  const lockAt = await gamesLockAt();
  return { lockAt: lockAt?.toISOString() ?? null, locked: isLockedAt(lockAt) };
}

export async function setGamesLock(lockAt: Date | null, actorId: string) {
  await sql`UPDATE game_settings SET lock_at = ${lockAt}, updated_at = now(), updated_by = ${actorId} WHERE id`;
}
