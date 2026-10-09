"use client";
// Umpan balik suara (WebAudio) + getaran untuk hasil scan.

let ctx: AudioContext | null = null;

function audio() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = "sine") {
  const a = audio();
  if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, a.currentTime + start);
  g.gain.exponentialRampToValueAtTime(0.35, a.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + start + dur);
  o.connect(g).connect(a.destination);
  o.start(a.currentTime + start);
  o.stop(a.currentTime + start + dur + 0.02);
}

/** Panggil saat interaksi pertama pengguna agar audio diizinkan browser. */
export function unlockAudio() {
  audio();
}

export function feedbackOk() {
  tone(880, 0, 0.12);
  tone(1320, 0.13, 0.16);
  navigator.vibrate?.(120);
}

export function feedbackError() {
  tone(240, 0, 0.22, "square");
  tone(180, 0.26, 0.3, "square");
  navigator.vibrate?.([200, 100, 200, 100, 300]);
}

export function feedbackAdmitted() {
  tone(1046, 0, 0.1);
  navigator.vibrate?.(60);
}
