"use client";

// Bingkai game arkade: daftar sesi ke server saat mulai (waktu mulai dicatat server), kirim skor saat
// game over, lalu tampilkan hasil + skor terbaik. Game-nya sendiri (canvas) cukup memanggil start/end.
import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { api } from "@/lib/client-api";

export type ArcadeHooks = {
  /** Panggil saat ronde dimulai. */
  onStart: () => void;
  /** Panggil saat game over. */
  onEnd: (score: number, meta?: Record<string, number>) => void;
};

type Result = { score: number; best: number; accepted: boolean } | null;

export function ArcadeShell({
  game,
  title,
  howTo,
  initialBest,
  children,
}: {
  game: "snake" | "flappy" | "dino" | "race";
  title: string;
  howTo: React.ReactNode;
  initialBest: number;
  children: (hooks: ArcadeHooks) => React.ReactNode;
}) {
  const runId = useRef<Promise<string | null> | null>(null);
  const [best, setBest] = useState(initialBest);
  const [result, setResult] = useState<Result>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onStart = useCallback(() => {
    setResult(null);
    setErr(null);
    runId.current = api<{ runId: string }>(`/api/games/arcade/${game}/start`, { method: "POST", json: {} })
      .then((r) => r.runId)
      .catch(() => null);
  }, [game]);

  const onEnd = useCallback(
    async (score: number, meta?: Record<string, number>) => {
      setSaving(true);
      const id = await runId.current;
      runId.current = null;
      if (!id) {
        setSaving(false);
        setErr("Skor tidak tersimpan (koneksi bermasalah saat mulai). Main lagi untuk mencatat skor.");
        setResult({ score, best, accepted: false });
        return;
      }
      try {
        const r = await api<{ accepted: boolean; score: number; best: number }>(`/api/games/arcade/${game}/finish`, { method: "POST", json: { runId: id, score, meta } });
        setBest(r.best);
        setResult({ score, best: r.best, accepted: r.accepted });
        if (!r.accepted) setErr("Skor ini tidak wajar untuk durasi permainannya, jadi tidak dihitung.");
      } catch {
        setErr("Skor gagal dikirim. Periksa koneksi lalu main lagi.");
        setResult({ score, best, accepted: false });
      } finally {
        setSaving(false);
      }
    },
    [game, best],
  );

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-24 sm:pt-28">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/games" className="text-sm font-semibold text-[#19e6ff] hover:underline">
            ← Semua game
          </Link>
          <h1 className="mv-title mt-1 text-2xl sm:text-3xl">{title}</h1>
        </div>
        <div className="rounded-xl border border-[#19e6ff]/40 bg-[#0f0730]/80 px-4 py-2 text-right">
          <p className="font-hud text-[11px] font-bold uppercase tracking-[0.16em] text-[#19e6ff]">Skor terbaik</p>
          <p className="font-digits text-2xl font-black tabular-nums text-white">{best}</p>
        </div>
      </div>

      {children({ onStart, onEnd })}

      <div className="mt-4 space-y-3" aria-live="polite">
        {saving && <p className="text-sm text-[#cbd5e1]">Menyimpan skor…</p>}
        {result && !saving && (
          <div className="rounded-xl border border-[#19e6ff]/40 bg-[#0f0730]/90 p-4 text-white">
            <p className="font-hud text-sm font-bold uppercase tracking-[0.14em] text-[#19e6ff]">Game over</p>
            <p className="mt-1 text-lg">
              Skor <b className="font-digits">{result.score}</b>
              {result.accepted && result.score >= result.best && result.score > 0 ? " — rekor baru Anda! 🎉" : ` · terbaik ${result.best}`}
            </p>
            <p className="mt-1 text-sm text-[#cbd5e1]">
              Skor terbaik dihitung ke leaderboard.{" "}
              <Link href="/games#leaderboard" className="font-semibold text-[#19e6ff] underline">
                Lihat leaderboard
              </Link>
            </p>
          </div>
        )}
        {err && <p className="text-sm font-semibold text-amber-300">{err}</p>}
      </div>

      <div className="mt-6 rounded-xl border border-white/10 bg-[#0f0730]/70 p-4 text-sm text-[#dbe4ff]">
        <p className="font-hud mb-2 text-xs font-bold uppercase tracking-[0.16em] text-[#19e6ff]">Cara main</p>
        {howTo}
      </div>
    </div>
  );
}

/** Ukuran canvas mengikuti lebar kontainer, tajam di layar retina. */
export function setupCanvas(canvas: HTMLCanvasElement, w: number, h: number) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

export function loadImage(src: string) {
  const img = new Image();
  img.src = src;
  return img;
}

export const COW_HEAD = "/images/brand/kepala-sapi-96.webp";
