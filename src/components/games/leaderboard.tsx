"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client-api";
import { fmtDuration } from "./tts";

type Row = {
  user_id: string;
  name: string;
  dept: string | null;
  tts_score: number;
  tts_ms: number | null;
  tts_status: string | null;
  snake_best: number;
  flappy_best: number;
  dino_best: number;
  snake_pts: number;
  flappy_pts: number;
  dino_pts: number;
  total: number;
  rank: number;
};

export function Leaderboard() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [me, setMe] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      api<{ rows: Row[]; me: string | null }>("/api/games/leaderboard")
        .then((r) => {
          if (!alive) return;
          setRows(r.rows);
          setMe(r.me);
        })
        .catch(() => {});
    load();
    const t = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  return (
    <section id="leaderboard" aria-labelledby="lb-title" className="scroll-mt-24">
      <h2 id="lb-title" className="mv-title text-2xl">
        Leaderboard
      </h2>
      <p className="mt-1 text-sm text-[#cbd5e1]">
        Total = skor TTS (maks 100) + poin Ular, Flappy, dan Dino (masing-masing maks 100: skor terbaikmu dibanding skor terbaik tertinggi di game
        itu). Seri ditentukan oleh waktu TTS tercepat, lalu siapa yang lebih dulu selesai. Diperbarui otomatis.
      </p>
      <div className="mt-4 overflow-x-auto rounded-xl border border-[#9afcff]/30 bg-[#031726]/85">
        <table className="w-full min-w-[640px] text-sm text-white">
          <thead>
            <tr className="font-hud text-left text-[11px] uppercase tracking-[0.14em] text-[#9afcff]">
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Nama</th>
              <th className="px-3 py-2 text-right">TTS</th>
              <th className="px-3 py-2 text-right">Ular</th>
              <th className="px-3 py-2 text-right">Flappy</th>
              <th className="px-3 py-2 text-right">Dino</th>
              <th className="px-3 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows === null && (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-center text-white/60">
                  Memuat…
                </td>
              </tr>
            )}
            {rows?.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-center text-white/60">
                  Belum ada pemain. Jadilah yang pertama!
                </td>
              </tr>
            )}
            {rows?.map((r) => (
              <tr key={r.user_id} className={`border-t border-white/10 ${r.user_id === me ? "bg-[#f714f7]/15" : ""}`}>
                <td className="px-3 py-2 font-bold">{r.rank <= 3 ? ["🥇", "🥈", "🥉"][r.rank - 1] : r.rank}</td>
                <td className="px-3 py-2">
                  <p className="font-semibold">
                    {r.name}
                    {r.user_id === me && <span className="ml-1 text-xs text-[#f714f7]">(Anda)</span>}
                  </p>
                  {r.dept && <p className="text-xs text-white/60">{r.dept}</p>}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {r.tts_status ? (
                    <>
                      <b>{r.tts_score}</b>
                      <p className="text-xs text-white/60">{r.tts_ms != null ? fmtDuration(r.tts_ms) : "-"}</p>
                    </>
                  ) : (
                    <span className="text-white/40">–</span>
                  )}
                </td>
                <Pts pts={r.snake_pts} best={r.snake_best} />
                <Pts pts={r.flappy_pts} best={r.flappy_best} />
                <Pts pts={r.dino_pts} best={r.dino_best} />
                <td className="px-3 py-2 text-right text-base font-black tabular-nums text-[#9afcff]">{r.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Pts({ pts, best }: { pts: number; best: number }) {
  return (
    <td className="px-3 py-2 text-right tabular-nums">
      {best > 0 ? (
        <>
          <b>{pts}</b>
          <p className="text-xs text-white/60">skor {best}</p>
        </>
      ) : (
        <span className="text-white/40">–</span>
      )}
    </td>
  );
}
