"use client";

// Moordle: tebak kata 5 huruf bertema konser & susu — satu kata per hari, satu kesempatan per hari.
// Tebakan dievaluasi di server; skor harian 60 (tebakan ke-1) … 10 (ke-6), gagal 0. Waktu ikut dihitung.
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ClientApiError } from "@/lib/client-api";
import { useServerNow } from "@/components/site/use-server-now";
import { fmtDuration } from "./tts";
import { useGameFocus } from "./game-focus";

type Mark = "c" | "p" | "a";
type Today = {
  no: number;
  nextResetAt: string;
  status: "ACTIVE" | "FINISHED" | "SURRENDERED" | "LOCKED" | "INVALID" | null;
  startedAt: string | null;
  durationMs: number | null;
  score: number;
  won: boolean;
  guesses: { word: string; marks: Mark[] }[];
  theme: string | null;
  answer: { word: string; desc: string } | null;
};
type Stats = { played: number; won: number; streak: number; best: number; dist: number[]; points: number };
type Lock = { lockAt: string | null; locked: boolean };

const LEN = 5;
const ROWS = 6;
const KB = ["QWERTYUIOP", "ASDFGHJKL", "*ZXCVBNM<"];
const RANK: Record<Mark, number> = { a: 1, p: 2, c: 3 };
const TILE: Record<Mark, string> = {
  c: "border-[#12c98a] bg-[#12c98a] text-white",
  p: "border-[#f5b82e] bg-[#f5b82e] text-[#2b1a00]",
  a: "border-[#3a2f63] bg-[#3a2f63] text-white",
};
const KEY: Record<Mark, string> = { c: "bg-[#12c98a] text-white", p: "bg-[#f5b82e] text-[#2b1a00]", a: "bg-[#171030] text-[#8d83b5]" };
const CHEERS = ["Luar biasa!", "Mantap!", "Keren!", "Hampir pas!", "Fiuh, lolos!", "Nyaris saja!"];

