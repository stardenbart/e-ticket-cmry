import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { currentUser, isAdminRole } from "@/lib/auth";
import { farmLeaderboard } from "@/lib/ternak/service";
import { gamesLockStatus } from "@/lib/games/lock";
import { Podium } from "@/components/ternak/podium";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pemenang Games", robots: { index: false } };

/** Halaman pengumuman pemenang (hanya admin) — ditayangkan di hari H acara. */
export default async function WinnersPage() {
  const u = await currentUser();
  if (!u || !isAdminRole(u.role)) notFound();
  const [rows, lock] = await Promise.all([farmLeaderboard({ limit: 10 }), gamesLockStatus()]);
  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-24 sm:pt-28">
      <Link href="/games" className="text-sm font-semibold text-[#19e6ff] hover:underline">
        ← Games
      </Link>
      <h1 className="mv-title mb-1 mt-1 text-center text-3xl sm:text-5xl">Juara Peternak Mooniverse</h1>
      <p className="mb-8 text-center text-[#dbe4ff]">Grow your Cow, Grow your Country</p>
      <Podium rows={rows} final={lock.locked} />
    </div>
  );
}
