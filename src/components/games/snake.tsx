"use client";

// Ular retro: menembus dinding (muncul di sisi seberang), +10 per makanan, bonus +50 tiap 5 makanan.
// Setiap makanan memunculkan satu poin informasi acara / S&K.
import { useEffect, useRef, useState } from "react";
import { ArcadeShell, setupCanvas, type ArcadeHooks } from "./arcade-shell";

const N = 20; // kotak per sisi
const BONUS_EVERY = 5;
const BONUS = 50;

type P = { x: number; y: number };
const DIRS: Record<string, P> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };

export function SnakeGame({ best, infos }: { best: number; infos: string[] }) {
  return (
    <ArcadeShell
      game="snake"
      title="Ular Retro"
      initialBest={best}
      howTo={
        <ul className="list-disc space-y-1 pl-5">
          <li>Arahkan ular dengan tombol panah / WASD, geser (swipe) di layar, atau tombol arah di bawah.</li>
          <li>Setiap makanan +10 poin dan memunculkan satu info acara. Tiap {BONUS_EVERY} makanan dapat bonus +{BONUS}.</li>
          <li>Menabrak dinding tidak apa-apa — ular muncul di sisi seberang. Game over hanya jika menabrak badannya sendiri.</li>
        </ul>
      }
    >
      {(hooks) => <SnakeCanvas hooks={hooks} infos={infos} />}
    </ArcadeShell>
  );
}

