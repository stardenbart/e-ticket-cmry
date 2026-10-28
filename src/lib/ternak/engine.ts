// Grow your Cow, Grow your Country — aturan & simulasi ternak (murni, tanpa database; aman diuji).
//
// Waktu dihitung "malas" (lazy): setiap kali peternak membuka kandang / beraksi, simulasi dimajukan dari
// `tickAt` sampai sekarang (atau sampai akhir periode games). Kejadian acak (sakit, grade susu) memakai
// angka acak deterministik per sapi per jadwal, jadi hasilnya tidak berubah walau dihitung ulang.

// ---------------------------------------------------------------------------
// Katalog
// ---------------------------------------------------------------------------

export type FeedKey = "asteroid" | "nebula" | "supernova";
export const FEEDS: Record<FeedKey, { name: string; grade: string; price: number; kg: number; aff: number; risk: number; emoji: string; desc: string }> = {
  asteroid: { name: "Rumput Asteroid", grade: "Low", price: 20, kg: 3, aff: 2, risk: 1.6, emoji: "🌾", desc: "Murah dan mengenyangkan, tapi sapi lebih mudah sakit." },
  nebula: { name: "Silase Nebula", grade: "Medium", price: 45, kg: 6, aff: 2, risk: 1.0, emoji: "🥬", desc: "Pakan harian seimbang." },
  supernova: { name: "Konsentrat Supernova", grade: "High", price: 90, kg: 10, aff: 3, risk: 0.5, emoji: "✨", desc: "Berat naik paling banyak, sapi paling jarang sakit. Syarat susu Grade S." },
};
export const FEED_KEYS = Object.keys(FEEDS) as FeedKey[];

export const MEDICINE = { name: "Ramuan MooVita", price: 300, emoji: "🧪", desc: "Satu-satunya obat di Mooniverse. Langsung menyembuhkan sapi yang sakit." };

export type OutfitKey = "bandana" | "bomber" | "jubah";
export const OUTFITS: Record<OutfitKey, { name: string; price: number; aff: number; emoji: string }> = {
  bandana: { name: "Bandana Neon Rider", price: 500, aff: 5, emoji: "🎀" },
  bomber: { name: "Jaket Bomber Galaksi", price: 1000, aff: 10, emoji: "🧥" },
  jubah: { name: "Jubah Raja Mooniverse", price: 2000, aff: 15, emoji: "👑" },
};
export const OUTFIT_KEYS = Object.keys(OUTFITS) as OutfitKey[];

/** Grade susu: makin tinggi hati, makin besar peluang grade tinggi. */
export const MILK = [
  { ml: 65, grade: "E", price: 10 },
  { ml: 125, grade: "D", price: 25 },
  { ml: 225, grade: "C", price: 50 },
  { ml: 250, grade: "B", price: 60 },
  { ml: 750, grade: "A", price: 180 },
  { ml: 950, grade: "S", price: 400 },
] as const;
/** Peluang tiap grade (urutan sama dengan MILK) per jumlah hati 1–5. */
export const MILK_TABLE: Record<number, number[]> = {
  1: [0.7, 0.3, 0, 0, 0, 0],
  2: [0.3, 0.5, 0.2, 0, 0, 0],
  3: [0, 0.35, 0.45, 0.2, 0, 0],
  4: [0, 0, 0.35, 0.45, 0.2, 0],
  5: [0, 0, 0, 0.35, 0.57, 0.08],
};
/** Jaminan Grade S: setelah sekian hari memenuhi syarat tanpa S, panen berikutnya pasti S. */
export const S_PITY_DAYS = 7;

export const STAGES = [
  { key: "pedet", name: "Pedet", minKg: 0, maxMilk: 250 },
  { key: "remaja", name: "Remaja", minKg: 150, maxMilk: 750 },
  { key: "dewasa", name: "Dewasa", minKg: 300, maxMilk: 950 },
] as const;
export const START_KG = 50;
export const MIN_KG = 50;
export const START_AFF = 30;

/** Peluang sakit per jadwal makan menurut tumpukan kotoran (0–3), dikali faktor pakan. */
export const DIRT_RISK = [0.02, 0.05, 0.12, 0.25];
export const MAX_DIRT = 3;

