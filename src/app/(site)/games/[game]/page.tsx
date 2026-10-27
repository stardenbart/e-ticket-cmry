import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/auth";
import { getEventBySlug } from "@/lib/events";
import { fmtDate, fmtTime } from "@/lib/format";
import { isArcade, myScores } from "@/lib/games/service";
import { FEATURED_SLUG } from "@/components/site/config";
import { SnakeGame } from "@/components/games/snake";
import { FlappyGame } from "@/components/games/flappy";
import { DinoGame } from "@/components/games/dino";
import { RaceGame } from "@/components/games/race";
import { GamesLockNotice } from "@/components/games/lock-notice";
import { gamesLockStatus } from "@/lib/games/lock";

export const dynamic = "force-dynamic";

const TITLES: Record<string, string> = { snake: "Ular Retro", flappy: "Flappy Cow", dino: "Dino Cow", race: "Balap Sapi" };

export async function generateMetadata({ params }: { params: Promise<{ game: string }> }): Promise<Metadata> {
  const { game } = await params;
  return { title: TITLES[game] ?? "Games" };
}

/** Poin informasi untuk game Ular: info acara + butir S&K event (diambil dari data event, selalu terbaru). */
async function eventInfos() {
  const e = await getEventBySlug(FEATURED_SLUG);
  if (!e) return [];
  const strip = (h: string) => h.replace(/<br\s*\/?>/gi, " — ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
  const terms = [...(e.terms ?? "").matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => strip(m[1])).filter(Boolean);
  const place = [e.venue, e.city].filter(Boolean).join(", ");
  return [
    `${e.name} digelar ${fmtDate(e.start_at, e.timezone)} pukul ${fmtTime(e.start_at, e.timezone)}${place ? ` di ${place}` : ""}.`,
    ...terms.map((t) => `S&K — ${t}`),
    "Satu NIK hanya untuk satu tiket, atas nama sendiri dan tidak dapat dipindahtangankan.",
    "QR tiket selalu tersedia di menu Tiket Saya — siapkan di HP saat masuk gate.",
  ];
}

export default async function ArcadePage({ params }: { params: Promise<{ game: string }> }) {
  const { game } = await params;
  if (!isArcade(game)) notFound();
  const u = await requirePageUser();
  const lock = await gamesLockStatus();
  if (lock.locked) {
    return (
      <div className="mx-auto max-w-3xl px-4 pb-16 pt-24 sm:pt-28">
        <Link href="/games" className="text-sm font-semibold text-[#19e6ff] hover:underline">
          ← Semua game
        </Link>
        <h1 className="mv-title mb-4 mt-1 text-2xl sm:text-3xl">{TITLES[game]}</h1>
        <GamesLockNotice lock={lock} />
      </div>
    );
  }
  const best = (await myScores(u.id)).arcade[game].latest;
  if (game === "snake") return <SnakeGame best={best} infos={await eventInfos()} />;
  if (game === "flappy") return <FlappyGame best={best} />;
  if (game === "race") return <RaceGame best={best} />;
  return <DinoGame best={best} />;
}
