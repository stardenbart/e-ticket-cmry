import type { Metadata } from "next";
import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { myScores } from "@/lib/games/service";
import { PageHero } from "@/components/site/ornaments";
import { Leaderboard } from "@/components/games/leaderboard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Games" };

const GAMES = [
  { href: "/games/tts", key: "tts", title: "TTS Mooniverse", desc: "Teka-teki silang 10 soal tebak benda. Satu kesempatan — skor 100 tercepat jadi juara." },
  { href: "/games/snake", key: "snake", title: "Ular Retro", desc: "Makan sebanyak-banyaknya, tembus dinding, kumpulkan bonus & info acara." },
  { href: "/games/flappy", key: "flappy", title: "Flappy Cow", desc: "Terbangkan kepala sapi melewati tiang neon dan hindari lightstick." },
  { href: "/games/dino", key: "dino", title: "Dino Cow", desc: "Sapi berlari dan melompati penghalang neon. Makin lama makin cepat." },
  { href: "/games/race", key: "race", title: "Balap Sapi", desc: "Pindah jalur, ambil botol susu, dan hindari penghalang di jalan neon." },
] as const;

export default async function GamesPage() {
  const u = await currentUser();
  const mine = u ? await myScores(u.id) : null;
  const label = (key: string) => {
    if (!mine) return null;
    if (key === "tts") {
      if (!mine.tts) return "Belum dimainkan";
      return mine.tts.status === "ACTIVE" ? `Sedang dimainkan · ${mine.tts.score}/100` : `Skor ${mine.tts.score}/100 · dikunci`;
    }
    const a = mine.arcade[key as "snake"];
    return a.plays ? `Skor terakhir ${a.latest} · ${a.plays}× main` : "Belum dimainkan";
  };
  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 sm:pt-4">
      <PageHero title="Mooniverse Games" subtitle="Main, kumpulkan skor, dan rebut posisi teratas leaderboard!" />
      {!u && (
        <p className="mb-6 rounded-xl border border-[#19e6ff]/40 bg-[#0f0730]/80 p-4 text-sm text-white">
          <Link href="/login?next=%2Fgames" className="font-bold text-[#19e6ff] underline">
            Masuk
          </Link>{" "}
          dulu untuk bermain dan mencatat skor ke leaderboard.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {GAMES.map((g) => (
          <Link
            key={g.key}
            href={g.href}
            className="group rounded-2xl border border-[#19e6ff]/30 bg-[#0f0730]/85 p-5 text-white transition hover:-translate-y-0.5 hover:border-[#ff2e9f]/70 hover:shadow-[0_0_24px_rgba(255,46,159,0.25)]"
          >
            <h2 className="mv-title text-xl">{g.title}</h2>
            <p className="mt-1 text-sm text-[#dbe4ff]">{g.desc}</p>
            {label(g.key) && <p className="mt-3 text-xs font-semibold text-[#19e6ff]">{label(g.key)}</p>}
            <p className="font-hud mt-3 text-sm font-bold uppercase tracking-[0.14em] text-[#ff2e9f] group-hover:underline">Main →</p>
          </Link>
        ))}
      </div>
      <div className="mt-12">
        <Leaderboard />
      </div>
    </div>
  );
}