export const PENALTY = { hungryKg: 2, hungryAff: 6, sickKg: 4, sickAff: 5, sickOnsetAff: 5, dirtyAff: 3, missAff: 1 };
export const BONUS = { clean: 2, pet: 1, play: 1 };

// ---------------------------------------------------------------------------
// Waktu (WIB)
// ---------------------------------------------------------------------------

const DAY = 86_400_000;
const HOUR = 3_600_000;
const WIB = 7 * HOUR;
export const wibDayOf = (ms: number) => Math.floor((ms + WIB) / DAY);
const at = (day: number, h: number, m = 0) => day * DAY - WIB + h * HOUR + m * 60_000;

export const SLOTS = [
  { slot: 1, label: "Makan siang", start: [11, 30], end: [13, 30] },
  { slot: 2, label: "Makan sore", start: [16, 0], end: [18, 30] },
] as const;
export const HARVEST = { label: "Panen susu", start: [19, 0], end: [24, 0] } as const;

export const slotWindow = (day: number, slot: 1 | 2) => {
  const s = SLOTS[slot - 1];
  return { start: at(day, s.start[0], s.start[1]), end: at(day, s.end[0], s.end[1]) };
};
export const harvestWindow = (day: number) => ({ start: at(day, HARVEST.start[0]), end: at(day, HARVEST.end[0]) });
const fmtHM = (h: number, m: number) => `${String(h).padStart(2, "0")}.${String(m).padStart(2, "0")}`;
export const SCHEDULE_TEXT = [
  ...SLOTS.map((s) => `${s.label} ${fmtHM(s.start[0], s.start[1])}–${fmtHM(s.end[0], s.end[1])}`),
  `${HARVEST.label} ${fmtHM(HARVEST.start[0], 0)}–23.59`,
];

/** Jadwal yang sedang berlangsung saat ini. */
export function currentWindow(now: number): { kind: "feed"; slot: 1 | 2; end: number } | { kind: "harvest"; end: number } | null {
  const day = wibDayOf(now);
  for (const slot of [1, 2] as const) {
    const w = slotWindow(day, slot);
    if (now >= w.start && now < w.end) return { kind: "feed", slot, end: w.end };
  }
  const h = harvestWindow(day);
  if (now >= h.start && now < h.end) return { kind: "harvest", end: h.end };
  return null;
}

/** Jadwal berikutnya setelah `now` (untuk hitung mundur di layar). */
export function nextWindow(now: number) {
  const out: { label: string; start: number }[] = [];
  for (let d = wibDayOf(now); d <= wibDayOf(now) + 1; d++) {
    for (const slot of [1, 2] as const) out.push({ label: SLOTS[slot - 1].label, start: slotWindow(d, slot).start });
    out.push({ label: HARVEST.label, start: harvestWindow(d).start });
  }
  return out.filter((w) => w.start > now).sort((a, b) => a.start - b.start)[0];
}

// ---------------------------------------------------------------------------
// Keadaan sapi
// ---------------------------------------------------------------------------

export type LogEntry = { at: number; text: string; tone: "good" | "bad" | "info" };

export type FarmState = {
  kg: number;
  affection: number; // 0–100
  dirt: number; // 0–3 tumpukan
  sick: boolean;
  tickAt: number; // simulasi sudah dihitung sampai waktu ini (ms)
  milkTotal: number; // ml
  bestMilk: number; // ml
  coins: number;
  s: {
    fed?: Record<string, FeedKey>; // "hari-slot" → pakan
    pet?: number; // hari terakhir dielus
    play?: number; // hari terakhir main game (bonus afeksi)
    harvest?: number; // hari terakhir panen
    pity?: number;
    outfits?: OutfitKey[];
    wear?: OutfitKey | null;
    log?: LogEntry[];
  };
};

export const hearts = (aff: number) => Math.max(1, Math.min(5, Math.ceil(aff / 20)));
export const stageOf = (kg: number) => [...STAGES].reverse().find((s) => kg >= s.minKg)!;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const slotKey = (day: number, slot: number) => `${day}-${slot}`;

export function newFarm(now: number): FarmState {
  return { kg: START_KG, affection: START_AFF, dirt: 0, sick: false, tickAt: now, milkTotal: 0, bestMilk: 0, coins: 0, s: { log: [] } };
}

