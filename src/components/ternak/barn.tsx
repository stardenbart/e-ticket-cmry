"use client";

// Layar kandang: latar kandang (SVG) + sapi yang bergerak sendiri (state machine: diam, jalan, lompat, makan,
// berbaring), pakan yang dijatuhkan, pup yang bisa diketuk, ember perah susu, emote & teks melayang.
// Gerak dijalankan requestAnimationFrame langsung ke DOM (tanpa re-render React per frame).
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";

export type CowMood = "senang" | "sedih" | "sakit";
export type StageKey = "pedet" | "remaja" | "dewasa";
type Emote = "heart" | "note" | "zzz" | "sweat" | "nyam" | "wow" | "sad" | "squirt";
type FloatKind = "gain" | "heal" | "loss" | "warn" | "heart" | "coin";
type ToastTone = "ok" | "warn" | "bad" | "info";

export type BarnHandle = {
  feed: (emoji: string, gain: string) => void;
  heal: () => void;
  sweep: () => void;
  outfit: () => void;
  pet: (counted: boolean) => void;
  squirt: () => void;
  float: (text: string, kind: FloatKind) => void;
  toast: (text: string, tone?: ToastTone) => void;
};

/** Ukuran asli gambar (px, sudah di-crop), arah hadap (1 = kanan) & posisi kepala (% gambar) untuk aksesori. */
const SPRITES: Record<StageKey, Record<CowMood, { w: number; h: number; face: 1 | -1; head: [number, number] }>> = {
  pedet: { senang: { w: 896, h: 833, face: 1, head: [55, 6] }, sedih: { w: 885, h: 821, face: -1, head: [45, 6] }, sakit: { w: 1143, h: 557, face: -1, head: [34, 14] } },
  remaja: { senang: { w: 1066, h: 1013, face: 1, head: [66, 6] }, sedih: { w: 912, h: 985, face: 1, head: [52, 6] }, sakit: { w: 1221, h: 617, face: -1, head: [38, 14] } },
  dewasa: { senang: { w: 1635, h: 1246, face: 1, head: [72, 6] }, sedih: { w: 1628, h: 1252, face: 1, head: [66, 6] }, sakit: { w: 1585, h: 846, face: -1, head: [26, 16] } },
};
/** lebar sprite (% lebar kandang) = lebar asli × K[tahap] × skala pertumbuhan */
const SIZE_K: Record<StageKey, number> = { pedet: 0.032, remaja: 0.036, dewasa: 0.034 };
const ASPECT = 10 / 16;
const BOTTOM = 9; // % dari bawah kandang

const MOTION = {
  SPEED: { pedet: 13, remaja: 10, dewasa: 7 } as Record<StageKey, number>, // %/detik saat sehat
  SAD_MULT: 0.4,
  STEP_RATE: { happy: 11, sad: 6 },
  BOB_PX: { happy: 6, sad: 2.5 },
  TILT: { happy: 2.2, sad: 1 },
  HOP_PX: 26,
  HOP_S: 0.55,
  EAT_S: 1.5,
  EDGE: 1.5,
};
const BREATH: Record<CowMood, { amp: number; dur: string }> = {
  senang: { amp: 0.035, dur: "3.2s" },
  sedih: { amp: 0.022, dur: "4.8s" },
  sakit: { amp: 0.014, dur: "6.5s" },
};

const EMOTES: Record<Emote, React.ReactNode> = {
  heart: (
    <>
      <span style={{ color: "#e11d48" }}>♥</span>
      <span style={{ color: "#fb7185", fontSize: ".65em" }}>♥</span>
    </>
  ),
  note: (
    <>
      <span style={{ color: "#7c3aed" }}>♪</span>
      <span style={{ color: "#a78bfa", fontSize: ".7em" }}>♫</span>
    </>
  ),
  zzz: (
    <span style={{ color: "#475569" }}>
      Z<span style={{ fontSize: ".75em" }}>z</span>
      <span style={{ fontSize: ".55em" }}>z</span>
    </span>
  ),
  sweat: <span className="ts-drop" />,
  nyam: <span style={{ color: "#b45309", fontSize: ".7em" }}>nyam!</span>,
  wow: <span style={{ color: "#f59e0b" }}>!</span>,
  sad: <span style={{ color: "#64748b", fontSize: ".85em" }}>...</span>,
  squirt: <span style={{ color: "#0284c7", fontSize: ".6em" }}>psst!</span>,
};

/** Posisi pup di lantai (% lebar) — maksimal 3 tumpukan. */
const POOP_X = [17, 63, 84];

/** Jerami di lantai: posisi pseudo-acak tetap. */
const STRAW = (() => {
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  let d = "";
  for (let i = 0; i < 70; i++) {
    const x = rnd() * 1600, y = 720 + rnd() * 270, len = 14 + rnd() * 22, ang = rnd() * Math.PI;
    d += `M${x.toFixed(0)} ${y.toFixed(0)}l${(Math.cos(ang) * len).toFixed(0)} ${(Math.sin(ang) * len * 0.35).toFixed(0)}`;
  }
  return d;
})();

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const rand = (a: number, b: number) => a + Math.random() * (b - a);

