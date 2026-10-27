"use client";

// Dino Cow — tema Neon City: sapi berlari ala dino Google, melompati penghalang neon.
// Skor bertambah seiring jarak; kecepatan naik perlahan.
import { useEffect, useRef } from "react";
import { ArcadeShell, COW_HEAD, loadImage, setupCanvas, type ArcadeHooks } from "./arcade-shell";
import { CYAN, PINK, VIO, glow, makeScene, roundRect, txt } from "./neon-scene";
import { NeonFrame } from "./neon-frame";

const W = 640;
const H = 300;
const GROUND = 236;
const COW_X = 70;
const COW = 50;
const GRAVITY = 2300;
const JUMP = -780;

export function DinoGame({ best }: { best: number }) {
  return (
    <ArcadeShell
      game="dino"
      title="Dino Cow"
      initialBest={best}
      howTo={
        <ul className="list-disc space-y-1 pl-5">
          <li>Ketuk layar atau tekan spasi / panah atas untuk melompat.</li>
          <li>Lompati penghalang neon. Skor bertambah selama sapi terus berlari.</li>
          <li>Makin lama makin cepat — menabrak penghalang = game over.</li>
        </ul>
      }
    >
      {(hooks) => <DinoCanvas hooks={hooks} best={best} />}
    </ArcadeShell>
  );
}

type Ob = { x: number; w: number; h: number; c: string; tall: boolean };

function DinoCanvas({ hooks, best }: { hooks: ArcadeHooks; best: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const hooksRef = useRef(hooks);
  hooksRef.current = hooks;

  useEffect(() => {
    const cv = canvas.current!;
    const ctx = setupCanvas(cv, W, H);
    const scene = makeScene(W, GROUND, false);
    const cowImg = loadImage(COW_HEAD);
    let rec = best;
    let y = GROUND - COW;
    let vy = 0;
    let obs: Ob[] = [];
    let spawn = 1.1;
    let dist = 0;
    let speed = 330;
    let t = 0;
    let state: "ready" | "play" | "dead" = "ready";
    let deadAt = 0;
    let raf = 0;
    let last = performance.now();
    const score = () => Math.floor(dist / 40);

    const reset = () => {
      y = GROUND - COW;
      vy = 0;
      obs = [];
      spawn = 1.1;
      dist = 0;
      speed = 330;
      state = "ready";
    };
    const die = () => {
      state = "dead";
      deadAt = performance.now();
      const s = score();
      if (s > rec) rec = s;
      hooksRef.current.onEnd(s, { seconds: Math.round(t) });
    };
    const act = () => {
      if (state === "ready") {
        state = "play";
        t = 0;
        hooksRef.current.onStart();
      }
      if (state === "play") {
        if (y >= GROUND - COW - 0.5) vy = JUMP;
      } else if (state === "dead" && performance.now() - deadAt > 450) reset();
    };

    const update = (dt: number) => {
      t += dt;
      if (state !== "play") {
        if (state === "ready") dist += 120 * dt;
        return;
      }
      speed = Math.min(720, 330 + t * 9);
      dist += speed * dt;
      vy += GRAVITY * dt;
      y = Math.min(GROUND - COW, y + vy * dt);
      if (y >= GROUND - COW) vy = 0;
      spawn -= dt;
      if (spawn <= 0) {
        const tall = Math.random() < 0.4;
        obs.push({ x: W + 10, w: tall ? 26 : 24 + Math.random() * 22, h: tall ? 48 + Math.random() * 14 : 26 + Math.random() * 18, c: Math.random() < 0.5 ? PINK : CYAN, tall });
        spawn = (0.75 + Math.random() * 0.9) * (330 / speed) + 0.35;
      }
      for (const o of obs) o.x -= speed * dt;
      obs = obs.filter((o) => o.x + o.w > -10);
      const cx1 = COW_X + 9;
      const cx2 = COW_X + COW - 9;
      const cy2 = y + COW - 7;
      if (obs.some((o) => cx2 > o.x && cx1 < o.x + o.w && cy2 > GROUND - o.h)) die();
    };

    const draw = () => {
      scene.draw(ctx, t, dist * 0.12, dist * 0.3, 400, 30, H);
      // tanah: grid perspektif synthwave
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
      const sh = dist % 60;
      for (let i = -12; i <= 12; i++) {
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
      // penghalang neon (gaya Balap Sapi)
      for (const o of obs) {
        ctx.fillStyle = "#1a0b3f";
        ctx.strokeStyle = o.c;
        ctx.lineWidth = 2.5;
        glow(ctx, o.c, 12);
        ctx.fillRect(o.x, GROUND - o.h, o.w, o.h);
        ctx.strokeRect(o.x, GROUND - o.h, o.w, o.h);
        ctx.beginPath();
        ctx.moveTo(o.x, GROUND - o.h * 0.6);
        ctx.lineTo(o.x + o.w, GROUND - o.h * 0.6);
        ctx.moveTo(o.x, GROUND - o.h * 0.3);
        ctx.lineTo(o.x + o.w, GROUND - o.h * 0.3);
        ctx.stroke();
        ctx.fillStyle = o.c;
        ctx.beginPath();
        ctx.arc(o.x + o.w / 2, GROUND - o.h - 5, 4, 0, 7);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      // sapi
      const bob = state !== "dead" && y >= GROUND - COW - 0.5 ? Math.sin(t * 20) * 2 : 0;
      ctx.fillStyle = "rgba(0,0,0,.45)";
      ctx.beginPath();
      ctx.ellipse(COW_X + COW / 2, GROUND + 4, 24, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      glow(ctx, PINK, 12);
      if (cowImg.complete && cowImg.naturalWidth) ctx.drawImage(cowImg, COW_X, y + bob, COW, COW * 0.92);
      ctx.shadowBlur = 0;
      if (state !== "ready") txt(ctx, String(score()), W / 2, 40, 40, "#fff", CYAN);
      if (state === "ready") {
        txt(ctx, "Dino Cow", W / 2, 70, 40, "#fff", PINK);
        txt(ctx, "Neon City", W / 2, 106, 22, CYAN, CYAN);
        txt(ctx, "Ketuk layar atau tekan spasi untuk melompat", W / 2, 148, 16, "#fff", VIO);
        txt(ctx, "Ketuk untuk mulai", W / 2, 182, 20, PINK, PINK);
        if (rec) txt(ctx, `Rekor: ${rec}`, W / 2, 210, 15, "#fff", CYAN);
      }
      if (state === "dead") {
        ctx.fillStyle = "rgba(10,4,32,.93)";
        ctx.strokeStyle = CYAN;
        ctx.lineWidth = 3;
        glow(ctx, CYAN, 16);
        roundRect(ctx, W / 2 - 140, 40, 280, 170, 16);
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;
        txt(ctx, "Mooo! Game over", W / 2, 76, 26, "#fff", PINK);
        txt(ctx, `Skor: ${score()}`, W / 2, 118, 24, "#fff");
        txt(ctx, `Rekor: ${rec}`, W / 2, 152, 20, CYAN, CYAN);
        txt(ctx, "Ketuk untuk main lagi", W / 2, 186, 15, "#fff");
      }
    };

    const loop = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      update(dt);
      draw();
      raf = requestAnimationFrame(loop);
    };
    const onDown = (e: PointerEvent) => {
      e.preventDefault();
      act();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
        e.preventDefault();
        if (!e.repeat) act();
      }
    };
    cv.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    reset();
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      cv.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <NeonFrame wide>
      <canvas ref={canvas} aria-label="Game Dino Cow" className="aspect-[640/300] w-full touch-manipulation" />
    </NeonFrame>
  );
}
