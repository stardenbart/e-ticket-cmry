"use client";

// TTS Mooniverse. Jawaban dicek di server: benar → kotak terkunci (+10), salah → bisa diubah lagi.
// Satu kesempatan: keluar halaman / aplikasi = skor & waktu dikunci; bisa menyerah kapan saja.
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { api, ClientApiError } from "@/lib/client-api";
import { useServerNow } from "@/components/site/use-server-now";
import { useGameFocus } from "./game-focus";
import { ttsCoins } from "@/lib/ternak/earn";

type Entry = { key: string; num: number; dir: "A" | "D"; row: number; col: number; length: number; clue: string };
type Puzzle = { rows: number; cols: number; open: boolean[][]; numbers: Record<string, number>; entries: Entry[]; maxScore: number };
type Run = {
  status: "ACTIVE" | "FINISHED" | "SURRENDERED" | "LOCKED" | "INVALID";
  score: number;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  solved: string[];
  letters: Record<string, string>;
};

const HEARTBEAT_MS = 15_000;

const cellsOf = (e: Entry) => Array.from({ length: e.length }, (_, i) => (e.dir === "A" ? `${e.row},${e.col + i}` : `${e.row + i},${e.col}`));

export function fmtDuration(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h ? `${h}:` : ""}${String(m).padStart(h ? 2 : 1, "0")}:${String(sec).padStart(2, "0")}`;
}

export function TtsGame({ puzzle, initialRun }: { puzzle: Puzzle; initialRun: Run | null }) {
  const [run, setRun] = useState<Run | null>(initialRun);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [wrong, setWrong] = useState<Record<string, boolean>>({});
  const [checking, setChecking] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const zone = useRef<HTMLDivElement>(null);
  const now = useServerNow(1000);
  const active = run?.status === "ACTIVE";
  useGameFocus(active, zone, { lockScroll: false });

  const solved = useMemo(() => new Set(run?.solved ?? []), [run]);
  const entryCells = useMemo(() => Object.fromEntries(puzzle.entries.map((e) => [e.key, cellsOf(e)])), [puzzle]);

  // Huruf yang tampil di grid: terkunci (benar) diutamakan, lalu ketikan jawaban yang sedang diisi.
  const display = useMemo(() => {
    const out: Record<string, { ch: string; locked: boolean }> = {};
    for (const e of puzzle.entries) {
      const typed = (inputs[e.key] ?? "").toUpperCase();
      entryCells[e.key].forEach((cell, i) => {
        if (typed[i] && !out[cell]) out[cell] = { ch: typed[i], locked: false };
      });
    }
    for (const [cell, ch] of Object.entries(run?.letters ?? {})) out[cell] = { ch, locked: true };
    return out;
  }, [puzzle, inputs, run, entryCells]);

  const selectedCells = new Set(entryCells[selected] ?? []);

  // Heartbeat selama bermain; keluar halaman → kunci skor (sendBeacon tetap terkirim saat tab ditutup).
  useEffect(() => {
    if (!active) return;
    const beat = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const r = await api<{ run: Run }>("/api/games/tts/heartbeat", { method: "POST", json: {} });
        setRun(r.run);
      } catch (e) {
        if (e instanceof ClientApiError && (e.data.code === "TTS_LOCKED" || e.data.code === "GAMES_LOCKED")) {
          const r = await api<{ run: Run | null }>("/api/games/tts");
          setRun(r.run);
        }
      }
    }, HEARTBEAT_MS);
    const leave = () => navigator.sendBeacon("/api/games/tts/leave");
    window.addEventListener("pagehide", leave);
    return () => {
      clearInterval(beat);
      window.removeEventListener("pagehide", leave);
      // Pindah ke halaman lain di situs (komponen dilepas) juga dihitung keluar.
      leave();
    };
  }, [active]);

  // Kembali ke tab setelah lama tersembunyi: ambil status terbaru (mungkin sudah dikunci server).
  useEffect(() => {
    const onVis = async () => {
      if (document.visibilityState === "visible" && run?.status === "ACTIVE") {
        try {
          const r = await api<{ run: Run | null }>("/api/games/tts");
          setRun(r.run);
        } catch {}
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [run?.status]);

  async function start() {
    setStarting(true);
    setErr(null);
    try {
      const r = await api<{ run: Run }>("/api/games/tts/start", { method: "POST", json: {} });
      setRun(r.run);
    } catch (e) {
      setErr(e instanceof ClientApiError ? e.message : "Gagal memulai. Coba lagi.");
    } finally {
      setStarting(false);
    }
  }

  const check = useCallback(
    async (e: Entry, value: string) => {
      setChecking(e.key);
      try {
        const r = await api<{ correct: boolean; run: Run }>("/api/games/tts/answer", { method: "POST", json: { key: e.key, answer: value } });
        setRun(r.run);
        setWrong((w) => ({ ...w, [e.key]: !r.correct }));
        if (r.correct) {
          // Lanjut ke soal berikutnya (urutan nomor) yang belum terjawab.
          const i = puzzle.entries.findIndex((x) => x.key === e.key);
          const order = [...puzzle.entries.slice(i + 1), ...puzzle.entries.slice(0, i)];
          const next = order.find((x) => !r.run.solved.includes(x.key));
          if (next) {
            setSelected(next.key);
            setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 30);
          }
        }
      } catch (x) {
        if (x instanceof ClientApiError && (x.data.code === "TTS_LOCKED" || x.data.code === "GAMES_LOCKED")) {
          const r = await api<{ run: Run | null }>("/api/games/tts");
          setRun(r.run);
        } else setErr(x instanceof ClientApiError ? x.message : "Gagal mengecek jawaban. Periksa koneksi.");
      } finally {
        setChecking(null);
      }
    },
    [puzzle],
  );

  function onType(e: Entry, raw: string) {
    if (checking === e.key) return;
    const v = raw.toUpperCase().replace(/[^A-Z]/g, "").slice(0, e.length);
    setInputs((s) => ({ ...s, [e.key]: v }));
    setWrong((w) => ({ ...w, [e.key]: false }));
    if (v.length === e.length) check(e, v);
  }

  async function surrender() {
    if (!confirm("Yakin menyerah? Skor dan waktu Anda saat ini akan dikunci dan TTS tidak bisa dilanjutkan.")) return;
    try {
      const r = await api<{ run: Run }>("/api/games/tts/surrender", { method: "POST", json: {} });
      setRun(r.run);
    } catch (e) {
      setErr(e instanceof ClientApiError ? e.message : "Gagal. Coba lagi.");
    }
  }

  const elapsed = run ? (run.durationMs ?? (now ? now - new Date(run.startedAt).getTime() : 0)) : 0;

  // Pilih soal; fokus ke kolom jawaban (keyboard HP langsung muncul) bila masih bisa dijawab.
  function select(key: string) {
    setSelected(key);
    if (run?.status === "ACTIVE" && !run.solved.includes(key)) setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 30);
  }
  const curIdx = puzzle.entries.findIndex((e) => e.key === selected);
  const cur = curIdx >= 0 ? puzzle.entries[curIdx] : null;
  const go = (step: number) => {
    const n = puzzle.entries.length;
    const i = curIdx < 0 ? (step > 0 ? 0 : n - 1) : (curIdx + step + n) % n;
    select(puzzle.entries[i].key);
  };

  const clickCell = (cell: string) => {
    const hits = puzzle.entries.filter((e) => entryCells[e.key].includes(cell));
    if (!hits.length) return;
    // Klik kedua di kotak persilangan berpindah arah.
    const cur = hits.findIndex((h) => h.key === selected);
    const pick = hits[(cur + 1) % hits.length] ?? hits[0];
    select(pick.key);
  };

  if (!run) {
    return (
      <div className="space-y-4">
        <PuzzleGrid puzzle={puzzle} display={{}} selected={new Set()} solved={new Set()} onCell={() => {}} />
        <div className="rounded-xl border border-[#19e6ff]/40 bg-[#0f0730]/90 p-5 text-white">
          <p className="font-hud text-sm font-bold uppercase tracking-[0.14em] text-[#19e6ff]">Aturan</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#dbe4ff]">
            <li>
              {puzzle.entries.length} soal, masing-masing 10 poin (maks {puzzle.maxScore}). Skormu jadi <b>modal awal Moo-coins</b> untuk ternak sapi: 150 + 3 × skor, bonus +50 bila sempurna dalam &lt; 3 menit.
            </li>
            <li>Jawaban benar langsung terkunci. Jawaban salah boleh diubah tanpa pengurangan poin.</li>
            <li>
              <b>Hanya satu kesempatan.</b> Waktu berjalan sejak tombol Mulai. Keluar dari halaman atau aplikasi = skor dan waktu otomatis dikunci.
            </li>
            <li>Tidak bisa menjawab semua? Tekan Menyerah — skor yang sudah didapat tetap dihitung.</li>
          </ul>
          {err && <p className="mt-3 text-sm font-semibold text-amber-300">{err}</p>}
          <button
            type="button"
            onClick={start}
            disabled={starting}
            className="font-hud mt-4 w-full rounded-full bg-[linear-gradient(100deg,#ff2e9f,#9d4dff_50%,#19e6ff)] px-7 py-3 text-lg font-bold uppercase tracking-[0.12em] text-white shadow-[0_0_18px_rgba(255,46,159,0.5)] disabled:opacity-60"
          >
            {starting ? "Memulai…" : "Mulai TTS"}
          </button>
        </div>
      </div>
    );
  }

  const done = run.status !== "ACTIVE";
  const STATUS: Record<string, string> = {
    FINISHED: "Selesai — semua jawaban benar! 🎉",
    SURRENDERED: "Anda menyerah — skor dikunci.",
    LOCKED: "Skor dikunci karena Anda keluar dari permainan.",
    INVALID: "Sesi tidak valid.",
  };

  return (
    <div ref={zone} className="space-y-4">
      <div className="sticky top-16 z-20 flex items-center justify-between gap-3 rounded-xl border border-[#19e6ff]/40 bg-[#0f0730]/95 px-4 py-2 text-white backdrop-blur">
        <div>
          <p className="font-hud text-[11px] font-bold uppercase tracking-[0.16em] text-[#19e6ff]">Skor</p>
          <p className="font-digits text-xl font-black tabular-nums">
            {run.score}
            <span className="text-sm text-white/60">/{puzzle.maxScore}</span>
          </p>
        </div>
        <div className="text-center">
          <p className="font-hud text-[11px] font-bold uppercase tracking-[0.16em] text-[#19e6ff]">Waktu</p>
          <p className="font-digits text-xl font-black tabular-nums">{fmtDuration(elapsed)}</p>
        </div>
        {!done ? (
          <button type="button" onClick={surrender} className="rounded-full border border-red-400/70 px-4 py-1.5 text-sm font-semibold text-red-300 hover:bg-red-500/10">
            Menyerah
          </button>
        ) : (
          <Link href="/games/ternak" className="rounded-full border border-[#19e6ff]/60 px-4 py-1.5 text-sm font-semibold text-[#19e6ff]">
            Ke kandang
          </Link>
        )}
      </div>

      {done && (
        <div className="rounded-xl border border-[#ff2e9f]/50 bg-[#0f0730]/90 p-4 text-white" role="status">
          <p className="font-bold">{STATUS[run.status] ?? "Selesai"}</p>
          <p className="mt-1 text-sm text-[#dbe4ff]">
            Hasil akhir: <b>{run.score}</b> poin dalam <b>{fmtDuration(run.durationMs ?? 0)}</b> → modal awal{" "}
            <b className="text-[#ffd76a]">🪙 {ttsCoins(run.score, run.durationMs, run.status === "FINISHED")} Moo-coins</b>.
          </p>
        </div>
      )}

      <PuzzleGrid puzzle={puzzle} display={display} selected={selectedCells} solved={solved} onCell={clickCell} />

      {err && <p className="text-sm font-semibold text-amber-300">{err}</p>}

      <ClueCard
        entry={cur}
        index={curIdx}
        total={puzzle.entries.length}
        solvedCount={solved.size}
        ok={cur ? solved.has(cur.key) : false}
        value={cur ? (inputs[cur.key] ?? "") : ""}
        lockedLetters={cur ? entryCells[cur.key].map((c) => run.letters[c] ?? "") : []}
        wrong={cur ? !!wrong[cur.key] : false}
        checking={cur ? checking === cur.key : false}
        done={done}
        inputRef={inputRef}
        onType={(v) => cur && onType(cur, v)}
        onPrev={() => go(-1)}
        onNext={() => go(1)}
      />
    </div>
  );
}

function ClueCard(p: {
  entry: Entry | null;
  index: number;
  total: number;
  solvedCount: number;
  ok: boolean;
  value: string;
  lockedLetters: string[];
  wrong: boolean;
  checking: boolean;
  done: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  onType: (v: string) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const e = p.entry;
  const nav = "grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#19e6ff]/50 text-lg font-bold text-[#19e6ff] hover:bg-[#19e6ff]/10";
  return (
    <section className="rounded-xl border border-[#19e6ff]/40 bg-[#0f0730]/90 p-4 text-white" aria-live="polite">
      <div className="flex items-center gap-3">
        <button type="button" onClick={p.onPrev} aria-label="Soal sebelumnya" className={nav}>
          ‹
        </button>
        <div className="min-w-0 flex-1 text-center">
          {e ? (
            <p className="font-hud text-sm font-bold uppercase tracking-[0.14em] text-[#19e6ff]">
              <span className="text-[#ff2e9f]">{e.num}</span> {e.dir === "A" ? "Mendatar" : "Menurun"} · {e.length} huruf
            </p>
          ) : (
            <p className="font-hud text-sm font-bold uppercase tracking-[0.14em] text-[#19e6ff]">Pilih soal</p>
          )}
          <p className="text-xs text-white/60">
            {e ? `Soal ${p.index + 1} dari ${p.total} · ` : ""}
            {p.solvedCount}/{p.total} terjawab
          </p>
        </div>
        <button type="button" onClick={p.onNext} aria-label="Soal berikutnya" className={nav}>
          ›
        </button>
      </div>

      {!e ? (
        <p className="mt-4 text-center text-sm text-[#dbe4ff]">Ketuk salah satu kotak putih pada TTS di atas untuk menampilkan soalnya, atau gunakan tombol ‹ ›.</p>
      ) : (
        <>
          <p className="mt-3 text-[15px] leading-relaxed text-[#eef2ff]">{e.clue}</p>
          <label className="relative mt-4 block">
            <span className="sr-only">
              Jawaban {e.num} {e.dir === "A" ? "mendatar" : "menurun"}
            </span>
            <span className="mx-auto grid max-w-[520px] gap-1" style={{ gridTemplateColumns: `repeat(${e.length}, minmax(0, 2.5rem))`, justifyContent: "center" }} aria-hidden>
              {Array.from({ length: e.length }, (_, i) => {
                const typed = p.value[i];
                const lock = p.lockedLetters[i];
                const ch = p.ok ? lock : (typed ?? "");
                const active = !p.ok && !p.done && i === Math.min(p.value.length, e.length - 1);
                return (
                  <span
                    key={i}
                    className={`grid aspect-square place-items-center rounded-md border-2 font-mono text-base font-black sm:text-xl ${
                      p.ok
                        ? "border-green-400 bg-[#86efac] text-[#052e16]"
                        : p.wrong
                          ? "border-red-400 bg-[#eef2f7] text-[#0b1220]"
                          : active
                            ? "border-[#19e6ff] bg-[#eef2f7] text-[#0b1220] shadow-[0_0_10px_rgba(25,230,255,.7)]"
                            : "border-transparent bg-[#eef2f7] text-[#0b1220]"
                    }`}
                  >
                    {ch || (lock ? <span className="text-[#94a3b8]">{lock}</span> : "")}
                  </span>
                );
              })}
            </span>
            <input
              ref={p.inputRef}
              key={e.key}
              value={p.ok ? "" : p.value}
              onChange={(x) => p.onType(x.target.value)}
              disabled={p.ok || p.done}
              maxLength={e.length}
              autoCapitalize="characters"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className="absolute inset-0 h-full w-full cursor-text opacity-0"
              style={{ fontSize: 16 }}
            />
          </label>
          <p className="mt-3 min-h-5 text-center text-sm font-semibold">
            {p.ok ? (
              <span className="text-green-300">✓ Benar — terkunci</span>
            ) : p.checking ? (
              <span className="text-white/60">Mengecek…</span>
            ) : p.wrong ? (
              <span className="text-red-300">Belum tepat, coba lagi</span>
            ) : p.done ? (
              <span className="text-white/60">Permainan sudah selesai</span>
            ) : (
              <span className="text-white/60">Ketik jawaban — otomatis dicek saat semua kotak terisi</span>
            )}
          </p>
        </>
      )}
    </section>
  );
}

function PuzzleGrid({ puzzle, display, selected, onCell }: { puzzle: Puzzle; display: Record<string, { ch: string; locked: boolean }>; selected: Set<string>; solved: Set<string>; onCell: (cell: string) => void }) {
  return (
    <div className="overflow-x-auto rounded-[14px] bg-[#07031a] p-2 shadow-[0_0_28px_rgba(255,46,159,.45),0_0_60px_rgba(157,77,255,.3)]">
      <div className="mx-auto grid w-full min-w-[300px] max-w-[560px] gap-[3px]" style={{ gridTemplateColumns: `repeat(${puzzle.cols}, minmax(0, 1fr))` }}>
        {puzzle.open.flatMap((row, r) =>
          row.map((isOpen, c) => {
            const key = `${r},${c}`;
            if (!isOpen) return <div key={key} className="aspect-square rounded-[3px] bg-[#2b2f36]" aria-hidden />;
            const d = display[key];
            const num = puzzle.numbers[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => onCell(key)}
                aria-label={`Kotak baris ${r + 1} kolom ${c + 1}${d ? `, huruf ${d.ch}` : ""}`}
                className={`relative grid aspect-square place-items-center rounded-[3px] font-mono text-[11px] font-black sm:text-base ${
                  selected.has(key) ? (d?.locked ? "bg-[#4ade80] text-[#052e16] ring-2 ring-[#19e6ff]" : "bg-[#19e6ff] text-[#07031a]") : d?.locked ? "bg-[#86efac] text-[#052e16]" : "bg-[#eef2f7] text-[#0b1220]"
                }`}
              >
                {num && <span className="absolute left-[2px] top-0 text-[7px] font-bold leading-none text-[#334155] sm:text-[9px]">{num}</span>}
                {d?.ch ?? ""}
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
}
