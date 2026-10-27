"use client";

// Balap Sapi Neon: sapi berlari di jalan neon 3 jalur menuju kota. Pindah jalur untuk menghindari
// penghalang dan mengambil botol susu. Skor = jarak + 10 per botol susu.
import { useEffect, useRef } from "react";
import { ArcadeShell, COW_HEAD, loadImage, setupCanvas, type ArcadeHooks } from "./arcade-shell";
import { CYAN, PINK, VIO, glow, makeScene, roundRect, txt } from "./neon-scene";
import { NeonFrame } from "./neon-frame";

const W = 360;
const H = 560;
const HZ = 230; // cakrawala
const YP = 470; // posisi sapi
const LW = 110; // lebar jalur
const ZP = 4; // kedalaman sapi
const ZFAR = 70;
const MILK = "#fffdf7";
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export function RaceGame({ best }: { best: number }) {
  return (
    <ArcadeShell
      game="race"
      title="Balap Sapi"
      initialBest={best}
      howTo={
        <ul className="list-disc space-y-1 pl-5">
          <li>Geser kiri-kanan, ketuk sisi kiri/kanan layar, atau tekan panah kiri/kanan untuk pindah jalur.</li>
          <li>Ambil botol susu (+10 per botol) dan hindari penghalang neon.</li>
          <li>Skor = jarak tempuh + poin botol susu. Makin lama makin cepat!</li>
        </ul>
      }
    >
      {(hooks) => <RaceCanvas hooks={hooks} best={best} />}
    </ArcadeShell>
  );
}

type Item = { k: "o" | "c"; l: number; z: number; c?: string };

