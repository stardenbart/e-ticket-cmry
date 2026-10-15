"use client";

// PWA situs peserta: daftarkan service worker dan tawarkan "Pasang aplikasi" (Android/Chrome).
// Browser memicu `beforeinstallprompt` bila situs memenuhi syarat; event itu disimpan agar
// tombol di banner maupun di menu bisa membuka dialog pemasangan.
import { useEffect, useSyncExternalStore } from "react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const canInstall = () => deferred !== null;

const DISMISS_KEY = "pwa-dismissed-at";
const DISMISS_DAYS = 7;

function recentlyDismissed() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return Date.now() - at < DISMISS_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

export async function promptInstall() {
  if (!deferred) return;
  const ev = deferred;
  deferred = null;
  emit();
  await ev.prompt().catch(() => {});
}

export function useCanInstall() {
  return useSyncExternalStore(subscribe, canInstall, () => false);
}

/** Dipasang sekali di layout situs. */
export function PwaSetup() {
  const available = useCanInstall();

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw-site.js", { scope: "/" }).catch(() => {});
    const onPrompt = (e: Event) => {
      e.preventDefault();
      deferred = e as InstallEvent;
      emit();
    };
    const onInstalled = () => {
      deferred = null;
      emit();
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!available || recentlyDismissed()) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
    deferred = null;
    emit();
  }

  return (
    <div
      role="dialog"
      aria-label="Pasang aplikasi"
      className="fixed inset-x-3 bottom-24 z-40 flex animate-fade-up items-center gap-3 rounded-2xl border border-[#9afcff]/40 bg-[#031726]/95 p-3 shadow-[0_0_24px_rgba(247,20,247,0.35)] backdrop-blur sm:inset-x-auto sm:bottom-5 sm:left-5 sm:max-w-sm"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/app-192.png" alt="" width={44} height={44} className="size-11 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-white">Pasang aplikasi Mooniverse</p>
        <p className="text-xs text-[#cbd5e1]">Buka tiket lebih cepat langsung dari layar utama HP.</p>
      </div>
      <button
        type="button"
        onClick={promptInstall}
        className="font-hud h-9 shrink-0 rounded-full bg-[linear-gradient(100deg,#f714f7,#9b2cf5_50%,#05a5ef)] px-4 text-sm font-bold uppercase tracking-wider text-white"
      >
        Pasang
      </button>
      <button type="button" onClick={dismiss} aria-label="Tutup" className="grid size-8 shrink-0 place-items-center rounded-full text-[#cbd5e1] hover:bg-white/10">
        ✕
      </button>
    </div>
  );
}

/** Item menu "Pasang aplikasi" — hanya tampil bila browser mengizinkan pemasangan. */
export function InstallMenuItem({ className }: { className: string }) {
  const available = useCanInstall();
  if (!available) return null;
  return (
    <button type="button" onClick={promptInstall} className={`${className} w-full text-left`} role="menuitem">
      📲 Pasang aplikasi
    </button>
  );
}
