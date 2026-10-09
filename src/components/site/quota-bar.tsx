import { cx } from "@/components/ui";
import { fmtNumber } from "@/lib/format";

/** Bar sisa kuota. Merah + label "Hampir habis" saat sisa < 10%. Hanya informasi, bukan penentu klaim. */
export function QuotaBar({ remaining, quota, compact = false }: { remaining: number; quota: number; compact?: boolean }) {
  const pct = quota > 0 ? Math.max(0, Math.min(100, (remaining / quota) * 100)) : 0;
  const low = remaining > 0 && pct < 10;
  const empty = remaining <= 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs font-medium">
        <span className="text-muted" aria-live="polite">
          {empty ? "Kuota habis" : `Sisa ${fmtNumber(remaining)} dari ${fmtNumber(quota)}`}
        </span>
        {low && (
          <span className="inline-flex items-center gap-1 font-bold text-cimory-red-dark">
            <span aria-hidden>⚠</span> Hampir habis
          </span>
        )}
      </div>
      <div
        className={cx("overflow-hidden rounded-full bg-white/10 ring-1 ring-[#22e5ff]/20", compact ? "h-1.5" : "h-2.5")}
        role="progressbar"
        aria-label="Sisa kuota"
        aria-valuemin={0}
        aria-valuemax={quota}
        aria-valuenow={remaining}
      >
        <div
          className={cx("h-full rounded-full transition-[width,background-color] duration-700 ease-out", low || empty ? "bg-gradient-to-r from-[#f472b6] to-[#ff2bd6]" : "bg-gradient-to-r from-[#ff2bd6] via-[#22e5ff] to-[#ff2bd6]")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
