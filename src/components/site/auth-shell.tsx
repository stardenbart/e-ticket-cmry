import { MvImg } from "./ornaments";
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
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-16 size-[480px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(232,28,255,0.22),transparent_65%)]" />
      <div className="relative grid items-center gap-10 lg:grid-cols-[1fr_1.05fr]">
        <div className="hidden flex-col items-center text-center lg:flex">
          <MvImg name="mascot" alt="Maskot MOO melambai" className="mv-float h-auto w-[300px] drop-shadow-[0_0_30px_rgba(232,28,255,0.45)]" />
          <p className="font-display mt-2 text-3xl font-black uppercase leading-tight text-white mv-glow">Satu akun, satu tiket, atas nama sendiri.</p>
          <p className="mt-3 max-w-md text-[#dbe4ff]">Klaim tiket gratis secara adil. Urutan ditentukan oleh server, dan tiket langsung dikirim sebagai QR ke email Anda.</p>
          {aside ?? (
            <ul className="mt-6 space-y-3 text-left text-sm text-white">
              {["Verifikasi email dengan kode OTP", "Identitas disimpan sebagai hash, bukan nomor lengkap", "QR selalu tersedia di Tiket Saya"].map((t) => (
                <li key={t} className="flex items-center gap-3">
                  <span aria-hidden className="grid size-7 place-items-center rounded-sm border border-[#22e5ff] text-xs font-bold text-[#22e5ff] shadow-[0_0_10px_rgba(34,229,255,0.5)]">✓</span>
                  {t}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="mv-halo">
          <div className="mv-frame animate-fade-up p-6 sm:p-10">
            <MvImg name="crown" className="pointer-events-none absolute -top-5 left-10 h-9 w-auto" />
            <h1 className="text-2xl leading-tight sm:text-3xl">{title}</h1>
            {subtitle && <div className="mt-2 text-[#dbe4ff]">{subtitle}</div>}
            <div className="mt-6">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
