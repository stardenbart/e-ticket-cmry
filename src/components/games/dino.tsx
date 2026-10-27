"use client";

// Dino Cow: lari ala dino Google, tapi pemainnya sapi Mooniverse. Lompati jerami & krat susu.
// Skor bertambah seiring jarak; kecepatan naik perlahan.
import { useEffect, useRef, useState } from "react";
import { ArcadeShell, COW_HEAD, loadImage, setupCanvas, type ArcadeHooks } from "./arcade-shell";

const W = 640;
const H = 220;
const GROUND_Y = 186;
const COW_X = 64;
const COW = 46;
const GRAVITY = 2300;
const JUMP = -760;

export function DinoGame({ best }: { best: number }) {
  return (
    <ArcadeShell
      game="dino"
      title="Dino Cow"
      initialBest={best}
      howTo={
        <ul className="list-disc space-y-1 pl-5">
          <li>Ketuk layar / klik / tekan spasi atau panah atas untuk melompat.</li>
          <li>Lompati jerami dan krat susu. Skor bertambah selama sapi terus berlari.</li>
          <li>Makin lama makin cepat — menabrak rintangan = game over.</li>
        </ul>
      }
    >
      {(hooks) => <DinoCanvas hooks={hooks} />}
    </ArcadeShell>
  );
}

type Ob = { x: number; w: number; h: number; kind: "hay" | "crate" };

function DinoCanvas({ hooks }: { hooks: ArcadeHooks }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<"ready" | "play" | "over">("ready");
  const [score, setScore] = useState(0);
  const g = useRef({ y: GROUND_Y - COW, vy: 0, obs: [] as Ob[], spawn: 1, dist: 0, speed: 330, last: 0, raf: 0, running: false, t: 0, shown: 0 });
  const img = useRef<HTMLImageElement | null>(null);

  const scoreOf = (dist: number) => Math.floor(dist / 40);

  const draw = () => {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    const s = g.current;
    ctx.fillStyle = "#020a17";
    ctx.fillRect(0, 0, W, H);
    // gedung neon di latar
    ctx.fillStyle = "rgba(154,252,255,0.07)";
    for (let i = 0; i < 12; i++) {
      const x = ((i * 90 - s.dist * 0.2) % (W + 90) + W + 90) % (W + 90) - 90;
      ctx.fillRect(x, 70 + ((i * 37) % 60), 60, GROUND_Y - 70 - ((i * 37) % 60));
    }
    // tanah
    ctx.strokeStyle = "#9afcff";
    ctx.lineWidth = 2;
    ctx.shadowColor = "#9afcff";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y + 0.5);
    ctx.lineTo(W, GROUND_Y + 0.5);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(154,252,255,0.35)";
    for (let i = 0; i < 20; i++) ctx.fillRect(((i * 47 - s.dist) % W + W) % W, GROUND_Y + 8 + (i % 3) * 6, 10, 2);
    // rintangan
    for (const o of s.obs) {
      ctx.shadowBlur = 12;
      if (o.kind === "hay") {
        ctx.shadowColor = "#facc15";
        ctx.fillStyle = "#a16207";
        ctx.strokeStyle = "#facc15";
      } else {
        ctx.shadowColor = "#f714f7";
        ctx.fillStyle = "#3b0a52";
        ctx.strokeStyle = "#f714f7";
      }
      ctx.lineWidth = 2;
      ctx.fillRect(o.x, GROUND_Y - o.h, o.w, o.h);
      ctx.strokeRect(o.x, GROUND_Y - o.h, o.w, o.h);
      ctx.shadowBlur = 0;
      ctx.beginPath();
      if (o.kind === "hay") {
        ctx.moveTo(o.x, GROUND_Y - o.h / 2);
        ctx.lineTo(o.x + o.w, GROUND_Y - o.h / 2);
      } else {
        ctx.moveTo(o.x + o.w / 2, GROUND_Y - o.h);
        ctx.lineTo(o.x + o.w / 2, GROUND_Y);
      }
      ctx.stroke();
    }
    // sapi (sedikit memantul saat berlari)
    const bob = s.y >= GROUND_Y - COW - 0.5 && s.running ? Math.sin(s.t * 22) * 2 : 0;
    if (img.current?.complete) ctx.drawImage(img.current, COW_X, s.y + bob, COW, COW * 0.92);
    else {
      ctx.fillStyle = "#fff";
      ctx.fillRect(COW_X, s.y, COW, COW);
    }
    // skor
    ctx.fillStyle = "#fff";
    ctx.font = "bold 18px ui-monospace, monospace";
    ctx.textAlign = "right";
    ctx.fillText(String(scoreOf(s.dist)).padStart(5, "0"), W - 14, 28);
  };

  const loop = (t: number) => {
    const s = g.current;
    if (!s.running) return;
    const dt = Math.min(0.033, (t - (s.last || t)) / 1000);
    s.last = t;
    s.t += dt;
    s.speed = Math.min(720, 330 + s.t * 9);
    s.dist += s.speed * dt;
    s.vy += GRAVITY * dt;
    s.y = Math.min(GROUND_Y - COW, s.y + s.vy * dt);
    if (s.y >= GROUND_Y - COW) s.vy = 0;
    s.spawn -= dt;
    if (s.spawn <= 0) {
      const crate = Math.random() < 0.4;
      s.obs.push({ x: W + 10, w: crate ? 26 : 22 + Math.random() * 20, h: crate ? 44 + Math.random() * 14 : 26 + Math.random() * 18, kind: crate ? "crate" : "hay" });
      s.spawn = (0.75 + Math.random() * 0.9) * (330 / s.speed) + 0.35;
    }
    for (const o of s.obs) o.x -= s.speed * dt;
    s.obs = s.obs.filter((o) => o.x + o.w > -10);
    // tabrakan dengan hitbox sedikit lebih kecil dari gambar (lebih adil)
    const cx1 = COW_X + 8;
    const cx2 = COW_X + COW - 8;
    const cy2 = s.y + COW - 6;
    const hit = s.obs.some((o) => cx2 > o.x && cx1 < o.x + o.w && cy2 > GROUND_Y - o.h);
    const sc = scoreOf(s.dist);
    if (sc !== s.shown) {
      s.shown = sc;
      setScore(sc);
    }
    draw();
    if (hit) return end();
    s.raf = requestAnimationFrame(loop);
  };

  function start() {
    const s = g.current;
    Object.assign(s, { y: GROUND_Y - COW, vy: 0, obs: [], spawn: 1.1, dist: 0, speed: 330, last: 0, running: true, t: 0, shown: 0 });
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
    hooks.onEnd(scoreOf(s.dist), { seconds: Math.round(s.t) });
  }

  const jump = () => {
    const s = g.current;
    if (s.running && s.y >= GROUND_Y - COW - 0.5) s.vy = JUMP;
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
        if (g.current.running) jump();
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
      <div className="relative w-full">
        <canvas
          ref={canvas}
          className="aspect-[640/220] w-full touch-none rounded-xl border border-[#9afcff]/40 shadow-[0_0_24px_rgba(154,252,255,0.2)]"
          onPointerDown={(e) => {
            e.preventDefault();
            jump();
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
      <p className="mt-2 text-xs text-[#cbd5e1] sm:hidden">Ketuk area permainan untuk melompat.</p>
    </div>
  );
}
