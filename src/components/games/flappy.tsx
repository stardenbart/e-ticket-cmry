"use client";

// Flappy Cow — tema "Sapi Terbang: Neon City": kepala sapi Mooniverse terbang melewati tiang neon,
// awas lightstick yang melayang dari kanan (didahului tanda peringatan). +1 poin tiap tiang terlewati.
import { useEffect, useRef } from "react";
import { ArcadeShell, COW_HEAD, loadImage, setupCanvas, type ArcadeHooks } from "./arcade-shell";
import { CYAN, PINK, VIO, glow, makeScene, roundRect, txt } from "./neon-scene";
import { NeonFrame } from "./neon-frame";

const W = 360;
const H = 560;
const GROUND = 500;
const CX = 95;
const R = 15;
const G = 1500;
const FLAP = -430;
const SPEED = 130;
const GAP = 150;
const PW = 58;
const SPACE = 200;
const SLEN = 54;
const COLS = [PINK, CYAN, VIO];
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export function FlappyGame({ best }: { best: number }) {
  return (
    <ArcadeShell
      game="flappy"
      title="Flappy Cow"
      initialBest={best}
      howTo={
        <ul className="list-disc space-y-1 pl-5">
          <li>Ketuk layar atau tekan spasi untuk membuat sapi terbang naik.</li>
          <li>Lewati celah di antara tiang neon — setiap tiang yang terlewati +1 poin.</li>
          <li>Awas lightstick yang melayang dari kanan (ada tanda peringatan berkedip sebelum muncul).</li>
          <li>Menabrak tiang, lightstick, atau tanah = game over.</li>
        </ul>
      }
    >
      {(hooks) => <FlappyCanvas hooks={hooks} best={best} />}
    </ArcadeShell>
  );
}

type Pipe = { x: number; gap: number; passed: boolean; c: string };
type Stick = { x: number; y0: number; y: number; a: number; amp: number; c: string; st: number };
type Warn = { y: number; t: number; c: string };

