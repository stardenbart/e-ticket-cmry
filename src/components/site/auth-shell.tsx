import { MascotLive, MvImg } from "./ornaments";
import type { ReactNode } from "react";

/** Hanya izinkan redirect ke path internal. */
export function safeNext(next: string | string[] | undefined, fallback = "/"): string {
  const v = Array.isArray(next) ? next[0] : next;
  if (!v || !v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\")) return fallback;
  return v;
}

export function AuthShell({ title, subtitle, children, aside }: { title: string; subtitle?: ReactNode; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="relative mx-auto max-w-5xl px-4 pb-8 pt-8 sm:pt-14">
      <div className="relative grid items-center gap-10 lg:grid-cols-[1fr_1.05fr]">
        <div className="hidden flex-col items-center text-center lg:flex">
          <MascotLive alt="Maskot MOO melambai" className="w-[260px]" />
          <p className="mv-neon mt-4 text-lg leading-snug">CMD Employee Gathering 2026</p>
          <p className="mt-3 max-w-md text-[#dbe4ff]">Khusus karyawan yang terdaftar di daftar karyawan. Satu NIK, satu tiket, atas nama sendiri — QR dikirim ke email Anda.</p>
          {aside ?? (
            <ul className="mt-6 space-y-3 text-left text-sm text-white">
              {["Daftar dengan NIK: 04.XXXXX (CMD) atau A1.XX.XXXX (OS)", "Nama ditulis HURUF KAPITAL sesuai KTP", "QR selalu tersedia di Tiket Saya"].map((t) => (
                <li key={t} className="flex items-center gap-3">
                  <span aria-hidden className="grid size-7 place-items-center rounded-sm border border-[#9afcff] text-xs font-bold text-[#9afcff] shadow-[0_0_10px_rgba(154,252,255,0.5)]">✓</span>
                  {t}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="relative">
          <div className="mv-frame animate-fade-up p-6 sm:p-10">
            <MvImg name="crownNeon" className="pointer-events-none absolute -top-6 left-10 h-10 w-auto drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]" />
            <h1 className="text-2xl leading-tight sm:text-3xl">{title}</h1>
            {subtitle && <div className="mt-2 text-[#dbe4ff]">{subtitle}</div>}
            <div className="mt-6">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