function SnakeCanvas({ hooks, infos }: { hooks: ArcadeHooks; infos: string[] }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<"ready" | "play" | "over">("ready");
  const [score, setScore] = useState(0);
  const [info, setInfo] = useState<{ text: string; bonus: boolean; n: number } | null>(null);
  const g = useRef({ snake: [] as P[], dir: DIRS.right, next: DIRS.right, food: { x: 0, y: 0 }, eaten: 0, score: 0, stepMs: 140, acc: 0, last: 0, size: 300, raf: 0, running: false });

  const placeFood = () => {
    const s = g.current;
    let f: P;
    do f = { x: Math.floor(Math.random() * N), y: Math.floor(Math.random() * N) };
    while (s.snake.some((p) => p.x === f.x && p.y === f.y));
    s.food = f;
  };

  const draw = () => {
    const c = canvas.current;
    if (!c) return;
    const s = g.current;
    const ctx = c.getContext("2d")!;
    const cell = s.size / N;
    ctx.fillStyle = "#020a17";
    ctx.fillRect(0, 0, s.size, s.size);
    ctx.strokeStyle = "rgba(154,252,255,0.06)";
    for (let i = 1; i < N; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cell, 0);
      ctx.lineTo(i * cell, s.size);
      ctx.moveTo(0, i * cell);
      ctx.lineTo(s.size, i * cell);
      ctx.stroke();
    }
    // makanan
    ctx.shadowColor = "#f714f7";
    ctx.shadowBlur = 14;
    ctx.fillStyle = "#f714f7";
    ctx.beginPath();
    ctx.arc((s.food.x + 0.5) * cell, (s.food.y + 0.5) * cell, cell * 0.36, 0, Math.PI * 2);
    ctx.fill();
    // ular
    ctx.shadowColor = "#9afcff";
    s.snake.forEach((p, i) => {
      ctx.shadowBlur = i === 0 ? 16 : 6;
      ctx.fillStyle = i === 0 ? "#ffffff" : i % 2 ? "#9afcff" : "#5ee7f0";
      const pad = i === 0 ? 1 : 2;
      ctx.fillRect(p.x * cell + pad, p.y * cell + pad, cell - pad * 2, cell - pad * 2);
    });
    ctx.shadowBlur = 0;
  };

  const step = () => {
    const s = g.current;
    s.dir = s.next;
    const head = s.snake[0];
    const nh = { x: (head.x + s.dir.x + N) % N, y: (head.y + s.dir.y + N) % N };
    // Menabrak badan sendiri (ekor yang akan bergeser tidak dihitung).
    if (s.snake.slice(0, -1).some((p) => p.x === nh.x && p.y === nh.y)) return end();
    s.snake.unshift(nh);
    if (nh.x === s.food.x && nh.y === s.food.y) {
      s.eaten++;
      s.score += 10;
      const bonus = s.eaten % BONUS_EVERY === 0;
      if (bonus) s.score += BONUS;
      s.stepMs = Math.max(70, s.stepMs - 3);
      setScore(s.score);
      if (infos.length) setInfo({ text: infos[(s.eaten - 1) % infos.length], bonus, n: s.eaten });
      placeFood();
    } else {
      s.snake.pop();
    }
  };

  const loop = (t: number) => {
    const s = g.current;
    if (!s.running) return;
    if (!s.last) s.last = t;
    s.acc += t - s.last;
    s.last = t;
    while (s.acc >= s.stepMs && s.running) {
      s.acc -= s.stepMs;
      step();
    }
    draw();
    s.raf = requestAnimationFrame(loop);
  };

  function start() {
    const s = g.current;
    const mid = Math.floor(N / 2);
    Object.assign(s, { snake: [{ x: mid, y: mid }, { x: mid - 1, y: mid }, { x: mid - 2, y: mid }], dir: DIRS.right, next: DIRS.right, eaten: 0, score: 0, stepMs: 140, acc: 0, last: 0, running: true });
    placeFood();
    setScore(0);
    setInfo(null);
    setPhase("play");
    hooks.onStart();
    s.raf = requestAnimationFrame(loop);
  }

  function end() {
    const s = g.current;
    if (!s.running) return;
    s.running = false;
    cancelAnimationFrame(s.raf);
    setPhase("over");
    hooks.onEnd(s.score, { foods: s.eaten, length: s.snake.length });
  }

  const turn = (d: keyof typeof DIRS) => {
    const s = g.current;
    const nd = DIRS[d];
    // Tidak boleh berbalik arah 180°.
    if (s.dir.x + nd.x === 0 && s.dir.y + nd.y === 0) return;
    s.next = nd;
  };

  useEffect(() => {
    const resize = () => {
      const w = Math.min(wrap.current?.clientWidth ?? 320, 480);
      g.current.size = Math.floor(w / N) * N;
      if (canvas.current) {
        setupCanvas(canvas.current, g.current.size, g.current.size);
        canvas.current.style.width = canvas.current.style.height = `${g.current.size}px`;
      }
      draw();
    };
    resize();
    window.addEventListener("resize", resize);
    const key = (e: KeyboardEvent) => {
      const m: Record<string, keyof typeof DIRS> = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", w: "up", s: "down", a: "left", d: "right" };
      const d = m[e.key];
      if (d && g.current.running) {
        e.preventDefault();
        turn(d);
      } else if ((e.key === " " || e.key === "Enter") && !g.current.running) {
        e.preventDefault();
        start();
      }
    };
    window.addEventListener("keydown", key);
    const s = g.current;
    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", key);
      s.running = false;
      cancelAnimationFrame(s.raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Geser (swipe) di canvas
  const touch = useRef<{ x: number; y: number } | null>(null);

  return (
    <div ref={wrap} className="flex flex-col items-center">
      <div className="mb-2 flex w-full items-center justify-between text-white">
        <p className="font-hud text-sm font-bold uppercase tracking-[0.14em] text-[#9afcff]">Skor</p>
        <p className="font-digits text-2xl font-black tabular-nums">{score}</p>
      </div>
      <div className="relative">
        <canvas
          ref={canvas}
          className="touch-none rounded-xl border border-[#9afcff]/40 shadow-[0_0_24px_rgba(154,252,255,0.2)]"
          onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
          onTouchEnd={(e) => {
            const t0 = touch.current;
            if (!t0) return;
            const dx = e.changedTouches[0].clientX - t0.x;
            const dy = e.changedTouches[0].clientY - t0.y;
            if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
            turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
          }}
        />
        {phase !== "play" && (
          <div className="absolute inset-0 grid place-items-center rounded-xl bg-[#020a17]/70">
            <button
              type="button"
              onClick={start}
              className="font-hud rounded-full bg-[linear-gradient(100deg,#f714f7,#9b2cf5_50%,#05a5ef)] px-7 py-3 text-lg font-bold uppercase tracking-[0.12em] text-white shadow-[0_0_18px_rgba(247,20,247,0.5)]"
            >
              {phase === "ready" ? "Mulai" : "Main lagi"}
            </button>
          </div>
        )}
        {info && phase === "play" && (
          <div key={info.n} className="pointer-events-none absolute inset-x-2 bottom-2 animate-fade-up rounded-lg border border-[#f714f7]/50 bg-[#031726]/95 px-3 py-2 text-xs text-white shadow-lg sm:text-sm">
            {info.bonus && <p className="font-hud font-bold uppercase tracking-wider text-[#f714f7]">Bonus +{BONUS}! 🎉</p>}
            <p>
              <span className="font-bold text-[#9afcff]">Info:</span> {info.text}
            </p>
          </div>
        )}
      </div>
      {info && phase === "over" && (
        <p className="mt-3 w-full rounded-lg border border-white/10 bg-[#031726]/80 px-3 py-2 text-sm text-[#dbe4ff]">
          <span className="font-bold text-[#9afcff]">Info terakhir:</span> {info.text}
        </p>
      )}
      {/* Tombol arah untuk layar sentuh */}
      <div className="mt-4 grid grid-cols-3 gap-2 sm:hidden" aria-label="Tombol arah">
        <span />
        <PadBtn label="Atas" onPress={() => turn("up")}>▲</PadBtn>
        <span />
        <PadBtn label="Kiri" onPress={() => turn("left")}>◀</PadBtn>
        <PadBtn label="Bawah" onPress={() => turn("down")}>▼</PadBtn>
        <PadBtn label="Kanan" onPress={() => turn("right")}>▶</PadBtn>
      </div>
    </div>
  );
}

function PadBtn({ label, onPress, children }: { label: string; onPress: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={(e) => {
        e.preventDefault();
        onPress();
      }}
      className="grid size-14 place-items-center rounded-xl border border-[#9afcff]/40 bg-[#031726] text-xl text-[#9afcff] active:bg-[#9afcff]/20"
    >
      {children}
    </button>
  );
}
