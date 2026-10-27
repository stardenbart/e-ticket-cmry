import type { Metadata } from "next";
import Link from "next/link";
import { requirePageUser } from "@/lib/auth";
import { publicPuzzle } from "@/lib/games/tts-puzzle";
import { ttsRun, ttsView } from "@/lib/games/service";
import { TtsGame } from "@/components/games/tts";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "TTS Mooniverse" };

export default async function TtsPage() {
  const u = await requirePageUser();
  const run = ttsView(await ttsRun(u.id));
  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-24 sm:pt-28">
      <Link href="/games" className="text-sm font-semibold text-[#19e6ff] hover:underline">
        ← Semua game
      </Link>
      <h1 className="mv-title mb-4 mt-1 text-2xl sm:text-3xl">TTS Mooniverse</h1>
      <TtsGame puzzle={publicPuzzle()} initialRun={run} />
    </div>
  );
}