function FlappyCanvas({ hooks, best }: { hooks: ArcadeHooks; best: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const hooksRef = useRef(hooks);
  hooksRef.current = hooks;

  useEffect(() => {
    const cv = canvas.current!;
    const ctx = setupCanvas(cv, W, H);
    const scene = makeScene(W, GROUND, true);
    const cowImg = loadImage(COW_HEAD);
    let rec = best;
    let cow = { y: 250, vy: 0 };
    let pipes: Pipe[] = [];
    let sticks: Stick[] = [];
    let warns: Warn[] = [];
    let spawnT = 3.2;
    let score = 0;
    let state: "ready" | "play" | "dead" = "ready";
    let t = 0;
    let scroll = 0;
    let deadAt = 0;
    let raf = 0;
    let last = performance.now();

    const addPipe = (x: number) => pipes.push({ x, gap: 120 + Math.random() * (GROUND - 240 - GAP + 40), passed: false, c: Math.random() < 0.5 ? PINK : CYAN });
    const reset = () => {
      cow = { y: 250, vy: 0 };
      pipes = [];
      sticks = [];
      warns = [];
      spawnT = 3.2;
      score = 0;
      state = "ready";
      t = 0;
      scroll = 0;
      addPipe(W + 60);
      addPipe(W + 60 + SPACE);
    };
    const die = () => {
      if (state !== "play") return;
      state = "dead";
      deadAt = performance.now();
      rec = score; // skor yang dihitung = permainan terakhir
      hooksRef.current.onEnd(score, { pipes: score });
    };
    const flap = () => {
      if (state === "ready") {
        state = "play";
        hooksRef.current.onStart();
      }
      if (state === "play") cow.vy = FLAP;
      else if (state === "dead" && performance.now() - deadAt > 450) reset();
    };

    const rectHit = (x: number, y: number, w: number, h: number) => {
      const nx = Math.max(x, Math.min(CX, x + w));
      const ny = Math.max(y, Math.min(cow.y, y + h));
      const dx = CX - nx;
      const dy = cow.y - ny;
      return dx * dx + dy * dy < R * R;
    };
    const pipeHit = (p: Pipe) => rectHit(p.x, 0, PW, p.gap - GAP / 2) || rectHit(p.x, p.gap + GAP / 2, PW, GROUND - (p.gap + GAP / 2));
    const stickEnds = (s: Stick) => {
      const c = (Math.cos(s.a) * SLEN) / 2;
      const n = (Math.sin(s.a) * SLEN) / 2;
      return [s.x - c, s.y - n, s.x + c, s.y + n];
    };
    const stickHit = (s: Stick) => {
      const e = stickEnds(s);
      const dx = e[2] - e[0];
      const dy = e[3] - e[1];
      const u = Math.max(0, Math.min(1, ((CX - e[0]) * dx + (cow.y - e[1]) * dy) / (dx * dx + dy * dy)));
      const px = e[0] + u * dx - CX;
      const py = e[1] + u * dy - cow.y;
      const r = R * 0.8 + 4;
      return px * px + py * py < r * r;
    };

    const update = (dt: number) => {
      t += dt;
      if (state !== "dead") scroll += SPEED * dt;
      if (state === "ready") {
        cow.y = 250 + Math.sin(t * 4) * 8;
        return;
      }
      cow.vy += G * dt;
      cow.y += cow.vy * dt;
      if (state === "play") {
        for (const p of pipes) {
          p.x -= SPEED * dt;
          if (!p.passed && p.x + PW < CX - R) {
            p.passed = true;
            score++;
          }
          if (pipeHit(p)) die();
        }
        if (pipes[0].x + PW < -10) pipes.shift();
        if (pipes[pipes.length - 1].x < W - SPACE + PW) addPipe(pipes[pipes.length - 1].x + SPACE);
        spawnT -= dt;
        if (spawnT <= 0) {
          warns.push({ y: rnd(90, GROUND - 90), t: 0.9, c: COLS[(Math.random() * 3) | 0] });
          spawnT = Math.max(1.8, rnd(2.6, 4.2) - score * 0.04);
        }
        for (let i = warns.length - 1; i >= 0; i--) {
          warns[i].t -= dt;
          if (warns[i].t <= 0) {
            const w = warns.splice(i, 1)[0];
            sticks.push({ x: W + 50, y0: w.y, y: w.y, a: rnd(0, 3), amp: rnd(14, 32), c: w.c, st: t });
          }
        }
        for (let j = sticks.length - 1; j >= 0; j--) {
          const s = sticks[j];
          s.x -= (SPEED + 110) * dt;
          s.a += dt * 2;
          s.y = s.y0 + Math.sin((t - s.st) * 3) * s.amp;
          if (s.x < -70) sticks.splice(j, 1);
          else if (stickHit(s)) die();
        }
        if (cow.y < R) {
          cow.y = R;
          cow.vy = 0;
        }
        if (cow.y + R >= GROUND) {
          cow.y = GROUND - R;
          die();
        }
      } else if (cow.y + R >= GROUND) {
        cow.y = GROUND - R;
        cow.vy = 0;
      }
    };

    const pylon = (x: number, y: number, w: number, h: number, capBottom: boolean, c: string) => {
      ctx.fillStyle = "#160b3a";
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = "rgba(157,77,255,.35)";
      ctx.lineWidth = 1;
      for (let k = y + (capBottom ? h % 16 : 0); k < y + h; k += 16) {
        ctx.beginPath();
        ctx.moveTo(x, k);
        ctx.lineTo(x + w, k);
        ctx.stroke();
      }
      ctx.strokeStyle = c;
      ctx.lineWidth = 2;
      glow(ctx, c, 10);
      ctx.strokeRect(x, y, w, h);
      const cy = capBottom ? y + h - 20 : y;
      ctx.fillStyle = "#2a1460";
      ctx.fillRect(x - 5, cy, w + 10, 20);
      ctx.strokeRect(x - 5, cy, w + 10, 20);
      ctx.shadowBlur = 0;
    };
    const drawStick = (s: Stick) => {
      const e = stickEnds(s);
      const dx = e[2] - e[0];
      const dy = e[3] - e[1];
      ctx.lineCap = "round";
      ctx.strokeStyle = "#2c2250";
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(e[0], e[1]);
      ctx.lineTo(e[0] + dx * 0.22, e[1] + dy * 0.22);
      ctx.stroke();
      ctx.strokeStyle = s.c;
      glow(ctx, s.c, 16);
      ctx.beginPath();
      ctx.moveTo(e[0] + dx * 0.26, e[1] + dy * 0.26);
      ctx.lineTo(e[2], e[3]);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(e[0] + dx * 0.3, e[1] + dy * 0.3);
      ctx.lineTo(e[2] - dx * 0.04, e[3] - dy * 0.04);
      ctx.stroke();
      ctx.lineCap = "butt";
    };
    const drawCow = (rot: number) => {
      ctx.save();
      ctx.translate(CX, cow.y);
      ctx.rotate(rot);
      glow(ctx, PINK, 12);
      if (cowImg.complete && cowImg.naturalWidth) ctx.drawImage(cowImg, -22, -20, 44, 40);
      else {
        ctx.fillStyle = "#fffdf7";
        ctx.beginPath();
        ctx.arc(0, 0, R, 0, 7);
        ctx.fill();
      }
      ctx.restore();
      ctx.shadowBlur = 0;
    };

    const draw = () => {
      scene.draw(ctx, t, scroll * 0.12, scroll * 0.3, 190, 250, H);
      for (const p of pipes) {
        const top = p.gap - GAP / 2;
        const bot = p.gap + GAP / 2;
        pylon(p.x, -4, PW, top + 4, true, p.c);
        pylon(p.x, bot, PW, GROUND - bot, false, p.c);
      }
      ctx.fillStyle = "#0a0520";
      ctx.fillRect(0, GROUND, W, H - GROUND);
      ctx.strokeStyle = "rgba(25,230,255,.4)";
      ctx.lineWidth = 1;
      for (const d of [8, 20, 36, 56]) {
        ctx.beginPath();
        ctx.moveTo(0, GROUND + d);
        ctx.lineTo(W, GROUND + d);
        ctx.stroke();
      }
      const sh = scroll % 60;
      for (let i = -8; i <= 8; i++) {
        const o = i * 60 - sh;
        ctx.beginPath();
        ctx.moveTo(W / 2 + o * 0.5, GROUND);
        ctx.lineTo(W / 2 + o * 2.2, H);
        ctx.stroke();
      }
      ctx.strokeStyle = PINK;
      ctx.lineWidth = 3;
      glow(ctx, PINK, 14);
      ctx.beginPath();
      ctx.moveTo(0, GROUND);
      ctx.lineTo(W, GROUND);
      ctx.stroke();
      ctx.shadowBlur = 0;
      sticks.forEach(drawStick);
      for (const w of warns) {
        ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 24);
        ctx.fillStyle = w.c;
        glow(ctx, w.c, 12);
        ctx.beginPath();
        ctx.moveTo(W - 6, w.y);
        ctx.lineTo(W - 26, w.y - 12);
        ctx.lineTo(W - 26, w.y + 12);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }
      drawCow(state === "ready" ? 0 : Math.max(-0.45, Math.min(0.9, cow.vy / 700)));
      if (state !== "ready") txt(ctx, String(score), W / 2, 60, 48, "#fff", CYAN);
      if (state === "ready") {
        txt(ctx, "Flappy Cow", W / 2, 140, 42, "#fff", PINK);
        txt(ctx, "Neon City", W / 2, 182, 26, CYAN, CYAN);
        txt(ctx, "Ketuk layar atau tekan spasi", W / 2, 350, 18, "#fff", VIO);
        txt(ctx, "untuk mulai terbang", W / 2, 374, 18, "#fff", VIO);
        txt(ctx, "Awas lightstick dari kanan!", W / 2, 414, 16, PINK, PINK);
        if (rec) txt(ctx, `Skor tercatat: ${rec}`, W / 2, 446, 16, "#fff", CYAN);
      }
      if (state === "dead") {
        ctx.fillStyle = "rgba(10,4,32,.93)";
        ctx.strokeStyle = CYAN;
        ctx.lineWidth = 3;
        glow(ctx, CYAN, 16);
        roundRect(ctx, 60, 170, 240, 190, 16);
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;
        txt(ctx, "Mooo! Game over", W / 2, 210, 26, "#fff", PINK);
        txt(ctx, `Skor: ${score}`, W / 2, 260, 24, "#fff");
        txt(ctx, `Skor tercatat: ${rec}`, W / 2, 295, 20, CYAN, CYAN);
        txt(ctx, "Ketuk untuk main lagi", W / 2, 336, 15, "#fff");
      }
    };

    const loop = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      update(dt);
      draw();
      raf = requestAnimationFrame(loop);
    };

    const onPointer = (e: PointerEvent) => {
      e.preventDefault();
      flap();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        if (!e.repeat) flap();
      }
    };
    cv.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    reset();
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      cv.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <NeonFrame>
      <canvas ref={canvas} aria-label="Game Flappy Cow" className="aspect-[360/560] w-full touch-manipulation" />
    </NeonFrame>
  );
}
