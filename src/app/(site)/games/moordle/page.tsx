import type { Metadata } from "next";
import Link from "next/link";
import { requirePageUser } from "@/lib/auth";
import { moordleRun, moordleStats, moordleView } from "@/lib/games/moordle";
import { gamesLockStatus } from "@/lib/games/lock";
import { MoordleGame } from "@/components/games/moordle";
import { GamesLockNotice } from "@/components/games/lock-notice";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Moordle" };

export default async function MoordlePage() {
  const u = await requirePageUser();
  const [run, stats, lock] = await Promise.all([moordleRun(u.id), moordleStats(u.id), gamesLockStatus()]);
  return (
    <div className="mx-auto max-w-xl px-3 pb-16 pt-24 sm:pt-28">
      <Link href="/games" className="text-sm font-semibold text-[#19e6ff] hover:underline">
        ← Semua game
      </Link>
      <h1 className="mv-title mb-3 mt-1 text-2xl sm:text-3xl">Moordle</h1>
      <GamesLockNotice lock={lock} />
      <MoordleGame initial={moordleView(run)} initialStats={stats} lock={lock} />
    </div>
  );
}
