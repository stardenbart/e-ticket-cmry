"use client";

// Ular Retro — tema Neon City. Menembus dinding (muncul di sisi seberang), +10 per makanan,
// bonus +50 tiap 5 makanan; saat bonus muncul satu poin informasi acara / S&K.
import { useEffect, useRef } from "react";
import { ArcadeShell, setupCanvas, type ArcadeHooks } from "./arcade-shell";
import { CYAN, FONT, PINK, VIO, glow, makeScene, roundRect, txt } from "./neon-scene";
import { NeonFrame } from "./neon-frame";

const W = 360;
const H = 560;
const N = 17; // kotak per sisi
const CELL = 20;
const BX = (W - N * CELL) / 2;
const BY = 112;
const BONUS_EVERY = 5;
const BONUS = 50;
const INFO_SEC = 6;

type P = { x: number; y: number };
type Dir = "up" | "down" | "left" | "right";
const DIRS: Record<Dir, P> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };

export function SnakeGame({ best, infos }: { best: number; infos: string[] }) {
  return (
    <ArcadeShell
      game="snake"
      title="Ular Retro"
      initialBest={best}
      howTo={
        <ul className="list-disc space-y-1 pl-5">
          <li>Arahkan ular dengan panah / WASD, geser (swipe) di layar, atau tombol arah di bawah.</li>
          <li>Setiap makanan +10 poin. Tiap {BONUS_EVERY} makanan dapat bonus +{BONUS} sekaligus info seputar acara.</li>
          <li>Menabrak dinding tidak apa-apa — ular muncul di sisi seberang. Game over hanya jika menabrak badannya sendiri.</li>
        </ul>
      }
    >
      {(hooks) => <SnakeCanvas hooks={hooks} infos={infos} best={best} />}
    </ArcadeShell>
  );
}

