import Link from "next/link";
import { currentUser, isAdminRole } from "@/lib/auth";
import { UserMenu } from "./user-menu";
import { PillNav, ScrollFlag } from "./site-chrome";
import { MvImg } from "./ornaments";

/** Logo situs: ikon kepala sapi + nama acara. */
export function Logo({ size = "md" }: { size?: "md" | "lg" }) {
  const lg = size === "lg";
  return (
    <Link href="/" className="group flex items-center gap-2.5" aria-label="CMD Employee Gathering 2026, beranda">
      <MvImg name={lg ? "cowHead" : "cowHeadSm"} eager={!lg} className={`${lg ? "h-16" : "h-10 sm:h-11"} w-auto`} />
      <span className="font-hud flex flex-col text-left leading-none">
        <span className={`${lg ? "text-lg" : "text-[13px] sm:text-[15px]"} font-bold uppercase tracking-[0.14em] text-white`}>CMD Employee</span>
        <span className={`${lg ? "text-sm" : "text-[11px] sm:text-xs"} mt-1 font-bold uppercase tracking-[0.22em] text-[#9afcff]`}>Gathering 2026</span>
      </span>
    </Link>
  );
}

/** Logo Cimory pada latar terang kecil agar tetap terbaca di tema gelap. */
export function CimoryLogo({ size = "md", className = "" }: { size?: "md" | "lg"; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full bg-white/95 px-2.5 py-1 ${className}`}>
      <MvImg name={size === "lg" ? "cimory" : "cimorySm"} alt="Cimory" eager={size !== "lg"} className={`${size === "lg" ? "h-12" : "h-7"} w-auto`} />
    </span>
  );
}

export async function SiteHeader() {
  const u = await currentUser();
  const user = u
    ? { name: u.full_name, email: u.email, isAdmin: isAdminRole(u.role), isStaff: u.role === "GATE_STAFF" }
    : null;
  return (
    <header className="sticky top-0 z-40 border-b border-transparent transition-colors [.mv-scrolled_&]:border-[#f714f7]/30 [.mv-scrolled_&]:bg-[#020a17]/95">
      <ScrollFlag />
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <Logo />
        <div className="flex items-center gap-2">
          <PillNav />
          {/* Disembunyikan di HP & tablet agar header tidak sesak. */}
          <CimoryLogo className="hidden lg:inline-flex" />
          <UserMenu user={user} />
        </div>
      </div>
    </header>
  );
}
