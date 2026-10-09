import Link from "next/link";
import { Logo } from "./header";
import { Marquee, MvImg, Sparkle } from "./ornaments";

export function SiteFooter() {
  const link = "font-hud rounded-full px-3 py-1.5 text-base font-semibold tracking-wide text-[#dbe4ff] transition hover:bg-white/10 hover:text-[#22e5ff]";
  return (
    <footer className="relative mt-24">
      {/* Kerumunan dengan light stick di tepi atas footer */}
      <div aria-hidden className="pointer-events-none relative -mb-1 flex h-24 justify-center overflow-hidden sm:h-32">
        <MvImg name="crowd" className="h-full w-auto max-w-none opacity-90 [mask-image:linear-gradient(90deg,transparent,#000_15%,#000_85%,transparent)]" />
        <MvImg name="crowd" className="hidden h-full w-auto max-w-none opacity-90 [mask-image:linear-gradient(90deg,transparent,#000_15%,#000_85%,transparent)] md:block" />
        <MvImg name="crowd" className="hidden h-full w-auto max-w-none opacity-90 [mask-image:linear-gradient(90deg,transparent,#000_15%,#000_85%,transparent)] xl:block" />
      </div>
      <Marquee />
      <div className="relative bg-[#05061a]">
        <div className="mx-auto max-w-6xl px-4 pb-8 pt-10 text-center">
          <div className="flex justify-center">
            <Logo size="lg" />
          </div>
          <p className="font-hud mt-2 text-sm font-bold uppercase tracking-[0.3em] text-[#22e5ff]">by Cimory · Good Food Good Mood</p>
          <p className="mx-auto mt-3 max-w-md text-sm text-[#c9d3ff]">
            Tiket gratis berbasis registrasi. Satu akun, satu tiket per event, atas nama sendiri.
          </p>
          <p className="mv-divider my-6 text-xs">
            <Sparkle className="size-3.5" />
          </p>
          <nav aria-label="Tautan footer" className="flex flex-wrap justify-center gap-1">
            <Link href="/" className={link}>Beranda</Link>
            <Link href="/event" className={link}>Jelajah Event</Link>
            <Link href="/tiket-saya" className={link}>Tiket Saya</Link>
            <Link href="/faq" className={link}>FAQ</Link>
            <Link href="/syarat" className={link}>Syarat &amp; Ketentuan</Link>
            <Link href="/privasi" className={link}>Kebijakan Privasi</Link>
          </nav>
        </div>
        <div className="border-t border-[#22e5ff]/15 py-4 text-center text-xs text-[#b9c4f0]">
          © {new Date().getFullYear()} Mooniverse by Cimory · PT Cisarua Mountain Dairy Tbk
        </div>
      </div>
    </footer>
  );
}