function log(f: FarmState, at: number, text: string, tone: LogEntry["tone"] = "info") {
  f.s.log = [{ at, text, tone }, ...(f.s.log ?? [])].slice(0, 30);
}

function norm(f: FarmState) {
  f.affection = clamp(Math.round(f.affection), 0, 100);
  f.kg = Math.max(MIN_KG, Math.round(f.kg * 10) / 10);
  f.dirt = clamp(f.dirt, 0, MAX_DIRT);
}

/** Angka acak deterministik [0,1) dari kunci (per sapi per kejadian). */
export type Rand = (key: string) => number;

/**
 * Majukan simulasi sampai `to`. Kejadian yang diproses berurutan:
 *   akhir jadwal makan → lapar/sakit + peluang jatuh sakit;  pergantian hari → rindu (−1 afeksi).
 */
export function advance(f: FarmState, to: number, rand: Rand, startAt = 0): FarmState {
  if (to <= f.tickAt) return f;
  const events: { t: number; kind: "slot"; day: number; slot: 1 | 2 }[] = [];
  const dayEnds: number[] = [];
  for (let d = wibDayOf(f.tickAt); d <= wibDayOf(to); d++) {
    for (const slot of [1, 2] as const) {
      const end = slotWindow(d, slot).end;
      if (end > f.tickAt && end <= to && end > startAt) events.push({ t: end, kind: "slot", day: d, slot });
    }
    const de = (d + 1) * DAY - WIB;
    if (de > f.tickAt && de <= to && de > startAt) dayEnds.push(de);
  }
  const all = [...events.map((e) => ({ ...e })), ...dayEnds.map((t) => ({ t, kind: "day" as const }))].sort((a, b) => a.t - b.t);
  for (const e of all) {
    if (e.kind === "day") {
      f.affection -= PENALTY.missAff;
      continue;
    }
    const key = slotKey(e.day, e.slot);
    const fed = f.s.fed?.[key];
    const label = SLOTS[e.slot - 1].label.toLowerCase();
    if (f.sick) {
      f.kg -= PENALTY.sickKg;
      f.affection -= PENALTY.sickAff;
      log(f, e.t, `Sapi masih sakit saat jadwal ${label} — berat turun ${PENALTY.sickKg} kg.`, "bad");
    } else if (!fed) {
      f.kg -= PENALTY.hungryKg;
      f.affection -= PENALTY.hungryAff;
      log(f, e.t, `Jadwal ${label} terlewat — sapi kelaparan (−${PENALTY.hungryKg} kg).`, "bad");
    }
    if (f.dirt >= MAX_DIRT) f.affection -= PENALTY.dirtyAff;
    if (!f.sick) {
      const risk = (DIRT_RISK[f.dirt] + (fed ? 0 : 0.05)) * (fed ? FEEDS[fed].risk : 1.5);
      if (rand(`sick:${key}`) < risk) {
        f.sick = true;
        f.affection -= PENALTY.sickOnsetAff;
        log(f, e.t, `Sapi jatuh sakit 🤒${f.dirt ? " — kandang kotor bikin mudah sakit" : ""}. Beri ${MEDICINE.name}.`, "bad");
      }
    }
    norm(f);
  }
  // Buang catatan pakan lama (> 2 hari).
  const keep = wibDayOf(to) - 2;
  if (f.s.fed) f.s.fed = Object.fromEntries(Object.entries(f.s.fed).filter(([k]) => Number(k.split("-")[0]) >= keep));
  f.tickAt = to;
  norm(f);
  return f;
}

// ---------------------------------------------------------------------------
// Aksi peternak
// ---------------------------------------------------------------------------

export class FarmError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

export type Action =
  | { type: "feed"; feed: FeedKey }
  | { type: "clean" }
  | { type: "pet" }
  | { type: "medicine" }
  | { type: "harvest" }
  | { type: "buyOutfit"; outfit: OutfitKey }
  | { type: "wear"; outfit: OutfitKey | null };

export type ActionResult = { spent: number; earned: number; note: string; milk?: (typeof MILK)[number] };

