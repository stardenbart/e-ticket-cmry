import Link from "next/link";
import { CimoryLogo, Logo } from "./header";
import { MvImg } from "./ornaments";
import { FEATURED_PATH } from "./config";

export function SiteFooter() {
  const link = "font-hud rounded-full px-3 py-1.5 text-base font-semibold tracking-wide text-[#dbe4ff] transition hover:bg-white/10 hover:text-[#9afcff]";
  return (
    <footer className="relative mt-24 border-t border-[#9afcff]/20 bg-[#020a17]">
      <MvImg name="neonWave" className="pointer-events-none absolute -top-16 right-[6%] hidden h-24 w-auto opacity-70 md:block" />
      <div className="mx-auto max-w-6xl px-4 pb-8 pt-10 text-center">
        <div className="flex flex-wrap items-center justify-center gap-5">
          <Logo size="lg" />
          <CimoryLogo size="lg" />
        </div>
        <p className="mx-auto mt-5 max-w-md text-sm text-[#c9d3ff]">
          Tiket gratis khusus karyawan PT Cisarua Mountain Dairy Tbk.
          <br />
          Satu NIK, satu tiket, atas nama sendiri.
        </p>
        <nav aria-label="Tautan footer" className="mt-6 flex flex-wrap justify-center gap-1">
          <Link href="/" className={link}>Beranda</Link>
          <Link href={FEATURED_PATH} className={link}>Event</Link>
          <Link href="/tiket-saya" className={link}>Tiket Saya</Link>
          <Link href="/faq" className={link}>FAQ</Link>
          <Link href="/syarat" className={link}>Syarat &amp; Ketentuan</Link>
          <Link href="/privasi" className={link}>Kebijakan Privasi</Link>
        </nav>
      </div>
      <div className="border-t border-[#9afcff]/15 py-4 text-center text-xs text-[#b9c4f0]">
        © 2026 CMD Employee Gathering · Mooniverse · PT Cisarua Mountain Dairy Tbk
      </div>
    </footer>
  );
}
