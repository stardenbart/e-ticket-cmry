"use client";

import { useEffect, useState } from "react";
import { serverOffset } from "@/lib/client-api";

/** Jam server (ms) di klien, disinkronkan lewat /api/time agar jam perangkat yang salah tidak menyesatkan. */
export function useServerNow(intervalMs = 1000): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    let offset = 0;
    let alive = true;
    const tick = () => alive && setNow(Date.now() + offset);
    serverOffset().then((o) => {
      offset = o;
      tick();
    });
    tick();
    const id = setInterval(tick, intervalMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [intervalMs]);
  return now;
}

export function splitDuration(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

export function humanDuration(ms: number) {
  const { d, h, m, s } = splitDuration(ms);
  if (d > 0) return `${d} hari ${h} jam`;
  if (h > 0) return `${h} jam ${m} menit`;
  if (m > 0) return `${m} menit ${s} detik`;
  return `${s} detik`;
}
