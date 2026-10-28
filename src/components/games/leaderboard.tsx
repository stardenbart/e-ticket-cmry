"use client";

// Leaderboard peternak: hati → berat → total susu. Setelah periode games berakhir, peserta melihat
// pesan "diumumkan di hari H" (API mengembalikan 403); admin tetap melihat peringkat final.
import { useEffect, useState } from "react";
import { api, ClientApiError } from "@/lib/client-api";

type Row = {
  rank: number;
  user_id: string;
  name: string;
  dept: string | null;
  cow: string;
  hearts: number;
  kg: number;
  stage: string;
  bestGrade: string | null;
  bestMilk: number;
  milkTotal: number;
  title: { name: string; emoji: string };
  sprite: string;
  sick: boolean;
  wear: string | null;
};

export const fmtLiters = (ml: number) => `${(ml / 1000).toLocaleString("id-ID", { maximumFractionDigits: 2 })} L`;

export function Leaderboard() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [hidden, setHidden] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      api<{ rows: Row[]; me: string | null }>("/api/games/leaderboard")
        .then((r) => {
          if (!alive) return;
          setRows(r.rows);
          setMe(r.me);
          setHidden(null);
        })
        .catch((e) => {
          if (alive && e instanceof ClientApiError && e.data.code === "LEADERBOARD_HIDDEN") setHidden(e.message);
        });
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
        Leaderboard Peternak
      </h2>
      {hidden ? (
        <p className="mt-4 rounded-xl border border-[#ff2e9f]/50 bg-[#0f0730]/90 p-5 text-center text-white">
          🏆 {hidden}
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-[#19e6ff]/30 bg-[#0f0730]/85">
          <table className="w-full min-w-[680px] text-sm text-white">
            <thead>
              <tr className="font-hud text-left text-[11px] uppercase tracking-[0.14em] text-[#19e6ff]">
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Peternak</th>
                <th className="px-3 py-2">Sapi</th>
                <th className="px-3 py-2 text-center">Afeksi</th>
                <th className="px-3 py-2 text-right">Berat</th>
                <th className="px-3 py-2 text-center">Susu terbaik</th>
                <th className="px-3 py-2 text-right">Total susu</th>
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
                    Belum ada peternak. Jadilah yang pertama!
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
                    <p className="text-xs text-[#d9c2ff]">
                      {r.title.emoji} {r.title.name}
                    </p>
                    {r.dept && <p className="text-xs text-white/50">{r.dept}</p>}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={r.sprite} alt="" className="h-9 w-auto" />
                      <div>
                        <p className="font-semibold">
                          {r.cow} {r.wear}
                          {r.sick && " 🤒"}
                        </p>
                        <p className="text-xs text-white/60">{r.stage}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center text-[#ff2e9f]" aria-label={`${r.hearts} hati`}>
                    {"♥".repeat(r.hearts)}
                    <span className="text-white/20">{"♥".repeat(5 - r.hearts)}</span>
                  </td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">{r.kg.toLocaleString("id-ID")} kg</td>
                  <td className="px-3 py-2 text-center">{r.bestGrade ? <b className={r.bestGrade === "S" ? "text-[#ffb3dc]" : ""}>{r.bestGrade}</b> : <span className="text-white/40">–</span>}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtLiters(r.milkTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