function RaceCanvas({ hooks, best }: { hooks: ArcadeHooks; best: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const hooksRef = useRef(hooks);
  hooksRef.current = hooks;

  useEffect(() => {
    const cv = canvas.current!;
    const ctx = setupCanvas(cv, W, H);
    const scene = makeScene(W, HZ, false);
    const cowImg = loadImage(COW_HEAD);
    let rec = best;
    let cow = { x: 0, tx: 0 };
    let items: Item[] = [];
    let pops: { x: number; y: number; life: number; s: string }[] = [];
    let state: "ready" | "play" | "dead" = "ready";
    let t = 0;
    let dist = 0;
    let coins = 0;
    let v = 24;
    let nextZ = 45;
    let safe = 0;
    let deadAt = 0;
    let raf = 0;
    let last = performance.now();

    const reset = () => {
      cow = { x: 0, tx: 0 };
      items = [];
      pops = [];
      state = "ready";
      t = 0;
      dist = 0;
      coins = 0;
      v = 24;
      nextZ = 45;
      safe = 0;
    };
    const score = () => Math.floor(dist) + coins * 10;
    const proj = (l: number, z: number) => {
      const s = ZP / z;
      return { x: 180 + l * LW * s, y: HZ + (YP - HZ) * s, s };
    };
    const addRow = (z: number) => {
      safe = Math.max(-1, Math.min(1, safe + ((Math.random() * 3) | 0) - 1));
      const others = [-1, 0, 1].filter((l) => l !== safe);
      const c = Math.random() < 0.5 ? PINK : CYAN;
      if (Math.random() > 0.28) {
        const n = Math.random() < 0.45 ? 2 : 1;
        if (n === 1) others.splice((Math.random() * 2) | 0, 1);
        others.forEach((l) => items.push({ k: "o", l, z, c }));
      }
      const cl = Math.random() < 0.2 ? others[0] ?? safe : safe;
      const cn = Math.random() < 0.4 ? 5 : 3;
      for (let i = 0; i < cn; i++) items.push({ k: "c", l: cl, z: z + i * 3.2 });
    };
    const move = (dir: number) => {
      if (state !== "play") return;
      cow.tx = Math.max(-1, Math.min(1, cow.tx + dir));
    };
    const startOrRestart = () => {
      if (state === "ready") {
        state = "play";
        hooksRef.current.onStart();
      } else if (state === "dead" && performance.now() - deadAt > 450) reset();
    };
    const die = () => {
      state = "dead";
      deadAt = performance.now();
      const s = score();
      rec = s; // skor yang dihitung = permainan terakhir
      hooksRef.current.onEnd(s, { meters: Math.floor(dist), bottles: coins });
    };

    const update = (dt: number) => {
      t += dt;
      const spd = state === "play" ? v : state === "ready" ? 16 : 0;
      dist += spd * dt * 0.1;
      cow.x += (cow.tx - cow.x) * Math.min(1, dt * 14);
      pops.forEach((p) => {
        p.life -= dt;
        p.y -= 40 * dt;
      });
      pops = pops.filter((p) => p.life > 0);
      if (state !== "play") return;
      v = Math.min(56, v + 0.9 * dt);
      nextZ -= v * dt;
      while (nextZ <= ZFAR) {
        addRow(nextZ);
        nextZ += Math.max(17, v * 0.55) + rnd(0, 8);
      }
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i];
        it.z -= v * dt;
        if (it.z < 2.4) {
          items.splice(i, 1);
          continue;
        }
        if (it.k === "o" && Math.abs(it.z - ZP) < 1.1 && Math.abs(it.l - cow.x) < 0.55) return die();
        if (it.k === "c" && Math.abs(it.z - ZP) < 1.6 && Math.abs(it.l - cow.x) < 0.6) {
          coins++;
          items.splice(i, 1);
          pops.push({ x: 180 + cow.x * LW, y: YP - 90, life: 0.6, s: "+10" });
        }
      }
    };

    const drawObstacle = (it: Item) => {
      const p = proj(it.l, it.z);
      const w = 78 * p.s;
      const h = 60 * p.s;
      ctx.fillStyle = "#1a0b3f";
      ctx.strokeStyle = it.c!;
      ctx.lineWidth = Math.max(1, 3 * p.s);
      glow(ctx, it.c!, 12);
      ctx.fillRect(p.x - w / 2, p.y - h, w, h);
      ctx.strokeRect(p.x - w / 2, p.y - h, w, h);
      ctx.beginPath();
      ctx.moveTo(p.x - w / 2, p.y - h * 0.65);
      ctx.lineTo(p.x + w / 2, p.y - h * 0.65);
      ctx.moveTo(p.x - w / 2, p.y - h * 0.32);
      ctx.lineTo(p.x + w / 2, p.y - h * 0.32);
      ctx.stroke();
      ctx.fillStyle = it.c!;
      ctx.beginPath();
      ctx.arc(p.x, p.y - h - 6 * p.s, 5 * p.s, 0, 7);
      ctx.fill();
      ctx.shadowBlur = 0;
    };
    const drawCoin = (it: Item) => {
      const p = proj(it.l, it.z);
      const bob = Math.sin(t * 6 + it.z) * 3 * p.s;
      const bw = 15 * p.s;
      const bh = 24 * p.s;
      const y = p.y - 30 * p.s + bob;
      ctx.fillStyle = MILK;
      ctx.strokeStyle = CYAN;
      ctx.lineWidth = Math.max(1, 2 * p.s);
      glow(ctx, CYAN, 12);
      roundRect(ctx, p.x - bw / 2, y - bh / 2, bw, bh, 3 * p.s);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = CYAN;
      ctx.fillRect(p.x - bw * 0.35, y - bh / 2 - 4 * p.s, bw * 0.7, 4 * p.s);
      ctx.shadowBlur = 0;
    };

    const draw = () => {
      scene.draw(ctx, t, -cow.x * 10 + dist * 0.3, -cow.x * 22 + dist * 0.8, 130, 50, H);
      ctx.fillStyle = "#07031a";
      ctx.fillRect(0, HZ, W, H - HZ);
      const s2 = 1.4;
      const bx = 1.5 * LW * s2;
      const by = HZ + (YP - HZ) * s2;
      ctx.fillStyle = "#0f0730";
      ctx.beginPath();
      ctx.moveTo(180, HZ);
      ctx.lineTo(180 + bx, by);
      ctx.lineTo(180 - bx, by);
      ctx.closePath();
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = PINK;
      glow(ctx, PINK, 12);
      ctx.beginPath();
      ctx.moveTo(180, HZ);
      ctx.lineTo(180 - bx, by);
      ctx.stroke();
      ctx.strokeStyle = CYAN;
      glow(ctx, CYAN, 12);
      ctx.beginPath();
      ctx.moveTo(180, HZ);
      ctx.lineTo(180 + bx, by);
      ctx.stroke();
      ctx.strokeStyle = PINK;
      glow(ctx, PINK, 14);
      ctx.beginPath();
      ctx.moveTo(0, HZ);
      ctx.lineTo(W, HZ);
      ctx.stroke();
      ctx.shadowBlur = 0;
      // marka jalur
      const zo = (dist * 10) % 8;
      ctx.strokeStyle = "rgba(157,77,255,.7)";
      for (let k = 0; k < 10; k++) {
        let za = ZP + k * 8 - zo;
        const zb = za + 4;
        if (zb < 2.5 || za > ZFAR) continue;
        za = Math.max(za, 2.5);
        for (const l of [-0.5, 0.5]) {
          const a = proj(l, za);
          const b = proj(l, zb);
          ctx.lineWidth = Math.max(1, 3 * a.s);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
      // lampu jalan
      const po = (dist * 10) % 12;
      const pi = Math.floor((dist * 10) / 12);
      for (let k = 0; k < 7; k++) {
        const z = ZP + k * 12 - po;
        if (z < 2.6 || z > ZFAR) continue;
        const col = (pi + k) % 2 ? PINK : CYAN;
        for (const l of [-2.1, 2.1]) {
          const a = proj(l, z);
          ctx.strokeStyle = "#2a1460";
          ctx.lineWidth = Math.max(1, 4 * a.s);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(a.x, a.y - 90 * a.s);
          ctx.stroke();
          ctx.fillStyle = col;
          glow(ctx, col, 12);
          ctx.beginPath();
          ctx.arc(a.x, a.y - 92 * a.s, Math.max(1.5, 6 * a.s), 0, 7);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }
      items
        .slice()
        .sort((a, b) => b.z - a.z)
        .forEach((it) => {
          if (it.z > ZFAR) return;
          if (it.k === "o") drawObstacle(it);
          else drawCoin(it);
        });
      // sapi
      const cx = 180 + cow.x * LW;
      const bob = state === "dead" ? 0 : Math.sin(t * 14) * 3;
      ctx.fillStyle = "rgba(0,0,0,.45)";
      ctx.beginPath();
      ctx.ellipse(cx, YP + 6, 30, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.translate(cx, YP - 38 + bob);
      ctx.rotate((cow.tx - cow.x) * 0.3);
      glow(ctx, PINK, 12);
      if (cowImg.complete && cowImg.naturalWidth) ctx.drawImage(cowImg, -32, -29, 64, 58);
      ctx.restore();
      ctx.shadowBlur = 0;
      pops.forEach((p) => {
        ctx.globalAlpha = Math.min(1, p.life * 2.5);
        txt(ctx, p.s, p.x, p.y, 20, CYAN, CYAN);
        ctx.globalAlpha = 1;
      });
      if (state !== "ready") {
        txt(ctx, String(score()), W / 2, 50, 44, "#fff", CYAN);
        txt(ctx, `Susu: ${coins}`, 56, 24, 15, "#fff", PINK);
      }
      if (state === "ready") {
        txt(ctx, "Balap Sapi", W / 2, 110, 42, "#fff", PINK);
        txt(ctx, "Neon City", W / 2, 150, 26, CYAN, CYAN);
        ctx.fillStyle = "rgba(10,4,32,.55)";
        roundRect(ctx, 30, 300, 300, 110, 14);
        ctx.fill();
        txt(ctx, "Geser kiri-kanan atau ketuk", W / 2, 325, 16, "#fff", VIO);
        txt(ctx, "sisi layar untuk pindah jalur", W / 2, 348, 16, "#fff", VIO);
        txt(ctx, "Ambil botol susu, hindari penghalang", W / 2, 382, 14, CYAN, CYAN);
        txt(ctx, "Ketuk untuk mulai", W / 2, 440, 20, PINK, PINK);
        if (rec) txt(ctx, `Skor tercatat: ${rec}`, W / 2, 475, 16, "#fff", CYAN);
      }
      if (state === "dead") {
        ctx.fillStyle = "rgba(10,4,32,.93)";
        ctx.strokeStyle = CYAN;
        ctx.lineWidth = 3;
        glow(ctx, CYAN, 16);
        roundRect(ctx, 55, 150, 250, 210, 16);
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;
        txt(ctx, "Mooo! Game over", W / 2, 190, 26, "#fff", PINK);
        txt(ctx, `Skor: ${score()}`, W / 2, 238, 24, "#fff");
        txt(ctx, `${Math.floor(dist)} m  |  ${coins} botol susu`, W / 2, 270, 15, CYAN, CYAN);
        txt(ctx, `Skor tercatat: ${rec}`, W / 2, 302, 20, "#fff", CYAN);
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

    // Kontrol: geser / ketuk sisi layar / keyboard
    let px = 0;
    let swiped = false;
    let down = false;
    const lx = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      return ((e.clientX - r.left) / r.width) * W;
    };
    const onDown = (e: PointerEvent) => {
      e.preventDefault();
      if (state !== "play") {
        startOrRestart();
        down = false;
        return;
      }
      down = true;
      swiped = false;
      px = lx(e);
    };
    const onMove = (e: PointerEvent) => {
      if (!down || swiped) return;
      const dx = lx(e) - px;
      if (Math.abs(dx) > 25) {
        swiped = true;
        move(dx > 0 ? 1 : -1);
      }
    };
    const onUp = (e: PointerEvent) => {
      if (down && !swiped) move(lx(e) < W / 2 ? -1 : 1);
      down = false;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") {
        e.preventDefault();
        move(-1);
      } else if (e.code === "ArrowRight" || e.code === "KeyD") {
        e.preventDefault();
        move(1);
      } else if (e.code === "Space" || e.code === "ArrowUp" || e.code === "Enter") {
        e.preventDefault();
        if (!e.repeat) startOrRestart();
      }
    };
    cv.addEventListener("pointerdown", onDown);
    cv.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("keydown", onKey);
    reset();
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      cv.removeEventListener("pointerdown", onDown);
      cv.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <NeonFrame>
      <canvas ref={canvas} aria-label="Game Balap Sapi" className="aspect-[360/560] w-full touch-none" />
    </NeonFrame>
  );
}
