import type { Metadata } from "next";
import Link from "next/link";
import { currentUser, isAdminRole } from "@/lib/auth";
import { ttsRun } from "@/lib/games/service";
import { PageHero } from "@/components/site/ornaments";
import { Leaderboard } from "@/components/games/leaderboard";
import { GamesLockNotice } from "@/components/games/lock-notice";
import { gamesLockStatus } from "@/lib/games/lock";
import { moordleRun } from "@/lib/games/moordle";
import { earnings } from "@/lib/ternak/service";
import { ARCADE_RATE, rateText, type ArcadeKey } from "@/lib/ternak/earn";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Games" };

const GAMES = [
  { href: "/games/tts", key: "tts", title: "TTS Mooniverse", desc: "Teka-teki silang 10 soal, satu kesempatan. Skormu jadi modal awal Moo-coins.", rate: "150 + 3 × skor koin (sekali)" },
  { href: "/games/moordle", key: "moordle", title: "Moordle", desc: "Tebak kata harian bertema konser & susu. Makin cepat tertebak, makin banyak koin.", rate: "Tebakan ke-1 = 120 … ke-6 = 30 koin/hari" },
  { href: "/games/flappy", key: "flappy", title: "Flappy Cow", desc: "Terbangkan kepala sapi melewati tiang neon dan hindari lightstick." },
  { href: "/games/dino", key: "dino", title: "Dino Cow", desc: "Sapi berlari dan melompati penghalang neon. Makin lama makin cepat." },
  { href: "/games/snake", key: "snake", title: "Ular Retro", desc: "Makan sebanyak-banyaknya, tembus dinding, kumpulkan bonus & info acara." },
  { href: "/games/race", key: "race", title: "Balap Sapi", desc: "Pindah jalur, ambil botol susu, dan hindari penghalang di jalan neon." },
] as const;

export default async function GamesPage() {
  const u = await currentUser();
  const [earn, tts, md, lock] = await Promise.all([u ? earnings(u.id) : null, u ? ttsRun(u.id) : undefined, u ? moordleRun(u.id) : undefined, gamesLockStatus()]);
  const label = (key: string) => {
    if (!earn) return null;
    if (key === "tts") return !tts ? "Belum dimainkan" : tts.status === "ACTIVE" ? `Sedang dimainkan · ${tts.score}/100` : `Selesai · skor ${tts.score}/100`;
    if (key === "moordle") {
      if (!md) return "Hari ini: belum dimainkan";
      if (md.status === "ACTIVE") return `Hari ini: sedang dimainkan (${md.state.guesses.length}/6)`;
      return md.state.won ? `Hari ini: tertebak di percobaan ke-${md.state.guesses.length}` : "Hari ini: belum tertebak";
    }
    const t = earn.today[key as ArcadeKey];
    return `Poin hari ini: ${t.used.toLocaleString("id-ID")} / ${t.cap.toLocaleString("id-ID")}${t.used >= t.cap ? " · batas tercapai" : ""}`;
  };
  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 sm:pt-4">
      <PageHero title="Mooniverse Games" subtitle="Grow your Cow, Grow your Country — kumpulkan poin, tukar jadi Moo-coins, rawat sapimu!" />
      <GamesLockNotice lock={lock} />
      {!u && (
        <p className="mb-6 rounded-xl border border-[#19e6ff]/40 bg-[#0f0730]/80 p-4 text-sm text-white">
          <Link href="/login?next=%2Fgames" className="font-bold text-[#19e6ff] underline">
            Masuk
          </Link>{" "}
          dulu untuk bermain dan beternak.
        </p>
      )}

      <Link
        href="/games/ternak"
        className="group mb-6 flex items-center gap-4 rounded-2xl border border-[#ff2e9f]/60 bg-[radial-gradient(ellipse_at_20%_0%,rgba(255,46,159,.3),transparent_60%),#0f0730] p-5 text-white shadow-[0_0_24px_rgba(255,46,159,0.25)] transition hover:-translate-y-0.5"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/ternak/sapi-remaja-senang.webp" alt="" className="h-24 w-auto shrink-0 drop-shadow-[0_6px_10px_rgba(0,0,0,.5)]" />
        <div className="min-w-0 flex-1">
          <h2 className="mv-title text-xl sm:text-2xl">Ternak Sapi</h2>
          <p className="text-sm text-[#dbe4ff]">
            {earn?.cowName ? `Kandang ${earn.cowName} menunggumu.` : "Beri nama pedetmu, beri makan siang & sore, panen susu tiap malam."}
          </p>
          {earn && <p className="mt-1 font-digits text-lg font-black">🪙 {earn.coins.toLocaleString("id-ID")} Moo-coins</p>}
          <p className="font-hud mt-1 text-sm font-bold uppercase tracking-[0.14em] text-[#ff2e9f] group-hover:underline">Ke kandang →</p>
        </div>
      </Link>

      <h2 className="font-hud mb-3 text-sm font-bold uppercase tracking-[0.16em] text-[#19e6ff]">Kumpulkan Moo-coins</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {GAMES.map((g) => (
          <Link
            key={g.key}
            href={g.href}
            className="group rounded-2xl border border-[#19e6ff]/30 bg-[#0f0730]/85 p-5 text-white transition hover:-translate-y-0.5 hover:border-[#ff2e9f]/70 hover:shadow-[0_0_24px_rgba(255,46,159,0.25)]"
          >
            <h3 className="mv-title text-xl">{g.title}</h3>
            <p className="mt-1 text-sm text-[#dbe4ff]">{g.desc}</p>
            <p className="mt-2 text-xs font-semibold text-[#ffb3dc]">🪙 {"rate" in g ? g.rate : `${rateText(g.key as ArcadeKey)} · maks ${ARCADE_RATE[g.key as ArcadeKey].dailyCap.toLocaleString("id-ID")} poin/hari`}</p>
            {label(g.key) && <p className="mt-1 text-xs font-semibold text-[#19e6ff]">{label(g.key)}</p>}
            <p className="font-hud mt-3 text-sm font-bold uppercase tracking-[0.14em] text-[#ff2e9f] group-hover:underline">Main →</p>
          </Link>
        ))}
      </div>
      <div className="mt-12">
        <Leaderboard />
        {u && isAdminRole(u.role) && (
          <Link href="/games/pemenang" className="mt-3 inline-block text-sm font-semibold text-[#19e6ff] underline">
            Halaman pemenang (admin) →
          </Link>
        )}
      </div>
    </div>
  );
}
