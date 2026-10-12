import Link from "next/link";
import { Logo } from "./header";
import { LineCow, Marquee, MvImg, Sparkle } from "./ornaments";
import { FEATURED_PATH } from "./config";

export function SiteFooter() {
  const link = "font-hud rounded-full px-3 py-1.5 text-base font-semibold tracking-wide text-[#dbe4ff] transition hover:bg-white/10 hover:text-[#9afcff]";
  return (
    <footer className="relative mt-24 overflow-hidden">
      <div aria-hidden className="mv-texture mv-texture-lasers mv-texture-bottom inset-x-0 -top-10 h-56 opacity-70" />
      {/* Kerumunan dengan light stick di tepi atas footer */}
      <div aria-hidden className="pointer-events-none relative -mb-1 flex h-24 justify-center overflow-hidden sm:h-32">
        <MvImg name="crowd" className="h-full w-auto max-w-none opacity-90 [mask-image:linear-gradient(90deg,transparent,#000_15%,#000_85%,transparent)]" />
        <MvImg name="crowd" className="hidden h-full w-auto max-w-none opacity-90 [mask-image:linear-gradient(90deg,transparent,#000_15%,#000_85%,transparent)] md:block" />
        <MvImg name="crowd" className="hidden h-full w-auto max-w-none opacity-90 [mask-image:linear-gradient(90deg,transparent,#000_15%,#000_85%,transparent)] xl:block" />
      </div>
      <Marquee />
      <div className="relative bg-[#020a17]">
        <LineCow side="left" className="absolute left-[4%] top-8 hidden w-36 opacity-60 lg:block" />
        <LineCow side="right" className="absolute right-[4%] top-10 hidden w-40 opacity-60 [animation-delay:-3s] lg:block" />
        <div className="mx-auto max-w-6xl px-4 pb-8 pt-10 text-center">
          <div className="flex justify-center">
            <Logo size="lg" />
          </div>
          <p className="mv-brush mt-2 text-2xl">Good Food Good Mood</p>
          <p className="font-hud mt-1 text-sm font-bold uppercase tracking-[0.3em] text-[#9afcff]">by Cimory</p>
          <p className="mx-auto mt-3 max-w-md text-sm text-[#c9d3ff]">
            Tiket gratis berbasis registrasi. Satu akun, satu tiket per event, atas nama sendiri.
          </p>
          <p className="mv-divider my-6 text-xs">
            <Sparkle className="size-3.5" />
          </p>
          <nav aria-label="Tautan footer" className="flex flex-wrap justify-center gap-1">
            <Link href="/" className={link}>Beranda</Link>
            <Link href={FEATURED_PATH} className={link}>Event</Link>
            <Link href="/tiket-saya" className={link}>Tiket Saya</Link>
            <Link href="/faq" className={link}>FAQ</Link>
            <Link href="/syarat" className={link}>Syarat &amp; Ketentuan</Link>
            <Link href="/privasi" className={link}>Kebijakan Privasi</Link>
          </nav>
        </div>
        <div className="border-t border-[#9afcff]/15 py-4 text-center text-xs text-[#b9c4f0]">
          © {new Date().getFullYear()} Mooniverse by Cimory · PT Cisarua Mountain Dairy Tbk
        </div>
      </div>
    </footer>
  );
}