export function MoordleGame({ initial, initialStats, lock }: { initial: Today; initialStats: Stats; lock: Lock }) {
  const [today, setToday] = useState(initial);
  const [stats, setStats] = useState(initialStats);
  const [cur, setCur] = useState("");
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  const [reveal, setReveal] = useState(-1); // baris yang sedang dibalik
  const [revealN, setRevealN] = useState(0); // jumlah kotak di baris itu yang warnanya sudah tampil
  const [toast, setToast] = useState<string | null>(null);
  const [modal, setModal] = useState<"help" | "stats" | null>(null);
  const [starting, setStarting] = useState(false);
  const now = useServerNow(1000);

  const active = today.status === "ACTIVE";
  const zone = useRef<HTMLDivElement>(null);
  useGameFocus(active, zone);
  const done = !!today.status && !active;
  const closed = lock.locked && !done;

  const say = useCallback((t: string, ms = 1500) => {
    setToast(t);
    window.setTimeout(() => setToast((x) => (x === t ? null : x)), ms);
  }, []);

  async function start() {
    setStarting(true);
    try {
      const r = await api<{ today: Today }>("/api/games/moordle/start", { method: "POST", json: {} });
      setToday(r.today);
    } catch (e) {
      say(e instanceof ClientApiError ? e.message : "Gagal memulai. Coba lagi.", 3000);
    } finally {
      setStarting(false);
    }
  }

  const submit = useCallback(async () => {
    if (cur.length < LEN) {
      setShake(true);
      window.setTimeout(() => setShake(false), 450);
      say("Belum lengkap, butuh 5 huruf");
      return;
    }
    setBusy(true);
    try {
      const r = await api<{ today: Today; stats: Stats | null }>("/api/games/moordle/guess", { method: "POST", json: { guess: cur } });
      const row = r.today.guesses.length - 1;
      setToday(r.today);
      setCur("");
      setReveal(row);
      setRevealN(0);
      for (let i = 0; i < LEN; i++) window.setTimeout(() => setRevealN(i + 1), i * 280 + 250);
      window.setTimeout(() => {
        setReveal(-1);
        if (r.stats) setStats(r.stats);
        if (r.today.status === "FINISHED") {
          say(r.today.won ? CHEERS[r.today.guesses.length - 1] : `Kata hari ini: ${r.today.answer?.word}`, 2200);
          window.setTimeout(() => setModal("stats"), 1600);
        }
      }, LEN * 280 + 300);
    } catch (e) {
      if (e instanceof ClientApiError && (e.data.code === "MOORDLE_DONE" || e.data.code === "GAMES_LOCKED")) {
        const r = await api<{ today: Today }>("/api/games/moordle").catch(() => null);
        if (r) setToday(r.today);
      }
      say(e instanceof ClientApiError ? e.message : "Gagal mengirim tebakan. Periksa koneksi.", 3000);
    } finally {
      setBusy(false);
    }
  }, [cur, say]);

  const press = useCallback(
    (k: string) => {
      if (busy || !active || modal || reveal >= 0) return;
      if (k === "DEL") setCur((c) => c.slice(0, -1));
      else if (k === "ENTER") submit();
      else if (/^[A-Z]$/.test(k)) setCur((c) => (c.length < LEN ? c + k : c));
    },
    [busy, active, modal, reveal, submit],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "Escape") return setModal(null);
      if (e.key === "Enter") {
        e.preventDefault();
        press("ENTER");
      } else if (e.key === "Backspace") press("DEL");
      else if (/^[a-zA-Z]$/.test(e.key)) press(e.key.toUpperCase());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press]);

  // Warna keyboard (baris yang sedang dibalik belum ikut sampai animasi selesai).
  const keys: Record<string, Mark> = {};
  today.guesses.forEach((g, ri) => {
    if (ri === reveal) return;
    g.word.split("").forEach((ch, i) => {
      const m = g.marks[i];
      if (!keys[ch] || RANK[m] > RANK[keys[ch]]) keys[ch] = m;
    });
  });

  const elapsed = today.durationMs ?? (today.startedAt && now ? now - new Date(today.startedAt).getTime() : 0);
  const untilNext = now ? Math.max(0, new Date(today.nextResetAt).getTime() - now) : 0;

  return (
    <div ref={zone} className="relative mx-auto flex max-w-[440px] flex-col items-center text-white">
      <div className="flex w-full items-center justify-between gap-2">
        <button type="button" onClick={() => setModal("help")} className="rounded-[10px] border-[1.5px] border-[#9d4dff] bg-white/[.08] px-2.5 py-1.5 text-[13px] hover:shadow-[0_0_10px_#9d4dff]">
          Cara main
        </button>
        <p className="text-center text-xs font-semibold text-[#19e6ff] [text-shadow:0_0_8px_#19e6ff]">
          #{today.no} · konser & susu
          <br />1 kata per hari
        </p>
        <button type="button" onClick={() => setModal("stats")} className="rounded-[10px] border-[1.5px] border-[#9d4dff] bg-white/[.08] px-2.5 py-1.5 text-[13px] hover:shadow-[0_0_10px_#9d4dff]">
          Statistik
        </button>
      </div>

      {today.status && (
        <div className="mt-3 flex w-full items-center justify-between rounded-xl border border-[#19e6ff]/40 bg-[#0f0730]/90 px-4 py-2">
          <div>
            <p className="font-hud text-[11px] font-bold uppercase tracking-[0.16em] text-[#19e6ff]">Poin hari ini</p>
            <p className="font-digits text-xl font-black tabular-nums">{done ? today.score : "–"}</p>
          </div>
          <div className="text-right">
            <p className="font-hud text-[11px] font-bold uppercase tracking-[0.16em] text-[#19e6ff]">Waktu</p>
            <p className="font-digits text-xl font-black tabular-nums">{fmtDuration(elapsed)}</p>
          </div>
        </div>
      )}

      <p className="mb-1 mt-2 min-h-[26px] text-[13px] text-[#19e6ff] [text-shadow:0_0_8px_rgba(25,230,255,.7)]">{today.theme && !done ? `Petunjuk: tema hari ini adalah ${today.theme}` : ""}</p>

      <div className="grid w-[min(330px,86vw)] gap-1.5" aria-label="Papan tebakan">
        {Array.from({ length: ROWS }, (_, r) => {
          const g = today.guesses[r];
          const isCur = r === today.guesses.length && active;
          const word = g ? g.word : isCur ? cur : "";
          return (
            <div key={r} className={`grid grid-cols-5 gap-1.5 ${isCur && shake ? "animate-[mdShake_.45s]" : ""}`}>
              {Array.from({ length: LEN }, (_, i) => {
                const ch = word[i] ?? "";
                const m = g?.marks[i];
                const flipping = r === reveal;
                const shown = m && (!flipping || i < revealN);
                return (
                  <div
                    key={i}
                    style={flipping ? { animation: `mdFlip .5s ease ${i * 0.28}s both` } : undefined}
                    className={`flex aspect-square items-center justify-center rounded-lg border-2 text-[clamp(24px,8vw,32px)] font-extrabold ${
                      shown ? TILE[m as Mark] : ch ? "border-[#19e6ff] bg-white/5 shadow-[0_0_8px_rgba(25,230,255,.5)]" : "border-[#9d4dff]/45 bg-white/5"
                    }`}
                  >
                    {ch}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {!today.status && (
        <div className="mt-5 w-full rounded-xl border border-[#19e6ff]/40 bg-[#0f0730]/90 p-4 text-sm">
          {closed ? (
            <p className="font-semibold text-amber-300">Games sudah ditutup — Moordle tidak bisa dimainkan lagi.</p>
          ) : (
            <>
              <p className="text-[#dbe4ff]">
                Satu kesempatan untuk Moordle #{today.no} hari ini. Waktu mulai berjalan saat tombol ditekan. Poin: tebakan ke-1 = 60, ke-2 = 50, … ke-6 = 10.
              </p>
              <button
                type="button"
                onClick={start}
                disabled={starting}
                className="font-hud mt-3 w-full rounded-full bg-[linear-gradient(100deg,#ff2e9f,#9d4dff_50%,#19e6ff)] px-7 py-3 text-lg font-bold uppercase tracking-[0.12em] text-white shadow-[0_0_18px_rgba(255,46,159,0.5)] disabled:opacity-60"
              >
                {starting ? "Memulai…" : `Mulai Moordle #${today.no}`}
              </button>
            </>
          )}
        </div>
      )}

      {done && (
        <div className="mt-4 w-full rounded-xl border border-[#ff2e9f]/50 bg-[#0f0730]/90 p-4 text-sm" role="status">
          <p className="font-bold">
            {today.won ? `Benar di tebakan ke-${today.guesses.length} — +${today.score} poin dalam ${fmtDuration(today.durationMs ?? 0)}.` : "Kata hari ini belum berhasil ditebak (0 poin)."}
          </p>
          {today.answer && (
            <p className="mt-1 text-[#dbe4ff]">
              <b className="tracking-[3px] text-white">{today.answer.word}</b> — {today.answer.desc}.
            </p>
          )}
          <p className="mt-2 text-[#c9c0ee]">
            Kata berikutnya dalam <b className="font-digits tabular-nums text-white">{fmtDuration(untilNext)}</b>
          </p>
          <Link href="/games#leaderboard" className="mt-2 inline-block font-semibold text-[#19e6ff] hover:underline">
            Lihat leaderboard →
          </Link>
        </div>
      )}

      {active && (
        <div className="mt-4 flex w-full flex-col gap-1.5" aria-label="Keyboard">
          {KB.map((row) => (
            <div key={row} className="flex justify-center gap-[5px]">
              {row.split("").map((ch) => {
                const k = ch === "*" ? "ENTER" : ch === "<" ? "DEL" : ch;
                const wide = k.length > 1;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => press(k)}
                    className={`h-[50px] flex-1 rounded-[7px] p-0 font-bold ${wide ? "max-w-[58px] text-xs" : "max-w-10 text-[15px]"} ${keys[k] ? KEY[keys[k]] : "bg-[#2a1d55] text-white"}`}
                  >
                    {k === "ENTER" ? "Enter" : k === "DEL" ? "Hapus" : k}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {toast && <div className="pointer-events-none fixed left-1/2 top-24 z-50 -translate-x-1/2 rounded-[10px] bg-white px-4 py-2 text-center text-sm font-bold text-[#12082b]">{toast}</div>}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(5,2,18,.82)] p-4" onClick={(e) => e.target === e.currentTarget && setModal(null)}>
          <div role="dialog" aria-modal className="relative max-h-[90vh] w-full max-w-[380px] overflow-auto rounded-2xl border-2 border-[#19e6ff] bg-[#150b35] p-[18px] text-sm leading-[1.45] shadow-[0_0_24px_rgba(25,230,255,.4)]">
            <button type="button" aria-label="Tutup" onClick={() => setModal(null)} className="absolute right-2.5 top-2 text-2xl">
              ×
            </button>
            {modal === "help" ? <Help /> : <StatsView stats={stats} today={today} />}
            <button type="button" onClick={() => setModal(null)} className="mt-3 block w-full rounded-[10px] bg-[#ff2e9f] p-[11px] text-[15px] font-extrabold shadow-[0_0_14px_rgba(255,46,159,.6)]">
              {modal === "help" ? "Mengerti" : "Tutup"}
            </button>
          </div>
        </div>
      )}
      <style>{`
        @keyframes mdFlip{0%{transform:rotateX(0)}50%{transform:rotateX(90deg)}100%{transform:rotateX(0)}}
        @keyframes mdShake{20%,60%{transform:translateX(-6px)}40%,80%{transform:translateX(6px)}}
      `}</style>
    </div>
  );
}

function Ex({ letters, idx, mark }: { letters: string; idx: number; mark: Mark }) {
  return (
    <div className="my-1 flex gap-1">
      {letters.split("").map((ch, i) => (
        <span key={i} className={`flex size-7 items-center justify-center rounded-md border-2 font-extrabold ${i === idx ? TILE[mark] : "border-[#9d4dff]"}`}>
          {ch}
        </span>
      ))}
    </div>
  );
}

function Help() {
  return (
    <>
      <h2 className="mb-2 text-xl [text-shadow:0_0_8px_#ff2e9f]">Cara main</h2>
      <p>
        Tebak kata bertema <b>konser</b> atau <b>industri susu</b> dalam 6 percobaan. Setiap kata terdiri dari 5 huruf, dan semua pemain mendapat kata yang sama hari ini.
      </p>
      <Ex letters="SAPIH" idx={0} mark="c" />
      <p>Hijau: huruf benar di posisi yang benar.</p>
      <Ex letters="VOKAL" idx={1} mark="p" />
      <p>Kuning: huruf ada di kata, tapi posisinya salah.</p>
      <Ex letters="XYZQW" idx={0} mark="a" />
      <p>Abu-abu: huruf tidak ada di kata.</p>
      <p className="mt-2">Setelah tebakan ketiga, tema hari ini (konser atau susu) muncul sebagai petunjuk. Tebakan boleh berupa 5 huruf apa saja.</p>
      <p className="mt-2">
        <b>Hanya satu kesempatan per hari.</b> Poin: benar di tebakan ke-1 = 60, ke-2 = 50, ke-3 = 40, ke-4 = 30, ke-5 = 20, ke-6 = 10; gagal = 0. Waktu dihitung sejak tombol Mulai — makin
        cepat makin baik bila poin sama. Kata baru setiap pukul 00.00 WIB.
      </p>
    </>
  );
}

function StatsView({ stats, today }: { stats: Stats; today: Today }) {
  const mx = Math.max(1, ...stats.dist);
  return (
    <>
      <h2 className="mb-2 text-xl [text-shadow:0_0_8px_#ff2e9f]">Statistik</h2>
      {today.answer && (
        <p>
          <b className="text-[22px] tracking-[3px]">{today.answer.word}</b>
          <br />
          <span className="text-[#19e6ff]">Tema {today.theme}</span>: {today.answer.desc}.
        </p>
      )}
      <div className="my-2.5 grid grid-cols-4 gap-1.5 text-center text-[11px] text-[#c9c0ee]">
        {[
          [stats.played, "Main"],
          [`${stats.played ? Math.round((stats.won / stats.played) * 100) : 0}%`, "Menang"],
          [stats.streak, "Beruntun"],
          [stats.points, "Total poin"],
        ].map(([v, l]) => (
          <div key={l}>
            <b className="block text-[22px] text-white">{v}</b>
            {l}
          </div>
        ))}
      </div>
      {stats.dist.map((n, i) => (
        <div key={i} className="my-[3px] flex items-center gap-1.5 text-xs">
          <span>{i + 1}</span>
          <i className="block min-w-[18px] rounded bg-[#9d4dff] px-1.5 py-px text-right not-italic" style={{ width: `${Math.max(8, (n / mx) * 100)}%` }}>
            {n}
          </i>
        </div>
      ))}
    </>
  );
}
