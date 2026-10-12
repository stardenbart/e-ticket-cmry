"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Untuk scanner QR genggam USB/Bluetooth (mode keyboard / HID): alat "mengetik" isi QR lalu Enter.
 * Input selalu difokuskan ulang selama mode aktif dan layar hasil tidak tampil. Jalan di http://.
 */
export function HandheldInput({ active, paused, onDetect }: { active: boolean; paused: boolean; onDetect: (text: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");

  useEffect(() => {
    if (!active || paused) return;
    const focus = () => {
      const ae = document.activeElement;
      // Jangan merebut fokus dari input lain (mis. input manual / pencarian).
      if (ae !== ref.current && !(ae instanceof HTMLInputElement || ae instanceof HTMLTextAreaElement)) {
        ref.current?.focus({ preventScroll: true });
      }
    };
    focus();
    const t = setInterval(focus, 800);
    return () => clearInterval(t);
  }, [active, paused]);

  if (!active) return null;
  return (
    <form
      className="mt-4 rounded-2xl bg-cimory-blue/30 p-4 text-white ring-1 ring-white/15"
      onSubmit={(e) => {
        e.preventDefault();
        const v = value.trim();
        setValue("");
        if (v) onDetect(v);
      }}
    >
      <label htmlFor="handheld" className="block text-sm font-semibold">
        Siap menerima scan dari alat scanner genggam
      </label>
      <input
        id="handheld"
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        inputMode="none"
        placeholder="Arahkan alat ke QR…"
        className="mt-2 min-h-12 w-full rounded-xl border border-white/20 bg-slate-900 px-3 font-mono text-sm text-white"
      />
      <p className="mt-2 text-xs text-white/60">Alat harus mode keyboard (HID) dan mengirim Enter setelah scan.</p>
    </form>
  );
}
