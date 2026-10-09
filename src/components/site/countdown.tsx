"use client";

import { useEffect, useRef } from "react";
import { cx } from "@/components/ui";
import { splitDuration, useServerNow } from "./use-server-now";

const pad = (n: number) => String(n).padStart(2, "0");

function FlipUnit({ value, label, size }: { value: string; label: string; size: "sm" | "lg" }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex gap-0.5" style={{ perspective: "300px" }}>
        {value.split("").map((ch, i) => (
          <span
            key={`${i}-${ch}`}
            className={cx(
              "flip-digit mv-count-box font-display grid place-items-center rounded-lg font-extrabold tabular-nums",
              size === "lg" ? "h-12 w-9 text-2xl sm:h-14 sm:w-10 sm:text-3xl" : "h-8 w-6 text-base",
            )}
          >
            {ch}
          </span>
        ))}
      </div>
      <span className={cx("font-hud font-semibold uppercase tracking-[0.14em] text-[#eef2ff]", size === "lg" ? "text-xs" : "text-[10px]")}>{label}</span>
    </div>
  );
}

/** Countdown gaya flip, tersinkron ke jam server. Memanggil onDone sekali saat mencapai 0. */
export function FlipCountdown({ target, size = "sm", onDone, className }: { target: string | number; size?: "sm" | "lg"; onDone?: () => void; className?: string }) {
  const now = useServerNow(1000);
  const t = typeof target === "number" ? target : new Date(target).getTime();
  const fired = useRef(false);
  const remaining = now == null ? null : t - now;

  useEffect(() => {
    if (remaining != null && remaining <= 0 && !fired.current) {
      fired.current = true;
      onDone?.();
    }
  }, [remaining, onDone]);

  if (remaining == null) return <div className={cx("skeleton", size === "lg" ? "h-16 w-64" : "h-10 w-44", className)} aria-hidden />;
  const { d, h, m, s } = splitDuration(remaining);
  const label = `${d} hari ${h} jam ${m} menit ${s} detik lagi`;
  return (
    <div className={cx("flex items-start gap-2", className)} role="timer" aria-label={label}>
      {d > 0 && <FlipUnit value={String(d)} label="Hari" size={size} />}
      <FlipUnit value={pad(h)} label="Jam" size={size} />
      <FlipUnit value={pad(m)} label="Menit" size={size} />
      <FlipUnit value={pad(s)} label="Detik" size={size} />
    </div>
  );
}

/** Countdown teks ringkas untuk kartu event. */
export function TextCountdown({ target, prefix = "Buka dalam" }: { target: string; prefix?: string }) {
  const now = useServerNow(1000);
  if (now == null) return <span>{prefix} …</span>;
  const ms = new Date(target).getTime() - now;
  if (ms <= 0) return <span>Sedang dibuka</span>;
  const { d, h, m, s } = splitDuration(ms);
  return (
    <span className="tabular-nums">
      {prefix} {d > 0 ? `${d}h ` : ""}
      {pad(h)}:{pad(m)}:{pad(s)}
    </span>
  );
}

/** Countdown kotak krem besar (hero): hari, jam, menit, detik. */
export function BoxCountdown({ target, className }: { target: string | number; className?: string }) {
  const now = useServerNow(1000);
  const t = typeof target === "number" ? target : new Date(target).getTime();
  if (now == null) return <div className={cx("flex gap-3", className)} aria-hidden>{[0, 1, 2, 3].map((k) => <div key={k} className="skeleton size-16 sm:size-20" />)}</div>;
  const { d, h, m, s } = splitDuration(Math.max(t - now, 0));
  const units: [number, string][] = [[d, "Hari"], [h, "Jam"], [m, "Menit"], [s, "Detik"]];
  return (
    <div className={cx("flex gap-3 sm:gap-5", className)} role="timer" aria-label={`${d} hari ${h} jam ${m} menit ${s} detik lagi`}>
      {units.map(([v, label]) => (
        <div key={label} className="flex flex-col items-center gap-2">
          <div className="mv-count-box grid size-[68px] place-items-center rounded-2xl sm:size-[84px]">
            <span key={v} className="flip-digit font-display text-3xl font-extrabold tabular-nums sm:text-4xl">{pad(v)}</span>
          </div>
          <span className="font-hud text-[11px] font-bold uppercase tracking-[0.18em] text-[#22e5ff]">{label}</span>
        </div>
      ))}
    </div>
  );
}
