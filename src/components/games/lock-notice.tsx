import { fmtDateTime } from "@/lib/format";

/** Info tenggat games: sudah ditutup, atau akan ditutup pada waktu tertentu. */
export function GamesLockNotice({ lock }: { lock: { lockAt: string | null; locked: boolean } }) {
  if (!lock.lockAt) return null;
  return lock.locked ? (
    <p className="mb-4 rounded-xl border border-amber-300/60 bg-[#0f0730]/90 p-4 text-sm font-semibold text-amber-200" role="status">
      Games sudah ditutup sejak {fmtDateTime(lock.lockAt)}. Permainan dan skor tidak lagi dicatat — leaderboard sudah final.
    </p>
  ) : (
    <p className="mb-4 rounded-xl border border-[#19e6ff]/40 bg-[#0f0730]/80 p-3 text-sm text-[#dbe4ff]">
      Games ditutup pada <b className="text-white">{fmtDateTime(lock.lockAt)}</b> untuk penentuan pemenang. Skor setelah itu tidak dihitung.
    </p>
  );
}
