"use client";

// Flappy Cow: kepala sapi Mooniverse terbang melewati celah pipa neon. +1 poin tiap pipa terlewati.
import { useEffect, useRef, useState } from "react";
import { ArcadeShell, COW_HEAD, loadImage, setupCanvas, type ArcadeHooks } from "./arcade-shell";

const W = 360;
const H = 560;
const GRAVITY = 1500; // px/detik²
const FLAP = -460; // px/detik
const PIPE_W = 64;
const GAP = 165;
const GROUND = 40;

export function FlappyGame({ best }: { best: number }) {
  return (
    <ArcadeShell
      game="flappy"
      title="Flappy Cow"
      initialBest={best}
      howTo={
        <ul className="list-disc space-y-1 pl-5">
          <li>Ketuk layar / klik / tekan spasi untuk membuat sapi terbang naik.</li>
          <li>Lewati celah di antara pipa neon. Setiap pipa yang terlewati +1 poin.</li>
          <li>Menabrak pipa, atap, atau tanah = game over. Kejar skor setinggi-tingginya!</li>
        </ul>
      }
    >
      {(hooks) => <FlappyCanvas hooks={hooks} />}
    </ArcadeShell>
  );
}

type Pipe = { x: number; gapY: number; passed: boolean };

function FlappyCanvas({ hooks }: { hooks: ArcadeHooks }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<"ready" | "play" | "over">("ready");
  const [score, setScore] = useState(0);
  const g = useRef({ y: H / 2, vy: 0, pipes: [] as Pipe[], spawn: 0, score: 0, speed: 160, last: 0, raf: 0, running: false, t: 0 });
  const img = useRef<HTMLImageElement | null>(null);

  const draw = () => {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    const s = g.current;
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#020a17");
    bg.addColorStop(1, "#1a0b3a");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    // bintang
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    for (let i = 0; i < 30; i++) ctx.fillRect((i * 97 - s.t * 12) % W < 0 ? ((i * 97 - s.t * 12) % W) + W : (i * 97 - s.t * 12) % W, (i * 53) % (H - 80), 2, 2);
    // pipa
    for (const p of s.pipes) {
      ctx.shadowColor = "#f714f7";
      ctx.shadowBlur = 14;
      ctx.fillStyle = "#3b0a52";
      ctx.strokeStyle = "#f714f7";
      ctx.lineWidth = 3;
      const top = p.gapY - GAP / 2;
      const bot = p.gapY + GAP / 2;
      ctx.fillRect(p.x, 0, PIPE_W, top);
      ctx.strokeRect(p.x, -4, PIPE_W, top + 4);
      ctx.fillRect(p.x, bot, PIPE_W, H - GROUND - bot);
      ctx.strokeRect(p.x, bot, PIPE_W, H - GROUND - bot + 4);
    }
    ctx.shadowBlur = 0;
    // tanah
    ctx.fillStyle = "#031726";
    ctx.fillRect(0, H - GROUND, W, GROUND);
    ctx.strokeStyle = "#9afcff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, H - GROUND);
    ctx.lineTo(W, H - GROUND);
    ctx.stroke();
    // sapi
    const ang = Math.max(-0.5, Math.min(0.9, s.vy / 600));
    ctx.save();
    ctx.translate(90, s.y);
    ctx.rotate(ang);
    if (img.current?.complete) ctx.drawImage(img.current, -24, -22, 48, 44);
    else {
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(0, 0, 20, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // skor
    ctx.fillStyle = "#fff";
    ctx.font = "bold 40px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.shadowColor = "#f714f7";
    ctx.shadowBlur = 12;
    ctx.fillText(String(s.score), W / 2, 70);
    ctx.shadowBlur = 0;
  };

  const loop = (t: number) => {
    const s = g.current;
    if (!s.running) return;
    const dt = Math.min(0.033, (t - (s.last || t)) / 1000);
    s.last = t;
    s.t += dt;
    s.vy += GRAVITY * dt;
    s.y += s.vy * dt;
    s.speed = 160 + Math.min(80, s.score * 2);
    s.spawn -= dt;
    if (s.spawn <= 0) {
      s.pipes.push({ x: W + 10, gapY: 120 + Math.random() * (H - GROUND - 240), passed: false });
      s.spawn = 1.45;
    }
    for (const p of s.pipes) {
      p.x -= s.speed * dt;
      if (!p.passed && p.x + PIPE_W < 90 - 18) {
        p.passed = true;
        s.score++;
        setScore(s.score);
      }
    }
    s.pipes = s.pipes.filter((p) => p.x > -PIPE_W - 10);
    // tabrakan (hitbox lingkaran r=17)
    const r = 17;
    let hit = s.y - r < 0 || s.y + r > H - GROUND;
    for (const p of s.pipes) {
      if (90 + r > p.x && 90 - r < p.x + PIPE_W && (s.y - r < p.gapY - GAP / 2 || s.y + r > p.gapY + GAP / 2)) hit = true;
    }
    draw();
    if (hit) return end();
    s.raf = requestAnimationFrame(loop);
  };

  function start() {
    const s = g.current;
    Object.assign(s, { y: H / 2, vy: FLAP, pipes: [], spawn: 1.0, score: 0, speed: 160, last: 0, running: true, t: 0 });
    setScore(0);
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
    hooks.onEnd(s.score, { pipes: s.score });
  }

  const flap = () => {
    if (g.current.running) g.current.vy = FLAP;
  };

  useEffect(() => {
    img.current = loadImage(COW_HEAD);
    img.current.onload = () => draw();
    if (canvas.current) {
      setupCanvas(canvas.current, W, H);
      draw();
    }
    const key = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "ArrowUp" || e.key === "w") {
        e.preventDefault();
        if (g.current.running) flap();
        else start();
      }
    };
    window.addEventListener("keydown", key);
    const s = g.current;
    return () => {
      window.removeEventListener("keydown", key);
      s.running = false;
      cancelAnimationFrame(s.raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col items-center">
      <p className="sr-only" aria-live="polite">
        Skor {score}
      </p>
      <div className="relative w-full max-w-[360px]">
        <canvas
          ref={canvas}
          className="aspect-[360/560] w-full touch-none rounded-xl border border-[#9afcff]/40 shadow-[0_0_24px_rgba(247,20,247,0.25)]"
          onPointerDown={(e) => {
            e.preventDefault();
            flap();
          }}
        />
        {phase !== "play" && (
          <div className="absolute inset-0 grid place-items-center rounded-xl bg-[#020a17]/60">
            <button
              type="button"
              onClick={start}
              className="font-hud rounded-full bg-[linear-gradient(100deg,#f714f7,#9b2cf5_50%,#05a5ef)] px-7 py-3 text-lg font-bold uppercase tracking-[0.12em] text-white shadow-[0_0_18px_rgba(247,20,247,0.5)]"
            >
              {phase === "ready" ? "Mulai" : "Main lagi"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
