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
  snake: number;
  flappy: number;
  dino: number;
  race: number;
  moordle: number;
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
      <div className="mt-4 overflow-x-auto rounded-xl border border-[#19e6ff]/30 bg-[#0f0730]/85">
        <table className="w-full min-w-[800px] text-sm text-white">
          <thead>
            <tr className="font-hud text-left text-[11px] uppercase tracking-[0.14em] text-[#19e6ff]">
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Nama</th>
              <th className="px-3 py-2 text-right">TTS</th>
              <th className="px-3 py-2 text-right">Moordle</th>
              <th className="px-3 py-2 text-right">Ular</th>
              <th className="px-3 py-2 text-right">Flappy</th>
              <th className="px-3 py-2 text-right">Dino</th>
              <th className="px-3 py-2 text-right">Balap</th>
              <th className="px-3 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows === null && (
              <tr>
                <td colSpan={9} className="px-3 py-4 text-center text-white/60">
                  Memuat…
                </td>
              </tr>
            )}
            {rows?.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-4 text-center text-white/60">
                  Belum ada pemain. Jadilah yang pertama!
                </td>
              </tr>
            )}
            {rows?.map((r) => (
              <tr key={r.user_id} className={`border-t border-white/10 ${r.user_id === me ? "bg-[#ff2e9f]/15" : ""}`}>
                <td className="px-3 py-2 font-bold">{r.rank <= 3 ? ["🥇", "🥈", "🥉"][r.rank - 1] : r.rank}</td>
                <td className="px-3 py-2">
                  <p className="font-semibold">
                    {r.name}
                    {r.user_id === me && <span className="ml-1 text-xs text-[#ff2e9f]">(Anda)</span>}
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
                <Pts v={r.moordle} />
                <Pts v={r.snake} />
                <Pts v={r.flappy} />
                <Pts v={r.dino} />
                <Pts v={r.race} />
                <td className="px-3 py-2 text-right text-base font-black tabular-nums text-[#19e6ff]">{r.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Pts({ v }: { v: number }) {
  return <td className="px-3 py-2 text-right font-semibold tabular-nums">{v > 0 ? v : <span className="text-white/40">–</span>}</td>;
}
