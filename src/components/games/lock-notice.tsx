import { fmtDateTime } from "@/lib/format";
import type { LockStatus } from "@/lib/games/lock";

/** Info periode games: belum dibuka, sudah berakhir, atau kapan berakhir. */
export function GamesLockNotice({ lock }: { lock: Pick<LockStatus, "lockAt" | "locked"> & Partial<Pick<LockStatus, "startAt" | "notStarted">> }) {
  if (lock.notStarted && lock.startAt)
    return (
      <p className="mb-4 rounded-xl border border-[#19e6ff]/50 bg-[#0f0730]/90 p-4 text-sm font-semibold text-[#9afcff]" role="status">
        Games dibuka {fmtDateTime(lock.startAt)}{lock.lockAt ? ` sampai ${fmtDateTime(lock.lockAt)}` : ""}. Sampai jumpa di peternakan!
      </p>
    );
  if (!lock.lockAt) return null;
  return lock.locked ? (
    <p className="mb-4 rounded-xl border border-amber-300/60 bg-[#0f0730]/90 p-4 text-sm font-semibold text-amber-200" role="status">
      Periode games sudah berakhir sejak {fmtDateTime(lock.lockAt)}. Kondisi sapi dibekukan — pemenang diumumkan di hari H acara!
    </p>
  ) : (
    <p className="mb-4 rounded-xl border border-[#19e6ff]/40 bg-[#0f0730]/80 p-3 text-sm text-[#dbe4ff]">
      Periode games berakhir <b className="text-white">{fmtDateTime(lock.lockAt)}</b>. Setelah itu kondisi sapi dibekukan untuk penentuan pemenang.
    </p>
  );
}