/** Pecah teks menjadi baris yang muat di lebar tertentu. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function SnakeCanvas({ hooks, infos, best }: { hooks: ArcadeHooks; infos: string[]; best: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const hooksRef = useRef(hooks);
  hooksRef.current = hooks;
  const turnRef = useRef<(d: Dir) => void>(() => {});

  useEffect(() => {
    const cv = canvas.current!;
    const ctx = setupCanvas(cv, W, H);
    const scene = makeScene(W, 100, false);
    let rec = best;
    let snake: P[] = [];
    let dir = DIRS.right;
    let next = DIRS.right;
    let food: P = { x: 0, y: 0 };
    let eaten = 0;
    let score = 0;
    let stepMs = 150;
    let acc = 0;
    let state: "ready" | "play" | "dead" = "ready";
    let deadAt = 0;
    let t = 0;
    let info: { text: string; until: number; n: number } | null = null;
    let flash = 0;
    let raf = 0;
    let last = performance.now();

    const placeFood = () => {
      let f: P;
      do f = { x: (Math.random() * N) | 0, y: (Math.random() * N) | 0 };
      while (snake.some((p) => p.x === f.x && p.y === f.y));
      food = f;
    };
    const reset = () => {
      const m = (N / 2) | 0;
      snake = [{ x: m, y: m }, { x: m - 1, y: m }, { x: m - 2, y: m }];
      dir = next = DIRS.right;
      eaten = score = 0;
      stepMs = 150;
      acc = 0;
      info = null;
      state = "ready";
      placeFood();
    };
    const begin = () => {
      if (state === "ready") {
        state = "play";
        hooksRef.current.onStart();
      } else if (state === "dead" && performance.now() - deadAt > 450) reset();
    };
    const die = () => {
      state = "dead";
      deadAt = performance.now();
      if (score > rec) rec = score;
      hooksRef.current.onEnd(score, { foods: eaten, length: snake.length });
    };
    turnRef.current = (d: Dir) => {
      if (state !== "play") return begin();
      const nd = DIRS[d];
      if (dir.x + nd.x === 0 && dir.y + nd.y === 0) return; // tidak boleh berbalik 180°
      next = nd;
    };

    const step = () => {
      dir = next;
      const head = snake[0];
      const nh = { x: (head.x + dir.x + N) % N, y: (head.y + dir.y + N) % N };
      if (snake.slice(0, -1).some((p) => p.x === nh.x && p.y === nh.y)) return die();
      snake.unshift(nh);
      if (nh.x === food.x && nh.y === food.y) {
        eaten++;
        score += 10;
        flash = 0.25;
        if (eaten % BONUS_EVERY === 0) {
          score += BONUS;
          const n = eaten / BONUS_EVERY;
          if (infos.length) info = { text: infos[(n - 1) % infos.length], until: t + INFO_SEC, n };
        }
        stepMs = Math.max(75, stepMs - 3);
        placeFood();
      } else snake.pop();
    };

    const update = (dt: number) => {
      t += dt;
      flash = Math.max(0, flash - dt);
      if (state !== "play") return;
      acc += dt * 1000;
      while (acc >= stepMs && state === "play") {
        acc -= stepMs;
        step();
      }
    };

    const draw = () => {
      scene.draw(ctx, t, t * 6, t * 14, 210, -30, H);
      ctx.fillStyle = "#07031a";
      ctx.fillRect(0, 100, W, H - 100);
      ctx.strokeStyle = PINK;
      ctx.lineWidth = 3;
      glow(ctx, PINK, 14);
      ctx.beginPath();
      ctx.moveTo(0, 100);
      ctx.lineTo(W, 100);
      ctx.stroke();
      ctx.shadowBlur = 0;
      // papan
      ctx.fillStyle = "#0f0730";
      ctx.fillRect(BX, BY, N * CELL, N * CELL);
      ctx.strokeStyle = "rgba(157,77,255,.18)";
      ctx.lineWidth = 1;
      for (let i = 1; i < N; i++) {
        ctx.beginPath();
        ctx.moveTo(BX + i * CELL, BY);
        ctx.lineTo(BX + i * CELL, BY + N * CELL);
        ctx.moveTo(BX, BY + i * CELL);
        ctx.lineTo(BX + N * CELL, BY + i * CELL);
        ctx.stroke();
      }
      ctx.strokeStyle = CYAN;
      ctx.lineWidth = 2;
      glow(ctx, CYAN, 12);
      ctx.strokeRect(BX, BY, N * CELL, N * CELL);
      // makanan: botol susu
      const fx = BX + food.x * CELL + CELL / 2;
      const fy = BY + food.y * CELL + CELL / 2 + Math.sin(t * 6) * 1.5;
      ctx.fillStyle = "#fffdf7";
      ctx.strokeStyle = PINK;
      glow(ctx, PINK, 14);
      roundRect(ctx, fx - 5, fy - 7, 10, 14, 3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = PINK;
      ctx.fillRect(fx - 3.5, fy - 10, 7, 3);
      // ular
      snake.forEach((p, i) => {
        const c = i === 0 ? "#ffffff" : i % 2 ? CYAN : VIO;
        ctx.fillStyle = c;
        glow(ctx, i === 0 ? PINK : c, i === 0 ? 16 : 8);
        roundRect(ctx, BX + p.x * CELL + 2, BY + p.y * CELL + 2, CELL - 4, CELL - 4, 4);
        ctx.fill();
      });
      ctx.shadowBlur = 0;
      if (flash > 0) {
        ctx.globalAlpha = flash * 2;
        txt(ctx, "+10", fx, fy - 18, 14, CYAN, CYAN);
        ctx.globalAlpha = 1;
      }
      // HUD
      txt(ctx, String(score), W / 2, 44, 40, "#fff", CYAN);
      txt(ctx, `Makanan: ${eaten}`, 62, 18, 13, "#fff", PINK);
      // info bonus (hanya saat dapat bonus)
      if (info && t < info.until) {
        const a = Math.min(1, (info.until - t) * 2, (t - (info.until - INFO_SEC)) * 4);
        ctx.globalAlpha = Math.max(0, a);
        ctx.fillStyle = "rgba(10,4,32,.95)";
        ctx.strokeStyle = PINK;
        ctx.lineWidth = 2;
        glow(ctx, PINK, 12);
        roundRect(ctx, 10, 466, W - 20, 86, 12);
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;
        txt(ctx, `Bonus +${BONUS}!`, W / 2, 482, 15, PINK, PINK);
        ctx.font = `bold 12px ${FONT}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#fff";
        wrap(ctx, info.text, W - 44)
          .slice(0, 4)
          .forEach((ln, i) => ctx.fillText(ln, W / 2, 502 + i * 15));
        ctx.globalAlpha = 1;
      }
      if (state === "ready") {
        ctx.fillStyle = "rgba(10,4,32,.72)";
        ctx.fillRect(BX, BY, N * CELL, N * CELL);
        txt(ctx, "Ular Retro", W / 2, 200, 40, "#fff", PINK);
        txt(ctx, "Neon City", W / 2, 238, 24, CYAN, CYAN);
        txt(ctx, "Geser layar atau tekan panah", W / 2, 300, 16, "#fff", VIO);
        txt(ctx, "Tembus dinding, jangan gigit ekor!", W / 2, 324, 14, CYAN, CYAN);
        txt(ctx, "Ketuk untuk mulai", W / 2, 380, 20, PINK, PINK);
        if (rec) txt(ctx, `Rekor: ${rec}`, W / 2, 412, 16, "#fff", CYAN);
      }
      if (state === "dead") {
        ctx.fillStyle = "rgba(10,4,32,.93)";
        ctx.strokeStyle = CYAN;
        ctx.lineWidth = 3;
        glow(ctx, CYAN, 16);
        roundRect(ctx, 60, 190, 240, 190, 16);
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;
        txt(ctx, "Mooo! Game over", W / 2, 228, 26, "#fff", PINK);
        txt(ctx, `Skor: ${score}`, W / 2, 274, 24, "#fff");
        txt(ctx, `${eaten} botol susu`, W / 2, 304, 15, CYAN, CYAN);
        txt(ctx, `Rekor: ${rec}`, W / 2, 332, 20, CYAN, CYAN);
        txt(ctx, "Ketuk untuk main lagi", W / 2, 362, 15, "#fff");
      }
    };

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      update(dt);
      draw();
      raf = requestAnimationFrame(loop);
    };

    let touch: { x: number; y: number } | null = null;
    const onDown = (e: PointerEvent) => {
      e.preventDefault();
      touch = { x: e.clientX, y: e.clientY };
      if (state !== "play") begin();
    };
    const onUp = (e: PointerEvent) => {
      if (!touch || state !== "play") return;
      const dx = e.clientX - touch.x;
      const dy = e.clientY - touch.y;
      touch = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
      turnRef.current(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
    };
    const onKey = (e: KeyboardEvent) => {
      const m: Record<string, Dir> = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", KeyW: "up", KeyS: "down", KeyA: "left", KeyD: "right" };
      const d = m[e.code];
      if (d) {
        e.preventDefault();
        if (state === "play") turnRef.current(d);
      } else if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        if (!e.repeat) begin();
      }
    };
    cv.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("keydown", onKey);
    reset();
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      cv.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <NeonFrame>
        <canvas ref={canvas} aria-label="Game Ular Retro" className="aspect-[360/560] w-full touch-none" />
      </NeonFrame>
      <div className="mx-auto mt-4 grid w-max grid-cols-3 gap-2 sm:hidden" aria-label="Tombol arah">
        <span />
        <PadBtn label="Atas" onPress={() => turnRef.current("up")}>▲</PadBtn>
        <span />
        <PadBtn label="Kiri" onPress={() => turnRef.current("left")}>◀</PadBtn>
        <PadBtn label="Bawah" onPress={() => turnRef.current("down")}>▼</PadBtn>
        <PadBtn label="Kanan" onPress={() => turnRef.current("right")}>▶</PadBtn>
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
      className="grid size-14 place-items-center rounded-xl border border-[#ff2e9f]/50 bg-[#07031a] text-xl text-[#19e6ff] shadow-[0_0_14px_rgba(255,46,159,.35)] active:bg-[#9d4dff]/30"
    >
      {children}
    </button>
  );
}