/** Jalankan satu aksi pada waktu `now` (simulasi harus sudah dimajukan ke `now`). Mengubah `f`. */
export function act(f: FarmState, a: Action, now: number, rand: Rand): ActionResult {
  const day = wibDayOf(now);
  const pay = (price: number) => {
    if (f.coins < price) throw new FarmError("NOT_ENOUGH_COINS", `Moo-coins kurang — butuh ${price}, punya ${f.coins}.`);
    f.coins -= price;
  };
  let r: ActionResult;
  switch (a.type) {
    case "feed": {
      const w = currentWindow(now);
      if (!w || w.kind !== "feed") throw new FarmError("NOT_FEEDING_TIME", `Belum jadwal makan. Jadwal: ${SCHEDULE_TEXT.slice(0, 2).join(", ")}.`);
      const key = slotKey(day, w.slot);
      if (f.s.fed?.[key]) throw new FarmError("ALREADY_FED", "Sapi sudah makan di jadwal ini.");
      if (f.sick) throw new FarmError("COW_SICK", `Sapi sakit dan tidak mau makan. Beri ${MEDICINE.name} dulu.`);
      const feed = FEEDS[a.feed];
      pay(feed.price);
      f.s.fed = { ...(f.s.fed ?? {}), [key]: a.feed };
      f.kg += feed.kg;
      f.affection += feed.aff;
      f.dirt = Math.min(MAX_DIRT, f.dirt + 1);
      r = { spent: feed.price, earned: 0, note: `Makan ${feed.name} (+${feed.kg} kg)` };
      log(f, now, `${feed.emoji} Sapi melahap ${feed.name} — berat +${feed.kg} kg.`, "good");
      break;
    }
    case "clean": {
      if (!f.dirt) throw new FarmError("ALREADY_CLEAN", "Kandang sudah bersih.");
      f.dirt = 0;
      f.affection += BONUS.clean;
      r = { spent: 0, earned: 0, note: "Kandang dibersihkan" };
      log(f, now, "🧹 Kandang bersih kinclong — sapi senang.", "good");
      break;
    }
    case "pet": {
      if (f.s.pet === day) throw new FarmError("ALREADY_PET", "Sapi sudah dielus hari ini. Besok lagi ya!");
      f.s.pet = day;
      f.affection += BONUS.pet;
      r = { spent: 0, earned: 0, note: "Elus sapi" };
      log(f, now, "💕 Sapi dielus — afeksi naik.", "good");
      break;
    }
    case "medicine": {
      if (!f.sick) throw new FarmError("NOT_SICK", "Sapi sehat, tidak perlu obat.");
      pay(MEDICINE.price);
      f.sick = false;
      r = { spent: MEDICINE.price, earned: 0, note: `Beli ${MEDICINE.name}` };
      log(f, now, `${MEDICINE.emoji} ${MEDICINE.name} bekerja — sapi sembuh!`, "good");
      break;
    }
    case "harvest": {
      const w = currentWindow(now);
      if (!w || w.kind !== "harvest") throw new FarmError("NOT_HARVEST_TIME", `Panen susu hanya ${SCHEDULE_TEXT[2]}.`);
      if (f.s.harvest === day) throw new FarmError("ALREADY_HARVESTED", "Susu hari ini sudah dipanen.");
      if (f.sick) throw new FarmError("COW_SICK", "Sapi sakit tidak menghasilkan susu. Obati dulu.");
      f.s.harvest = day;
      const h = hearts(f.affection);
      const cap = stageOf(f.kg).maxMilk;
      const fedToday = [1, 2].map((s) => f.s.fed?.[slotKey(day, s)]);
      const sEligible = h === 5 && cap === 950 && fedToday.every((x) => x === "supernova");
      const probs = [...MILK_TABLE[h]];
      if (!sEligible) probs[5] = 0;
      let idx: number;
      if (sEligible && (f.s.pity ?? 0) >= S_PITY_DAYS) idx = 5;
      else {
        const sum = probs.reduce((x, y) => x + y, 0);
        let roll = rand(`milk:${day}`) * sum;
        idx = probs.findIndex((p) => (roll -= p) < 0);
        if (idx < 0) for (let i = probs.length - 1; i >= 0; i--) if (probs[i] > 0) { idx = i; break; }
      }
      while (MILK[idx].ml > cap) idx--;
      const milk = MILK[idx];
      if (sEligible) f.s.pity = milk.grade === "S" ? 0 : (f.s.pity ?? 0) + 1;
      f.milkTotal += milk.ml;
      f.bestMilk = Math.max(f.bestMilk, milk.ml);
      f.coins += milk.price;
      r = { spent: 0, earned: milk.price, note: `Panen susu ${milk.ml} ml (Grade ${milk.grade})`, milk };
      log(f, now, `🥛 Panen ${milk.ml} ml — Grade ${milk.grade}${milk.grade === "S" ? " ✨ LANGKA!" : ""} (+${milk.price} koin).`, "good");
      break;
    }
    case "buyOutfit": {
      const o = OUTFITS[a.outfit];
      if (f.s.outfits?.includes(a.outfit)) throw new FarmError("ALREADY_OWNED", "Baju ini sudah dimiliki.");
      pay(o.price);
      f.s.outfits = [...(f.s.outfits ?? []), a.outfit];
      f.s.wear = a.outfit;
      f.affection += o.aff;
      r = { spent: o.price, earned: 0, note: `Beli ${o.name}` };
      log(f, now, `${o.emoji} Sapi tampil gaya dengan ${o.name} (+${o.aff} afeksi).`, "good");
      break;
    }
    case "wear": {
      if (a.outfit && !f.s.outfits?.includes(a.outfit)) throw new FarmError("NOT_OWNED", "Baju ini belum dimiliki.");
      f.s.wear = a.outfit;
      r = { spent: 0, earned: 0, note: "Ganti baju" };
      break;
    }
  }
  norm(f);
  return r;
}