export function Barn({
  ref,
  name,
  stage,
  scale,
  mood,
  src,
  accessory,
  dirt,
  scooped,
  milking,
  onPet,
  onPoop,
  onMilkTap,
}: {
  ref?: Ref<BarnHandle>;
  name: string;
  stage: StageKey;
  scale: number;
  mood: CowMood;
  src: string;
  accessory: { emoji: string; spot: "head" | "body" } | null;
  dirt: number;
  scooped: number[];
  milking: { taps: number; need: number; busy: boolean } | null;
  onPet: () => void;
  onPoop: (i: number) => void;
  onMilkTap: () => void;
}) {
  const stageEl = useRef<HTMLDivElement>(null);
  const mover = useRef<HTMLDivElement>(null);
  const flip = useRef<HTMLDivElement>(null);
  const fx = useRef<HTMLDivElement>(null);
  const bob = useRef<HTMLDivElement>(null);
  const shadow = useRef<HTMLDivElement>(null);
  const emoteEl = useRef<HTMLDivElement>(null);
  const hayEl = useRef<HTMLDivElement>(null);
  const hayEmoji = useRef<HTMLSpanElement>(null);
  const floats = useRef<HTMLDivElement>(null);
  const toastEl = useRef<HTMLDivElement>(null);
  const bucket = useRef<HTMLDivElement>(null);
  const broom = useRef<HTMLDivElement>(null);

  const meta = SPRITES[stage][mood];
  const widthPct = meta.w * SIZE_K[stage] * scale;
  const spriteHpct = (widthPct * (meta.h / meta.w)) / ASPECT;

  // Keadaan gerak (visual saja) — disimpan di ref agar loop rAF tidak ikut re-render.
  const m = useRef({ x: 50, dir: 1, mode: "idle" as "idle" | "walk" | "hop" | "eat" | "rest" | "hold", t: 1, target: 50, goal: null as null | "hay", phase: 0 });
  const hay = useRef({ active: false, x: 50, gain: "" });
  const live = useRef({ mood, stage, widthPct, face: meta.face, milking: !!milking, stageW: 700, reduced: false, spriteHpct });
  live.current = { ...live.current, mood, stage, widthPct, face: meta.face, milking: !!milking, spriteHpct };
  const timers = useRef<{ emote?: number; toast?: number; hay?: number }>({});

  const playFx = (name: "pop" | "heal" | "evolve" | "swap") => {
    const el = fx.current;
    if (!el) return;
    el.classList.remove("ts-fx--pop", "ts-fx--heal", "ts-fx--evolve", "ts-fx--swap");
    void el.offsetWidth;
    el.classList.add(`ts-fx--${name}`);
    el.addEventListener("animationend", () => el.classList.remove(`ts-fx--${name}`), { once: true });
  };

  const [em, setEm] = useState<{ kind: Emote; loop: boolean; n: number } | null>(null);
  const emote = (kind: Emote, loop = false) => {
    if (live.current.mood === "sakit" && kind !== "zzz") return;
    clearTimeout(timers.current.emote);
    setEm((e) => ({ kind, loop, n: (e?.n ?? 0) + 1 }));
    if (!loop) timers.current.emote = window.setTimeout(clearEmote, 1800);
  };
  const clearEmote = () => {
    clearTimeout(timers.current.emote);
    // Sapi sakit kembali ke "zzz".
    setEm((e) => (live.current.mood === "sakit" ? { kind: "zzz", loop: true, n: (e?.n ?? 0) + 1 } : null));
  };

  const floatText = (text: string, kind: FloatKind) => {
    const box = floats.current;
    if (!box) return;
    const span = document.createElement("span");
    span.className = `ts-float ts-float--${kind}`;
    span.textContent = text;
    span.style.bottom = `${Math.min(74, BOTTOM + live.current.spriteHpct * 0.75)}%`;
    span.style.left = `${clamp(m.current.x + rand(-5, 5), 10, 90)}%`;
    span.style.setProperty("--dx", `${rand(-18, 18).toFixed(0)}px`);
    while (box.children.length >= 10) box.removeChild(box.firstChild!);
    box.appendChild(span);
    const rm = () => span.remove();
    span.addEventListener("animationend", rm, { once: true });
    window.setTimeout(rm, 2200);
  };

  const toast = (text: string, tone: ToastTone = "ok") => {
    const el = toastEl.current;
    if (!el) return;
    el.className = `ts-toast ts-toast--${tone}`;
    void el.offsetWidth;
    el.classList.add("ts-toast-in");
    el.textContent = text;
    clearTimeout(timers.current.toast);
    timers.current.toast = window.setTimeout(() => el.classList.add("hidden"), 2800);
  };

  const bounds = () => {
    const half = live.current.widthPct / 2 + MOTION.EDGE;
    return half <= 100 - half ? { min: half, max: 100 - half } : { min: 50, max: 50 };
  };

  const removeHay = () => {
    hay.current.active = false;
    hayEl.current?.classList.add("is-gone");
    clearTimeout(timers.current.hay);
    timers.current.hay = window.setTimeout(() => {
      if (!hayEl.current) return;
      hayEl.current.hidden = true;
      hayEl.current.classList.remove("is-gone", "is-drop");
    }, 320);
  };

  const startWalk = (b: { min: number; max: number }, minDist: number, maxDist = 100) => {
    const s = m.current;
    const lo = Math.max(b.min, s.x - maxDist), hi = Math.min(b.max, s.x + maxDist);
    let target = rand(lo, hi);
    for (let i = 0; i < 4 && Math.abs(target - s.x) < minDist; i++) target = rand(lo, hi);
    s.target = target;
    s.mode = "walk";
  };

  const decide = () => {
    const s = m.current;
    const { mood: md, milking: mk } = live.current;
    if (md === "sakit") return void (s.mode = "rest");
    if (mk) return void ((s.mode = "hold"), (s.t = 1));
    const b = bounds();
    if (hay.current.active) {
      const side = hay.current.x >= s.x ? 1 : -1;
      s.target = clamp(hay.current.x - side * live.current.widthPct * 0.32, b.min, b.max);
      s.goal = "hay";
      s.mode = "walk";
      s.dir = side;
      return;
    }
    s.goal = null;
    const r = Math.random();
    if (md === "senang") {
      if (r < 0.5) startWalk(b, 12);
      else if (r < 0.82) {
        s.mode = "idle";
        s.t = rand(1.2, 3.2);
        if (Math.random() < 0.25) emote("note");
      } else {
        s.mode = "hop";
        s.t = 0;
      }
    } else {
      // sedih: jarang jalan, langkah pendek & terseok
      if (r < 0.3) startWalk(b, 4, 14);
      else {
        s.mode = "idle";
        s.t = rand(2.5, 6);
        if (Math.random() < 0.4) emote(Math.random() < 0.5 ? "sweat" : "sad");
      }
    }
  };

  const arrive = () => {
    const s = m.current;
    if (s.goal === "hay" && hay.current.active) {
      s.dir = hay.current.x >= s.x ? 1 : -1;
      s.mode = "eat";
      s.t = MOTION.EAT_S;
      playFx("pop");
      emote("nyam");
    } else {
      s.mode = "idle";
      s.t = rand(0.8, 2.5);
    }
    s.goal = null;
  };

  const eatDone = () => {
    removeHay();
    emote("heart");
    if (hay.current.gain) floatText(hay.current.gain, "gain");
  };

  // Loop gerak
  useEffect(() => {
    live.current.reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const ro = "ResizeObserver" in window && stageEl.current ? new ResizeObserver(([e]) => (live.current.stageW = e.contentRect.width || 700)) : null;
    if (stageEl.current) {
      live.current.stageW = stageEl.current.clientWidth || 700;
      ro?.observe(stageEl.current);
    }
    m.current.x = 50;
    let raf = 0;
    let last = 0;
    const frame = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;
      const s = m.current;
      const L = live.current;
      const b = bounds();
      const sk = L.mood === "senang" ? "happy" : "sad";
      let y = 0,
        rot = 0;
      if (L.reduced) {
        s.x = clamp(s.x, b.min, b.max);
        if (hay.current.active) eatDone();
      } else if (L.mood === "sakit") {
        s.mode = "rest";
      } else {
        if (s.mode === "rest") {
          s.mode = "idle";
          s.t = 0.8;
        }
        if (L.milking && s.mode !== "eat") s.mode = "hold";
        if (!L.milking && s.mode === "hold") {
          s.mode = "idle";
          s.t = 0.6;
        }
        const k = L.stageW / 700;
        switch (s.mode) {
          case "walk": {
            const speed = MOTION.SPEED[L.stage] * (L.mood === "senang" ? 1 : MOTION.SAD_MULT);
            const dx = s.target - s.x;
            const step = speed * dt;
            if (Math.abs(dx) > 0.05) s.dir = dx < 0 ? -1 : 1;
            if (Math.abs(dx) <= step) {
              s.x = s.target;
              arrive();
            } else s.x += Math.sign(dx) * step;
            s.phase += dt * MOTION.STEP_RATE[sk];
            y = -Math.abs(Math.sin(s.phase)) * MOTION.BOB_PX[sk] * k;
            rot = Math.sin(s.phase) * MOTION.TILT[sk];
            break;
          }
          case "hop": {
            s.t += dt;
            const p = s.t / MOTION.HOP_S;
            if (p >= 1) {
              playFx("pop");
              s.mode = "idle";
              s.t = rand(0.6, 1.6);
            } else y = -Math.sin(Math.PI * p) * MOTION.HOP_PX * k;
            break;
          }
          case "eat": {
            s.t -= dt;
            rot = Math.sin(s.t * 16) * 3; // mengangguk saat mengunyah
            if (s.t <= 0) {
              eatDone();
              s.mode = "idle";
              s.t = rand(0.8, 1.6);
            }
            break;
          }
          case "hold":
            break;
          default: {
            s.t -= dt;
            if (s.t <= 0) decide();
          }
        }
        s.x = clamp(s.x, b.min, b.max);
      }
      if (mover.current) mover.current.style.left = `${s.x}%`;
      if (flip.current) flip.current.style.transform = `scaleX(${s.dir * L.face})`;
      if (bob.current) bob.current.style.transform = `translateY(${y.toFixed(2)}px) rotate(${rot.toFixed(2)}deg)`;
      if (shadow.current) shadow.current.style.transform = `translateX(-50%) scale(${(1 + y / 140).toFixed(3)})`;
      if (emoteEl.current) emoteEl.current.style.left = `${50 + 24 * s.dir * L.face * (L.mood === "sakit" ? -1 : 1)}%`;
      if (bucket.current) bucket.current.style.left = `${s.x - s.dir * L.widthPct * 0.08}%`;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const t = timers.current;
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      clearTimeout(t.emote);
      clearTimeout(t.toast);
      clearTimeout(t.hay);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pergantian kondisi / tahap → animasi & emote yang sesuai.
  const prev = useRef<{ mood: CowMood; stage: StageKey; src: string } | null>(null);
  useEffect(() => {
    const p = prev.current;
    prev.current = { mood, stage, src };
    if (mood === "sakit") emote("zzz", true);
    if (!p) return;
    if (p.src !== src) playFx("swap");
    if (p.stage !== stage) {
      playFx("evolve");
      toast(`Naik tahap: ${stage === "remaja" ? "Remaja" : "Dewasa"}!`, "info");
      window.setTimeout(() => emote("wow"), 300);
    }
    if (p.mood !== mood) {
      if (mood === "sakit") toast("Sapi jatuh sakit!", "bad");
      else if (p.mood === "sakit") {
        clearEmote();
        toast("Sapi sudah pulih!", "ok");
        window.setTimeout(() => emote("heart"), 250);
      } else if (mood === "sedih") window.setTimeout(() => emote("sweat"), 200);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mood, stage, src]);

  useImperativeHandle(ref, () => ({
    feed(emoji, gain) {
      const el = hayEl.current;
      if (!el) return;
      const b = bounds();
      const reach = live.current.widthPct * 0.3;
      if (!hay.current.active) {
        hay.current.x = rand(Math.max(8, b.min - reach), Math.min(92, b.max + reach));
        el.style.left = `${hay.current.x}%`;
      }
      hay.current.active = true;
      hay.current.gain = gain;
      if (hayEmoji.current) hayEmoji.current.textContent = emoji;
      clearTimeout(timers.current.hay);
      el.hidden = false;
      el.classList.remove("is-gone", "is-drop");
      void el.offsetWidth;
      el.classList.add("is-drop");
      if (m.current.mode !== "eat" && m.current.mode !== "rest") decide();
    },
    heal() {
      playFx("heal");
      floatText("Sembuh!", "heal");
    },
    sweep() {
      const el = broom.current;
      if (!el) return;
      el.classList.remove("is-on");
      void el.offsetWidth;
      el.classList.add("is-on");
      window.setTimeout(() => {
        floatText("+2 afeksi", "heart");
        emote("heart");
      }, 900);
    },
    outfit() {
      playFx("evolve");
      emote("wow");
      floatText("Gaya!", "heart");
    },
    pet(counted) {
      const md = live.current.mood;
      if (md === "sakit") return floatText("Zzz…", "warn");
      if (md === "sedih") {
        emote("sad");
        floatText(counted ? "+1 afeksi" : "Lemas…", counted ? "heart" : "warn");
        return;
      }
      emote("heart");
      floatText(counted ? "♥ +1 afeksi" : "♥", "heart");
      const s = m.current;
      if (!live.current.reduced && s.mode !== "eat" && s.mode !== "hop" && s.mode !== "hold") {
        s.mode = "hop";
        s.t = 0;
      }
    },
    squirt() {
      emote("squirt");
      playFx("pop");
      const box = floats.current;
      if (!box) return;
      const d = document.createElement("span");
      d.className = "ts-milkdrop";
      d.style.left = `${m.current.x - m.current.dir * live.current.widthPct * 0.08}%`;
      d.style.bottom = `${BOTTOM + live.current.spriteHpct * 0.32}%`;
      box.appendChild(d);
      d.addEventListener("animationend", () => d.remove(), { once: true });
      window.setTimeout(() => d.remove(), 900);
    },
    float: floatText,
    toast,
  }));

  // Aksesori kepala (bandana, mahkota) di atas kepala; jaket di badan sapi.
  const accStyle = (spot: "head" | "body"): React.CSSProperties => {
    if (spot === "head") return { left: `${meta.head[0]}%`, top: `${meta.head[1]}%`, fontSize: `${Math.max(4, widthPct * 0.2)}cqw` };
    const x = stage === "pedet" ? 50 : meta.head[0] > 50 ? meta.head[0] - 32 : meta.head[0] + 32;
    const y = mood === "sakit" ? 58 : stage === "pedet" ? 64 : stage === "remaja" ? 56 : 48;
    return { left: `${x}%`, top: `${y}%`, fontSize: `${Math.max(5, widthPct * 0.3)}cqw`, transform: "translate(-50%,-50%)" };
  };
  const sign = name.toUpperCase();
  const fill = milking ? Math.min(1, milking.taps / milking.need) : 0;

  return (
    <div
      ref={stageEl}
      className="ts-stage relative isolate aspect-[16/10] w-full select-none overflow-hidden rounded-2xl ring-1 ring-black/10"
      style={{ background: "#a8452f", containerType: "inline-size" }}
    >
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1600 1000" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <pattern id="ts-planks" width="90" height="700" patternUnits="userSpaceOnUse">
              <rect width="90" height="700" fill="#a8452f"/>
              <rect x="45" width="45" height="700" fill="#9c3f2b"/>
              <rect width="5" height="700" fill="#6e2618"/>
              <rect x="45" width="3" height="700" fill="#7f2e1f" opacity=".55"/>
              <circle cx="22" cy="80" r="3" fill="#5c2116"/><circle cx="67" cy="380" r="3" fill="#5c2116"/>
            </pattern>
            <pattern id="ts-doorplanks" width="62" height="560" patternUnits="userSpaceOnUse">
              <rect width="62" height="560" fill="#8e3626"/><rect width="4" height="560" fill="#5f2015"/>
            </pattern>
            <linearGradient id="ts-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7cc8f0"/><stop offset="1" stopColor="#d6f0fb"/></linearGradient>
            <linearGradient id="ts-floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#c9933a"/><stop offset=".22" stopColor="#e3be64"/><stop offset="1" stopColor="#f0d488"/></linearGradient>
            <linearGradient id="ts-beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fffbe6" stopOpacity=".32"/><stop offset="1" stopColor="#fffbe6" stopOpacity="0"/></linearGradient>
            <radialGradient id="ts-glow"><stop offset="0" stopColor="#ffd76a" stopOpacity=".6"/><stop offset="1" stopColor="#ffd76a" stopOpacity="0"/></radialGradient>
            <radialGradient id="ts-vig" cx=".5" cy=".55" r=".78"><stop offset=".62" stopColor="#000" stopOpacity="0"/><stop offset="1" stopColor="#000" stopOpacity=".32"/></radialGradient>
          </defs>

          {/* dinding papan & balok atap */}
          <rect width="1600" height="700" fill="url(#ts-planks)"/>
          <rect width="1600" height="54" fill="#5c2116"/>
          <rect y="54" width="1600" height="10" fill="#000" opacity=".15"/>

          {/* jendela */}
          <g transform="translate(150 105)">
            <rect x="-16" y="-16" width="332" height="252" rx="6" fill="#f3ead6"/>
            <rect width="300" height="220" fill="url(#ts-sky)"/>
            <ellipse cx="90" cy="70" rx="48" ry="16" fill="#fff" opacity=".9"/>
            <ellipse cx="215" cy="45" rx="34" ry="11" fill="#fff" opacity=".8"/>
            <path d="M0 175 Q 90 130 180 165 T 300 150 V220 H0Z" fill="#7cc35a"/>
            <path d="M0 200 Q 120 165 300 190 V220 H0Z" fill="#5aa845"/>
            <rect x="142" width="16" height="220" fill="#f3ead6"/>
            <rect y="102" width="300" height="16" fill="#f3ead6"/>
            <rect x="-26" y="232" width="352" height="18" rx="4" fill="#e3d6bb"/>
          </g>

          {/* papan nama */}
          <g transform="translate(600 120)">
            <line x1="40" y1="-66" x2="40" y2="4" stroke="#3f2a1a" strokeWidth="4"/>
            <line x1="320" y1="-66" x2="320" y2="4" stroke="#3f2a1a" strokeWidth="4"/>
            <rect width="360" height="84" rx="10" fill="#e6bd7f" stroke="#7a4a1f" strokeWidth="6"/>
            <text x="180" y="57" textAnchor="middle" fontFamily="'Trebuchet MS', system-ui, sans-serif" fontWeight="800" fontSize={sign.length > 12 ? 30 : 40} fill="#5b3413" letterSpacing="3" {...(sign.length > 14 ? { textLength: 320, lengthAdjust: "spacingAndGlyphs" } : {})}>{sign}</text>
          </g>

          {/* lentera */}
          <g transform="translate(1040 54)">
            <circle className="ts-lamp-glow" cx="0" cy="142" r="125" fill="url(#ts-glow)"/>
            <line x1="0" y1="0" x2="0" y2="108" stroke="#2b2b2b" strokeWidth="4"/>
            <rect x="-28" y="104" width="56" height="12" rx="4" fill="#3a3a3a"/>
            <rect x="-22" y="112" width="44" height="60" rx="8" fill="#ffe08a" stroke="#3a3a3a" strokeWidth="6"/>
            <rect x="-28" y="168" width="56" height="10" rx="4" fill="#3a3a3a"/>
          </g>

          {/* pintu kandang */}
          <g transform="translate(1150 140)">
            <rect x="-20" y="-24" width="380" height="20" rx="4" fill="#4a1a10"/>
            <rect width="340" height="560" fill="url(#ts-doorplanks)"/>
            <rect x="9" y="9" width="322" height="542" fill="none" stroke="#f3ead6" strokeWidth="18"/>
            <line x1="18" y1="18" x2="322" y2="542" stroke="#f3ead6" strokeWidth="16"/>
            <line x1="322" y1="18" x2="18" y2="542" stroke="#f3ead6" strokeWidth="16"/>
          </g>

          {/* pagar sekat */}
          <g fill="#c98d4f" stroke="#8a5a2b" strokeWidth="4">
            <rect x="-10" y="548" width="1150" height="26" rx="6"/>
            <rect x="-10" y="612" width="1150" height="26" rx="6"/>
            <rect x="330" y="505" width="34" height="200" rx="5"/>
            <rect x="760" y="505" width="34" height="200" rx="5"/>
            <rect x="1100" y="505" width="34" height="200" rx="5"/>
          </g>

          {/* lantai jerami */}
          <rect y="690" width="1600" height="310" fill="url(#ts-floor)"/>
          <rect y="690" width="1600" height="14" fill="#000" opacity=".16"/>
          <path d={STRAW} fill="none" stroke="#b07a25" strokeWidth="5" strokeLinecap="round" opacity=".5"/>

          {/* cahaya dari jendela */}
          <polygon points="150,355 450,355 820,1000 260,1000" fill="url(#ts-beam)"/>

          {/* tumpukan jerami */}
          <g transform="translate(30 590)">
            <rect x="35" y="-92" width="190" height="100" rx="16" fill="#ddb24c" stroke="#a87720" strokeWidth="5"/>
            <path d="M52 -62 H210 M52 -30 H210" stroke="#c08d2a" strokeWidth="5" strokeLinecap="round"/>
            <rect width="250" height="134" rx="18" fill="#e7bf55" stroke="#a87720" strokeWidth="5"/>
            <path d="M20 32 H230 M15 67 H235 M20 102 H230" stroke="#c9972f" strokeWidth="5" strokeLinecap="round"/>
            <rect x="70" width="12" height="134" fill="#8a5a2b" opacity=".7"/>
            <rect x="170" width="12" height="134" fill="#8a5a2b" opacity=".7"/>
          </g>

          {/* palung air */}
          <g transform="translate(1185 700)">
            <rect x="40" y="66" width="16" height="26" fill="#5f3b1a"/>
            <rect x="244" y="66" width="16" height="26" fill="#5f3b1a"/>
            <path d="M0 0 H300 L280 70 H20 Z" fill="#8b5a2b" stroke="#5f3b1a" strokeWidth="6" strokeLinejoin="round"/>
            <ellipse cx="150" cy="6" rx="143" ry="10" fill="#5bc0eb"/>
            <ellipse cx="110" cy="4" rx="40" ry="3" fill="#fff" opacity=".6"/>
          </g>

          <rect width="1600" height="1000" fill="url(#ts-vig)"/>
      </svg>

      {/* pup — ketuk untuk membersihkan */}
      {POOP_X.slice(0, dirt).map((x, i) => (
        <button
          key={i}
          type="button"
          aria-label="Bersihkan pup"
          onClick={() => onPoop(i)}
          disabled={scooped.includes(i)}
          className={`ts-poop ${scooped.includes(i) ? "is-gone" : ""}`}
          style={{ left: `${x}%` }}
        >
          <PoopSvg />
          <span className="ts-stink" aria-hidden>
            〰
          </span>
        </button>
      ))}

      {/* pakan yang dijatuhkan */}
      <div ref={hayEl} className="ts-hay" hidden aria-hidden="true">
        <svg viewBox="0 0 120 70" className="w-full">
          <path d="M6 66 Q 18 18 60 12 Q 102 18 114 66 Z" fill="#e9c25a" stroke="#a87720" strokeWidth="4" strokeLinejoin="round" />
          <path d="M30 42 l10 -14 M55 36 l4 -18 M78 40 l8 -16 M45 54 l-8 -12 M90 56 l9 -10 M20 58 l-6 -8" stroke="#b8862b" strokeWidth="4" strokeLinecap="round" />
        </svg>
        <span ref={hayEmoji} className="ts-hay-emoji" />
      </div>

      {/* sapi */}
      <div ref={mover} className="ts-mover" style={{ left: "50%", width: `${widthPct}%` }}>
        <div ref={shadow} className="ts-shadow" aria-hidden="true" />
        <button type="button" className="ts-pet" aria-label={mood === "sakit" ? "Sapi sakit, sedang berbaring" : "Elus sapi"} onClick={milking ? onMilkTap : onPet}>
          <div ref={flip} className="ts-flip">
            <div ref={fx} className="ts-fx">
              <div ref={bob} className="ts-bob">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  className="ts-cow w-full"
                  alt={`Sapi ${name}`}
                  draggable={false}
                  decoding="async"
                  style={{ ["--ts-a" as string]: BREATH[mood].amp, ["--ts-dur" as string]: BREATH[mood].dur }}
                />
                {accessory && (
                  <span className="ts-acc" style={accStyle(accessory.spot)} aria-hidden>
                    {accessory.emoji}
                  </span>
                )}
              </div>
            </div>
          </div>
        </button>
        <div ref={emoteEl} key={em?.n ?? 0} className={`ts-emote ${em ? (em.loop ? "is-loop" : "is-on") : ""}`} aria-hidden="true">
          {em && EMOTES[em.kind]}
        </div>
      </div>

      {/* ember perah susu */}
      {milking && (
        <div ref={bucket} className="ts-bucket" style={{ width: `${Math.max(9, widthPct * 0.32)}%` }}>
          <button type="button" onClick={onMilkTap} disabled={milking.busy} aria-label="Perah susu" className="block w-full">
            <svg viewBox="0 0 100 90" className="w-full drop-shadow-[0_4px_4px_rgba(0,0,0,.3)]">
              <defs>
                <clipPath id="ts-pail">
                  <path d="M12 22 H88 L78 86 H22 Z" />
                </clipPath>
              </defs>
              <path d="M18 24 Q50 -18 82 24" fill="none" stroke="#6b7280" strokeWidth="5" />
              <path d="M12 22 H88 L78 86 H22 Z" fill="#cbd5e1" stroke="#64748b" strokeWidth="4" strokeLinejoin="round" />
              <rect x="0" y={86 - 64 * fill} width="100" height={64 * fill} fill="#fffdf5" clipPath="url(#ts-pail)" style={{ transition: "all .3s" }} />
              <path d="M12 22 H88" stroke="#94a3b8" strokeWidth="6" />
            </svg>
          </button>
        </div>
      )}

      {/* sapu */}
      <div ref={broom} className="ts-broom" aria-hidden>
        🧹
      </div>

      <div ref={floats} className="pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-x-0 top-3 z-20 flex justify-center px-3">
        <div ref={toastEl} className="hidden" role="status" />
      </div>
      {milking && (
        <div className="pointer-events-none absolute inset-x-0 top-[22%] z-10 flex justify-center px-3">
          <span className="rounded-full bg-sky-600/95 px-3 py-1 text-xs font-extrabold text-white shadow-lg sm:text-sm">
            {milking.busy ? "Menuang susu…" : `Ketuk ember / sapi untuk memerah · ${milking.taps}/${milking.need}`}
          </span>
        </div>
      )}
      <BarnStyles />
    </div>
  );
}

function PoopSvg() {
  return (
    <svg viewBox="0 0 60 50" className="w-full">
      <ellipse cx="30" cy="46" rx="26" ry="4" fill="rgba(60,30,5,.3)" />
      <path d="M6 44 Q4 34 16 32 Q12 22 24 20 Q22 10 32 6 Q34 14 40 18 Q50 20 46 30 Q58 32 54 44 Z" fill="#7a4a24" stroke="#4a2a12" strokeWidth="3" strokeLinejoin="round" />
      <path d="M16 36 Q30 40 44 35 M22 25 Q31 28 40 24" stroke="#5b3416" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <circle cx="24" cy="30" r="2.6" fill="#fff" opacity=".35" />
    </svg>
  );
}

function BarnStyles() {
  return (
    <style>{`
      .ts-stage button{font:inherit;border:0;margin:0;padding:0;cursor:pointer;background:none;color:inherit}
      .ts-mover{position:absolute;bottom:${BOTTOM}%;transform:translateX(-50%);z-index:2}
      .ts-pet{display:block;width:100%;-webkit-tap-highlight-color:transparent;border-radius:16px}
      .ts-pet:focus-visible{outline:3px solid #fde047;outline-offset:4px}
      .ts-flip{transform-origin:50% 100%;transition:transform .22s ease}
      .ts-fx,.ts-bob{transform-origin:50% 100%;position:relative}
      .ts-shadow{position:absolute;left:50%;bottom:-1.2%;width:80%;height:clamp(7px,1.7vw,16px);border-radius:50%;background:rgba(60,30,5,.32);filter:blur(3px);transform:translateX(-50%)}
      .ts-cow{display:block;max-width:100%;height:auto;user-select:none;-webkit-user-drag:none;transform-origin:50% 100%;animation:ts-breathe var(--ts-dur,3.2s) ease-in-out infinite}
      .ts-acc{position:absolute;transform:translate(-50%,-55%);line-height:1;filter:drop-shadow(0 2px 2px rgba(0,0,0,.35));pointer-events:none}
      @keyframes ts-breathe{0%,100%{transform:scale(1,1)}50%{transform:scale(calc(1 + var(--ts-a,.03)*.5),calc(1 + var(--ts-a,.03)))}}
      @keyframes ts-pop{0%{transform:scale(1)}30%{transform:scale(1.12,.9)}55%{transform:scale(.96,1.08)}100%{transform:scale(1)}}
      @keyframes ts-heal{0%{filter:drop-shadow(0 0 0 rgba(16,185,129,0))}40%{filter:drop-shadow(0 0 22px rgba(16,185,129,.95))}100%{filter:drop-shadow(0 0 0 rgba(16,185,129,0))}}
      @keyframes ts-evolve{0%{transform:scale(.8);filter:brightness(2)}50%{transform:scale(1.15);filter:brightness(1.3)}100%{transform:scale(1);filter:none}}
      @keyframes ts-swap{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
      .ts-fx.ts-fx--pop{animation:ts-pop .5s ease-out}
      .ts-fx.ts-fx--heal{animation:ts-heal .9s ease-out}
      .ts-fx.ts-fx--evolve{animation:ts-evolve .8s ease-out}
      .ts-fx.ts-fx--swap{animation:ts-swap .3s ease-out}
      .ts-emote{position:absolute;bottom:84%;left:50%;transform:translateX(-50%);pointer-events:none;opacity:0;font-weight:900;font-size:clamp(18px,3.4vw,32px);line-height:1;white-space:nowrap;text-shadow:0 1px 0 #fff,0 -1px 0 #fff,1px 0 0 #fff,-1px 0 0 #fff,0 2px 6px rgba(0,0,0,.2)}
      @keyframes ts-emote{0%{opacity:0;transform:translate(-50%,10px) scale(.5)}15%{opacity:1;transform:translate(-50%,0) scale(1.15)}25%{transform:translate(-50%,0) scale(1)}80%{opacity:1;transform:translate(-50%,-14px)}100%{opacity:0;transform:translate(-50%,-22px)}}
      @keyframes ts-emote-loop{0%{opacity:0;transform:translate(-50%,6px)}25%{opacity:1}75%{opacity:1;transform:translate(-50%,-16px)}100%{opacity:0;transform:translate(-50%,-22px)}}
      .ts-emote.is-on{animation:ts-emote 1.7s ease-out forwards}
      .ts-emote.is-loop{animation:ts-emote-loop 2.4s ease-in-out infinite}
      .ts-drop{display:inline-block;width:.5em;height:.5em;background:#38bdf8;border-radius:0 50% 50% 50%;transform:rotate(45deg);box-shadow:inset -2px -2px 0 rgba(255,255,255,.6);margin:0 .1em}
      .ts-hay{position:absolute;bottom:6.5%;width:9%;transform:translateX(-50%);transition:opacity .3s,transform .3s;z-index:1}
      .ts-hay-emoji{position:absolute;left:50%;top:-20%;transform:translateX(-50%);font-size:2.6cqw;line-height:1}
      @keyframes ts-drop{from{opacity:0;transform:translate(-50%,-160%)}to{opacity:1;transform:translate(-50%,0)}}
      .ts-hay.is-drop{animation:ts-drop .45s cubic-bezier(.3,1.5,.5,1)}
      .ts-hay.is-gone{opacity:0;transform:translateX(-50%) scale(.5)}
      .ts-poop{position:absolute;bottom:3.5%;width:6.5%;transform:translateX(-50%);z-index:3;transition:opacity .35s,transform .35s;-webkit-tap-highlight-color:transparent}
      .ts-poop:hover{transform:translateX(-50%) scale(1.1)}
      .ts-poop.is-gone{opacity:0;transform:translate(-50%,-30px) scale(.3) rotate(40deg);pointer-events:none}
      .ts-stink{position:absolute;left:50%;bottom:85%;color:#65a30d;font-size:2.2cqw;font-weight:900;transform:translateX(-50%) rotate(90deg);animation:ts-stink 1.6s ease-in-out infinite;opacity:.8}
      @keyframes ts-stink{0%,100%{transform:translate(-50%,0) rotate(90deg);opacity:.2}50%{transform:translate(-50%,-6px) rotate(90deg);opacity:.9}}
      .ts-bucket{position:absolute;bottom:3%;transform:translateX(-50%);z-index:4;animation:ts-swap .3s ease-out}
      .ts-milkdrop{position:absolute;width:1.3cqw;height:1.8cqw;background:#fffdf5;border-radius:50% 50% 50% 50%/60% 60% 40% 40%;box-shadow:0 0 0 1px rgba(14,116,144,.35);transform:translateX(-50%);animation:ts-milkdrop .55s ease-in forwards;z-index:5}
      @keyframes ts-milkdrop{from{opacity:1;transform:translate(-50%,0)}to{opacity:.2;transform:translate(-50%,7cqw)}}
      .ts-broom{position:absolute;bottom:2%;left:-12%;font-size:7cqw;line-height:1;pointer-events:none;z-index:5;opacity:0}
      .ts-broom.is-on{animation:ts-broom 1.1s ease-in-out forwards}
      @keyframes ts-broom{0%{opacity:1;left:-10%;transform:rotate(-20deg)}25%{transform:rotate(15deg)}50%{transform:rotate(-15deg)}75%{transform:rotate(15deg)}95%{opacity:1}100%{opacity:0;left:100%;transform:rotate(-10deg)}}
      @keyframes ts-float{0%{opacity:0;transform:translate(calc(-50% + var(--dx,0px)),0) scale(.8)}15%{opacity:1}100%{opacity:0;transform:translate(calc(-50% + var(--dx,0px)),-72px) scale(1.05)}}
      .ts-float{position:absolute;font-weight:800;font-size:1.05rem;white-space:nowrap;pointer-events:none;transform:translateX(-50%);animation:ts-float 1.4s ease-out forwards;z-index:6;text-shadow:0 1px 0 #fff,0 -1px 0 #fff,1px 0 0 #fff,-1px 0 0 #fff,0 2px 6px rgba(0,0,0,.25)}
      .ts-float--gain{color:#15803d}.ts-float--heal{color:#0f766e}.ts-float--loss{color:#dc2626}.ts-float--warn{color:#b45309}.ts-float--coin{color:#a16207}.ts-float--heart{color:#e11d48;font-size:1.25rem}
      .ts-toast{border-radius:9999px;background:rgba(255,255,255,.96);padding:.375rem 1rem;font-size:.875rem;font-weight:700;box-shadow:0 10px 15px -3px rgba(0,0,0,.2);text-align:center;max-width:100%}
      .ts-toast.hidden{display:none}
      .ts-toast--ok{color:#047857}.ts-toast--warn{color:#b45309}.ts-toast--bad{color:#be123c}.ts-toast--info{color:#0369a1}
      @keyframes ts-toast-in{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}
      .ts-toast-in{animation:ts-toast-in .25s ease-out}
      @keyframes ts-flicker{0%,100%{opacity:.9}45%{opacity:.7}60%{opacity:1}}
      .ts-lamp-glow{animation:ts-flicker 3.5s ease-in-out infinite}
      @media (prefers-reduced-motion: reduce){
        .ts-cow,.ts-fx,.ts-lamp-glow,.ts-hay,.ts-stink,.ts-broom.is-on,.ts-bucket{animation:none!important}
        .ts-flip{transition:none}
        .ts-float{animation-name:none;opacity:1}
        .ts-emote.is-on,.ts-emote.is-loop{animation:none;opacity:1}
      }
    `}</style>
  );
}
