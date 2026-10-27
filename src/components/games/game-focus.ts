"use client";

// Mode fokus selama sesi game berlangsung:
//   - area game digulir ke tengah layar (di bawah header yang menempel),
//   - tombol/tautan lain di halaman (header, menu, backsound, dll.) dinonaktifkan,
//   - scroll halaman dikunci bila area game muat di layar (kalau tidak muat, scroll tetap bisa).
// Gaya ada di globals.css (html.game-lock / html.game-noscroll / .game-zone).
import { useEffect, type RefObject } from "react";

export function useGameFocus(active: boolean, zone: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = zone.current;
    if (!active || !el) return;
    const root = document.documentElement;
    const headerH = document.querySelector("header")?.getBoundingClientRect().height ?? 0;
    const avail = window.innerHeight - headerH;
    const rect = el.getBoundingClientRect();
    const fits = rect.height <= avail;
    const top = window.scrollY + rect.top - headerH - (fits ? (avail - rect.height) / 2 : 8);
    window.scrollTo({ top: Math.max(0, top), behavior: "instant" as ScrollBehavior });
    el.classList.add("game-zone");
    root.classList.add("game-lock");
    if (fits) root.classList.add("game-noscroll");
    const a = document.activeElement as HTMLElement | null;
    if (a && !el.contains(a)) a.blur();
    return () => {
      root.classList.remove("game-lock", "game-noscroll");
      el.classList.remove("game-zone");
    };
  }, [active, zone]);
}
