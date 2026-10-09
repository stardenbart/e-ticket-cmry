import Link from "next/link";
import { currentUser, isAdminRole } from "@/lib/auth";
import { UserMenu } from "./user-menu";
import { PillNav, ScrollFlag } from "./site-chrome";
import { MvImg } from "./ornaments";

/** Logo MOONIVERSE (wordmark neon) + "by Cimory". */
export function Logo({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <Link href="/" className="group flex items-center gap-2" aria-label="Mooniverse by Cimory, beranda">
      <MvImg
        name="logo"
        eager
        className={`${size === "lg" ? "h-20" : "h-11 sm:h-12"} w-auto drop-shadow-[0_0_12px_rgba(255,43,214,0.45)] transition group-hover:drop-shadow-[0_0_18px_rgba(34,229,255,0.7)]`}
      />
      <span className="font-hud hidden whitespace-nowrap rounded-sm border border-[#22e5ff]/50 px-1.5 py-0.5 text-[11px] font-bold uppercase leading-none tracking-[0.18em] text-[#22e5ff] sm:inline-block">
        by Cimory
      </span>
    </Link>
  );
}

export async function SiteHeader() {
  const u = await currentUser();
  const user = u
    ? { name: u.full_name, email: u.email, isAdmin: isAdminRole(u.role), isStaff: u.role === "GATE_STAFF" }
    : null;
  return (
    <header className="sticky top-0 z-40 border-b border-transparent transition-colors [.mv-scrolled_&]:border-[#ff2bd6]/30 [.mv-scrolled_&]:bg-[#05061a]/85 [.mv-scrolled_&]:shadow-[0_0_30px_rgba(255,43,214,0.18)] [.mv-scrolled_&]:backdrop-blur-md">
      <ScrollFlag />
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <Logo />
        <div className="flex items-center gap-2">
          <PillNav />
          <UserMenu user={user} />
        </div>
      </div>
    </header>
  );
}
