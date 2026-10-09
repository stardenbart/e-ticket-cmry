"use client";

import { useEffect, useRef } from "react";
import { cx } from "@/components/ui";

/** Input OTP 6 digit: auto-maju, backspace mundur, dukung paste seluruh kode. */
export function OtpInput({ value, onChange, onComplete, disabled, invalid }: { value: string; onChange: (v: string) => void; onComplete?: (v: string) => void; disabled?: boolean; invalid?: boolean }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? "");

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  const set = (v: string) => {
    const clean = v.replace(/\D/g, "").slice(0, 6);
    onChange(clean);
    if (clean.length === 6) onComplete?.(clean);
    return clean;
  };

  return (
    <div className="flex justify-between gap-2" role="group" aria-label="Kode OTP 6 digit">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={d}
          disabled={disabled}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          aria-label={`Digit ${i + 1}`}
          maxLength={6}
          className={cx(
            "mv-otp font-display h-16 w-full min-w-0 rounded-2xl border-2 bg-white text-center text-3xl font-extrabold tabular-nums text-ink transition focus:outline-none focus:ring-2",
            invalid ? "border-cimory-red focus:ring-cimory-red/25" : "border-line focus:border-cimory-blue focus:ring-cimory-blue/20",
          )}
          onChange={(e) => {
            const raw = e.target.value.replace(/\D/g, "");
            if (raw.length > 1) {
              // paste / autofill
              const clean = set(value.slice(0, i) + raw);
              refs.current[Math.min(clean.length, 5)]?.focus();
              return;
            }
            const arr = digits.slice();
            arr[i] = raw;
            const joined = arr.join("").slice(0, 6);
            set(joined);
            if (raw && i < 5) refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !digits[i] && i > 0) {
              refs.current[i - 1]?.focus();
              const arr = digits.slice();
              arr[i - 1] = "";
              onChange(arr.join(""));
              e.preventDefault();
            } else if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
            else if (e.key === "ArrowRight" && i < 5) refs.current[i + 1]?.focus();
          }}
          onPaste={(e) => {
            e.preventDefault();
            const clean = set(e.clipboardData.getData("text"));
            refs.current[Math.min(clean.length, 5)]?.focus();
          }}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  );
}