/** Bonus afeksi harian karena main game (sekali sehari). */
export function playBonus(f: FarmState, now: number) {
  const day = wibDayOf(now);
  if (f.s.play === day) return false;
  f.s.play = day;
  f.affection += BONUS.play;
  norm(f);
  return true;
}

// ---------------------------------------------------------------------------
// Tampilan
// ---------------------------------------------------------------------------

export type Mood = "senang" | "sedih" | "sakit";

/** Lapar = jadwal makan terakhir yang sudah lewat tidak diisi, atau jadwal sekarang belum diisi. */
export function isHungry(f: FarmState, now: number) {
  const day = wibDayOf(now);
  const w = currentWindow(now);
  if (w?.kind === "feed" && !f.s.fed?.[slotKey(day, w.slot)]) return true;
  const passed = [
    { d: day, s: 2 },
    { d: day, s: 1 },
    { d: day - 1, s: 2 },
  ].find(({ d, s }) => slotWindow(d, s as 1 | 2).end <= now);
  return !!passed && !f.s.fed?.[slotKey(passed.d, passed.s)];
}

export function moodOf(f: FarmState, now: number): Mood {
  if (f.sick) return "sakit";
  if (isHungry(f, now) || f.dirt >= 2 || hearts(f.affection) <= 1) return "sedih";
  return "senang";
}

export const MOOD_EMOJI: Record<Mood, string> = { senang: "😊", sedih: "😢", sakit: "🤒" };

/** Gelar peternak berdasarkan kondisi sapi. */
export function titleOf(f: Pick<FarmState, "kg" | "affection" | "bestMilk">) {
  const h = hearts(f.affection);
  const st = stageOf(f.kg).key;
  if (f.bestMilk >= 950) return { name: "Sultan Susu Galaksi", emoji: "🌌" };
  if (h === 5 && st === "dewasa") return { name: "Juragan Supernova", emoji: "🚀" };
  if (h >= 4 || st !== "pedet") return { name: "Koboi Nebula", emoji: "🤠" };
  if (h >= 2) return { name: "Peternak Santuy", emoji: "🌙" };
  return { name: "Gembala Rebahan", emoji: "🛌" };
}

/** Gambar sapi sesuai tahap & kondisi + skala halus dalam satu tahap (tiap kenaikan berat terlihat). */
export function spriteOf(f: Pick<FarmState, "kg">, mood: Mood) {
  const st = stageOf(f.kg);
  const idx = STAGES.findIndex((s) => s.key === st.key);
  const next = STAGES[idx + 1]?.minKg ?? st.minKg + 300;
  const within = clamp((f.kg - st.minKg) / (next - st.minKg), 0, 1);
  return { src: `/images/ternak/sapi-${st.key}-${mood}.webp`, scale: Math.round((0.82 + within * 0.18) * 100) / 100, stage: st };
}
