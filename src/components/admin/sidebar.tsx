"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { cx } from "@/components/ui";

type Item = { href: string; label: string; icon: string; exact?: boolean };

const ICONS: Record<string, string> = {
  dash: "M4 13h6V4H4zm0 7h6v-5H4zm10 0h6v-9h-6zm0-16v5h6V4z",
  event: "M7 3v2M17 3v2M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z",
  audit: "M9 5h10M9 12h10M9 19h10M5 5h.01M5 12h.01M5 19h.01",
  users: "M16 19v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1M10 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm10 9v-1a4 4 0 0 0-3-3.9M15 4.1a3 3 0 0 1 0 5.8",
  block: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM5.6 5.6l12.8 12.8",
};

export function AdminSidebar({ superAdmin, name, email }: { superAdmin: boolean; name: string; email: string }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const items: Item[] = [
    { href: "/admin", label: "Dashboard", icon: "dash", exact: true },
    { href: "/admin/events", label: "Daftar Event", icon: "event" },
    { href: "/admin/audit", label: "Audit Log", icon: "audit" },
    ...(superAdmin
      ? [
          { href: "/admin/akun", label: "Akun Admin", icon: "users" },
          { href: "/admin/blokir-email", label: "Blokir Domain Email", icon: "block" },
        ]
      : []),
  ];
  const active = (i: Item) => (i.exact ? path === i.href : path === i.href || path.startsWith(i.href + "/"));

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/admin/login");
  }

  return (
    <>
      <header className="bg-cimory-gradient sticky top-0 z-30 flex h-14 items-center justify-between px-4 text-white lg:hidden">
        <button onClick={() => setOpen(!open)} className="rounded-lg p-2 hover:bg-white/10" aria-label="Menu" aria-expanded={open}>
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span className="font-bold">Panel Admin</span>
        <span className="w-10" />
      </header>
      <aside
        className={cx(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-cimory-blue text-white transition-transform lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="bg-cimory-gradient px-5 py-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-80">E-Ticket Gathering</p>
          <p className="text-lg font-bold">Panel Admin</p>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {items.map((i) => (
            <Link
              key={i.href}
              href={i.href}
              onClick={() => setOpen(false)}
              aria-current={active(i) ? "page" : undefined}
              className={cx(
                "flex items-center gap-3 rounded-lg border-l-4 px-3 py-2.5 text-sm font-medium transition",
                active(i) ? "border-cimory-red bg-white/12 text-white" : "border-transparent text-white/80 hover:bg-white/8 hover:text-white",
              )}
            >
              <svg viewBox="0 0 24 24" className={cx("size-5", active(i) && "text-cimory-red")} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d={ICONS[i.icon]} />
              </svg>
              {i.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-white/10 px-4 py-4 text-sm">
          <p className="truncate font-semibold">{name}</p>
          <p className="truncate text-white/70">{email}</p>
          <p className="mt-1 text-xs text-white/60">{superAdmin ? "Super Admin" : "Event Admin"}</p>
          <button onClick={logout} className="mt-3 w-full rounded-lg bg-white/10 px-3 py-2 font-semibold hover:bg-white/20">
            Keluar
          </button>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}
    </>
  );
}
