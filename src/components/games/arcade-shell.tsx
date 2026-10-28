"use client";

// Bingkai game arkade: daftar sesi ke server saat mulai (waktu mulai dicatat server), kirim poin saat
// game over → ditukar Moo-coins (batas poin harian per game). Game-nya (canvas) cukup memanggil start/end.
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ClientApiError } from "@/lib/client-api";
import { useGameFocus } from "./game-focus";

export type ArcadeHooks = {
  /** Panggil saat ronde dimulai. */
  onStart: () => void;
  /** Panggil saat game over. */
  onEnd: (score: number, meta?: Record<string, number>) => void;
};

type Result = { score: number; coins: number; counted: number; accepted: boolean } | null;
type Earn = { coins: number; today: Record<string, { used: number; cap: number }> };

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
  void initialBest;
  const [earn, setEarn] = useState<Earn | null>(null);
  const loadEarn = useCallback(() => api<Earn>("/api/games/earnings").then(setEarn).catch(() => {}), []);
  useEffect(() => {
    loadEarn();
  }, [loadEarn]);
  const [result, setResult] = useState<Result>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const zone = useRef<HTMLDivElement>(null);
  useGameFocus(playing, zone);

  const onStart = useCallback(() => {
    setPlaying(true);
    setResult(null);
    setErr(null);
    runId.current = api<{ runId: string }>(`/api/games/arcade/${game}/start`, { method: "POST", json: {} })
      .then((r) => r.runId)
      .catch((e) => {
        if (e instanceof ClientApiError && (e.data.code === "GAMES_LOCKED" || e.data.code === "GAMES_NOT_STARTED")) setErr(e.message);
        return null;
      });
  }, [game]);

  const onEnd = useCallback(
    async (score: number, meta?: Record<string, number>) => {
      setPlaying(false);
      setSaving(true);
      const id = await runId.current;
      runId.current = null;
      if (!id) {
        setSaving(false);
        setErr((x) => x ?? "Skor tidak tersimpan (koneksi bermasalah saat mulai). Main lagi untuk mencatat skor.");
        setResult({ score, coins: 0, counted: 0, accepted: false });
        return;
      }
      try {
        const r = await api<{ accepted: boolean; score: number; coins: number; counted: number }>(`/api/games/arcade/${game}/finish`, { method: "POST", json: { runId: id, score, meta } });
        setResult({ score, coins: r.coins, counted: r.counted, accepted: r.accepted });
        loadEarn();
        if (!r.accepted) setErr("Skor ini tidak wajar untuk durasi permainannya, jadi tidak dihitung.");
      } catch (e) {
        setErr(e instanceof ClientApiError && (e.data.code === "GAMES_LOCKED" || e.data.code === "GAMES_NOT_STARTED") ? e.message : "Skor gagal dikirim. Periksa koneksi lalu main lagi.");
        setResult({ score, coins: 0, counted: 0, accepted: false });
      } finally {
        setSaving(false);
      }
    },
    [game, loadEarn],
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
          <p className="font-hud text-[11px] font-bold uppercase tracking-[0.16em] text-[#19e6ff]">Moo-coins</p>
          <p className="font-digits text-2xl font-black tabular-nums text-white">🪙 {earn ? earn.coins.toLocaleString("id-ID") : "–"}</p>
          {earn?.today[game] && (
            <p className="text-[11px] text-white/60">
              Poin hari ini {earn.today[game].used.toLocaleString("id-ID")}/{earn.today[game].cap.toLocaleString("id-ID")}
            </p>
          )}
        </div>
      </div>

      <div ref={zone}>{children({ onStart, onEnd })}</div>

      <div className="mt-4 space-y-3" aria-live="polite">
        {saving && <p className="text-sm text-[#cbd5e1]">Menyimpan skor…</p>}
        {result && !saving && (
          <div className="rounded-xl border border-[#19e6ff]/40 bg-[#0f0730]/90 p-4 text-white">
            <p className="font-hud text-sm font-bold uppercase tracking-[0.14em] text-[#19e6ff]">Game over</p>
            <p className="mt-1 text-lg">
              Poin <b className="font-digits">{result.score.toLocaleString("id-ID")}</b>
              {result.accepted && (
                <>
                  {" "}
                  → <b className="text-[#ffd76a]">+{result.coins} Moo-coins</b>
                </>
              )}
            </p>
            {result.accepted && result.counted < result.score && (
              <p className="mt-1 text-sm text-amber-200">
                {result.counted ? `Hanya ${result.counted.toLocaleString("id-ID")} poin yang dihitung — ` : ""}batas poin harian game ini sudah tercapai. Coba game lain atau main lagi besok!
              </p>
            )}
            <p className="mt-1 text-sm text-[#cbd5e1]">
              Pakai koinmu untuk merawat sapi.{" "}
              <Link href="/games/ternak" className="font-semibold text-[#19e6ff] underline">
                Ke kandang
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
