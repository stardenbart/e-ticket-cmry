"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type U = { name: string; email: string; isAdmin: boolean; isStaff: boolean } | null;

export function UserMenu({ user }: { user: U }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/");
    router.refresh();
  }

  const item = "block rounded-full px-3 py-2.5 text-sm font-medium text-[#f8fafc] hover:bg-white/10";

  return (
    <div className="relative" ref={ref}>
      <div className="flex items-center gap-2">
        {!user && (
          <>
            <Link href={`/login?next=${encodeURIComponent(pathname)}`} className="font-hud hidden h-10 items-center rounded-full border border-[#22e5ff]/60 bg-white/[0.05] px-4 text-[15px] font-bold uppercase tracking-[0.08em] text-white backdrop-blur-md transition hover:bg-[#22e5ff]/15 hover:shadow-[0_0_14px_rgba(34,229,255,0.45)] sm:inline-flex">
              Masuk
            </Link>
            <Link href="/daftar" className="font-hud inline-flex h-10 items-center gap-1.5 rounded-full bg-[linear-gradient(100deg,#ff2bd6,#b026ff_50%,#2d6bff)] px-4 text-[15px] font-bold uppercase tracking-[0.08em] text-white shadow-[0_0_18px_rgba(255,43,214,0.55)] ring-1 ring-white/30 transition hover:brightness-110">
              <span aria-hidden>✦</span> Daftar
            </Link>
          </>
        )}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label={user ? `Menu akun ${user.name}` : "Buka menu"}
          className={`flex h-11 items-center gap-2 rounded-full border border-[#22e5ff]/30 bg-[#0d0f3a]/85 px-1.5 pr-2 text-white shadow-[0_6px_18px_rgba(5,6,26,0.4)] backdrop-blur transition hover:bg-[#1b0b4d] ${user ? "sm:pr-4" : "md:hidden"}`}
        >
          {user ? (
            <span className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-[#22e5ff] to-[#ff2bd6] text-sm font-extrabold text-[#05061a]">
              {user.name.trim().charAt(0).toUpperCase()}
            </span>
          ) : (
            <svg viewBox="0 0 24 24" className="mx-1 size-6 text-white" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
          {user && <span className="hidden max-w-32 truncate text-sm font-semibold text-white sm:block">{user.name.split(" ")[0]}</span>}
        </button>
      </div>
      {open && (
        <div role="menu" className="absolute right-0 mt-3 w-64 animate-fade-up rounded-lg border border-[#22e5ff]/50 bg-[#07081f]/95 p-2 shadow-[0_0_30px_rgba(255,43,214,0.25)] backdrop-blur-md">
          {user && (
            <div className="mb-1 border-b border-line px-3 pb-2 pt-1">
              <p className="truncate text-sm font-semibold">{user.name}</p>
              <p className="truncate text-xs text-muted">{user.email}</p>
            </div>
          )}
          <div className="md:hidden">
            <Link href="/event" className={item} role="menuitem">Jelajah Event</Link>
            <Link href="/tiket-saya" className={item} role="menuitem">Tiket Saya</Link>
            <Link href="/faq" className={item} role="menuitem">FAQ</Link>
          </div>
          {user ? (
            <>
              <Link href="/tiket-saya" className={`${item} hidden md:block`} role="menuitem">Tiket Saya</Link>
              <Link href="/profil" className={item} role="menuitem">Profil &amp; Identitas</Link>
              {user.isAdmin && <Link href="/admin" className={item} role="menuitem">Panel Admin</Link>}
              {(user.isStaff || user.isAdmin) && <Link href="/scanner" className={item} role="menuitem">Aplikasi Scanner</Link>}
              <button type="button" onClick={logout} className={`${item} w-full text-left text-cimory-red-dark`} role="menuitem">
                Keluar
              </button>
            </>
          ) : (
            <>
              <Link href={`/login?next=${encodeURIComponent(pathname)}`} className={item} role="menuitem">Masuk</Link>
              <Link href="/daftar" className={item} role="menuitem">Daftar akun</Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
