"use client";

// Podium pemenang ala Quizizz untuk diumumkan di hari H: juara 3 → 2 → 1 diungkap satu per satu.
import { useState } from "react";
import type { FarmRank } from "@/lib/ternak/service";
import { fmtLiters } from "@/components/games/leaderboard";

const PLACE = [
  { rank: 2, h: "h-40 sm:h-48", color: "from-[#c0c7d6] to-[#7c8597]", medal: "🥈", order: "order-1" },
  { rank: 1, h: "h-52 sm:h-64", color: "from-[#ffd76a] to-[#c99312]", medal: "🥇", order: "order-2" },
  { rank: 3, h: "h-32 sm:h-36", color: "from-[#e3a46b] to-[#9a5a2a]", medal: "🥉", order: "order-3" },
];

export function Podium({ rows, final }: { rows: FarmRank[]; final: boolean }) {
  const [shown, setShown] = useState(0); // 0 = belum, 1 = juara 3, 2 = juara 2, 3 = juara 1
  const top = (r: number) => rows.find((x) => x.rank === r);
  const revealed = (r: number) => shown >= 4 - r;
  const nextLabel = ["Ungkap Juara 3", "Ungkap Juara 2", "Ungkap Juara 1"][shown];

  return (
    <div data-ff className="text-white">
      {!final && <p className="mb-4 rounded-xl border border-amber-300/60 bg-[#0f0730]/90 p-3 text-center text-sm font-semibold text-amber-200">Periode games belum berakhir — ini peringkat sementara.</p>}
      <div className="relative mx-auto flex max-w-3xl items-end justify-center gap-2 sm:gap-4">
        {shown >= 3 && <Confetti />}
        {PLACE.map((p) => {
          const w = top(p.rank);
          const open = revealed(p.rank);
          return (
            <div key={p.rank} className={`${p.order} flex w-1/3 flex-col items-center`}>
              <div className="mb-2 flex min-h-[230px] flex-col items-center justify-end text-center sm:min-h-[260px]">
                {open && w ? (
                  <div style={{ animation: "pdIn .8s cubic-bezier(.2,1.4,.4,1) both" }} className="flex flex-col items-center">
                    <span className="text-4xl">{p.medal}</span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={w.sprite} alt={`Sapi ${w.cow}`} className={`${p.rank === 1 ? "h-28 sm:h-36" : "h-20 sm:h-28"} w-auto drop-shadow-[0_0_18px_rgba(255,255,255,.35)]`} style={{ animation: "ffHop 1.1s ease-in-out infinite" }} />
                    <p className={`mt-1 font-black leading-tight ${p.rank === 1 ? "text-lg sm:text-2xl" : "text-sm sm:text-lg"}`}>{w.name}</p>
                    {w.dept && <p className="text-[11px] text-white/60 sm:text-xs">{w.dept}</p>}
                    <p className="text-xs text-[#d9c2ff] sm:text-sm">
                      🐮 {w.cow} {w.wear}
                    </p>
                    <p className="text-xs text-[#ff2e9f]">{"♥".repeat(w.hearts)}</p>
                    <p className="text-[11px] text-white/80 sm:text-xs">
                      {w.kg.toLocaleString("id-ID")} kg · {w.bestGrade ? `Grade ${w.bestGrade}` : "–"} · {fmtLiters(w.milkTotal)}
                    </p>
                  </div>
                ) : (
                  <span className="text-5xl opacity-60" style={{ animation: "ffFloat 2s ease-in-out infinite" }}>
                    ❔
                  </span>
                )}
              </div>
              <div className={`${p.h} flex w-full items-start justify-center rounded-t-xl bg-gradient-to-b ${p.color} pt-3 shadow-[0_0_30px_rgba(255,46,159,.35)]`}>
                <span className="text-4xl font-black text-[#1a0b3f]/80 sm:text-6xl">{p.rank}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 text-center">
        {shown < 3 ? (
          <button
            type="button"
            onClick={() => setShown((s) => s + 1)}
            disabled={!top(3 - shown)}
            className="font-hud rounded-full bg-[linear-gradient(100deg,#ff2e9f,#9d4dff_50%,#19e6ff)] px-8 py-3 text-lg font-bold uppercase tracking-[0.12em] shadow-[0_0_18px_rgba(255,46,159,0.5)] disabled:opacity-50"
          >
            {nextLabel}
          </button>
        ) : (
          <button type="button" onClick={() => setShown(0)} className="text-sm font-semibold text-[#19e6ff] underline">
            Ulangi pengumuman
          </button>
        )}
      </div>

      {shown >= 3 && rows.length > 3 && (
        <div className="mx-auto mt-8 max-w-xl rounded-xl border border-white/10 bg-[#0f0730]/85 p-4">
          <p className="font-hud mb-2 text-sm font-bold uppercase tracking-[0.14em] text-[#19e6ff]">Peringkat 4–10</p>
          <ol className="space-y-1.5 text-sm">
            {rows
              .filter((r) => r.rank > 3 && r.rank <= 10)
              .map((r) => (
                <li key={r.user_id} className="flex items-center justify-between gap-2">
                  <span>
                    <b className="mr-2">{r.rank}.</b>
                    {r.name} <span className="text-white/60">· {r.cow}</span>
                  </span>
                  <span className="shrink-0 text-white/80">
                    <span className="text-[#ff2e9f]">{"♥".repeat(r.hearts)}</span> {r.kg.toLocaleString("id-ID")} kg
                  </span>
                </li>
              ))}
          </ol>
        </div>
      )}
      <style>{`
        @keyframes pdIn{0%{transform:translateY(40px) scale(.4);opacity:0}100%{transform:none;opacity:1}}
        @keyframes ffHop{0%,100%{transform:translateY(0)}40%{transform:translateY(-14px)}}
        @keyframes ffFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
        @keyframes pdFall{0%{transform:translateY(-20px) rotate(0);opacity:1}100%{transform:translateY(420px) rotate(540deg);opacity:0}}
      `}</style>
    </div>
  );
}

function Confetti() {
  const bits = ["🎉", "✨", "🥛", "💖", "🐮", "⭐"];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-10 h-0">
      {Array.from({ length: 28 }, (_, i) => (
        <span key={i} className="absolute text-xl" style={{ left: `${(i * 37) % 100}%`, animation: `pdFall ${2.2 + (i % 5) * 0.4}s ease-in ${(i % 7) * 0.25}s infinite` }}>
          {bits[i % bits.length]}
        </span>
      ))}
    </div>
  );
}
