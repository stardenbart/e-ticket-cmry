import { describe, expect, it } from "vitest";
import { FEEDS, MAX_KG, MAX_STOCK, MEDICINE, OUTFITS, OUTFIT_KEYS, act, advance, hearts, moodOf, newFarm, slotWindow, stageOf, wibDayOf, type FarmState } from "@/lib/ternak/engine";
import { ARCADE_RATE, arcadeCoins, moordleCoins, ttsCoins } from "@/lib/ternak/earn";

const T = (s: string) => Date.parse(s);
const noLuck = () => 0.999; // tidak pernah sakit, susu grade terendah yang mungkin
const day = wibDayOf(T("2026-11-02T12:00:00+07:00"));

function farm(coins = 1000): FarmState {
  const f = newFarm(T("2026-11-02T08:00:00+07:00"));
  f.coins = coins;
  return f;
}

describe("Moo-coins dari poin games", () => {
  it("TTS: 150 + 3 × skor, bonus kecepatan bila sempurna", () => {
    expect(ttsCoins(0, 100_000, false)).toBe(150);
    expect(ttsCoins(70, 100_000, false)).toBe(360);
    expect(ttsCoins(100, 120_000, true)).toBe(500);
    expect(ttsCoins(100, 240_000, true)).toBe(475);
  });
  it("Moordle: makin cepat tertebak makin banyak", () => {
    expect(moordleCoins(true, 1, 30_000)).toBe(140);
    expect(moordleCoins(true, 3, 120_000)).toBe(90);
    expect(moordleCoins(true, 6, 600_000)).toBe(30);
    expect(moordleCoins(false, 6, 10_000)).toBe(0);
  });
  it("arkade: batas harian tiap game setara ±60 koin, Flappy kurs tertinggi", () => {
    for (const g of Object.keys(ARCADE_RATE) as (keyof typeof ARCADE_RATE)[]) expect(arcadeCoins(g, ARCADE_RATE[g].dailyCap)).toBeGreaterThanOrEqual(58);
    expect(arcadeCoins("flappy", 10)).toBe(8);
    expect(arcadeCoins("race", 1000)).toBe(4);
  });
});

describe("Ternak sapi", () => {
  it("hiasan kepala: beli sekali (+afeksi), pakai salah satu, bisa diganti/dilepas", () => {
    expect(OUTFIT_KEYS.length).toBeGreaterThanOrEqual(7);
    const f = farm(5000);
    const t = T("2026-11-02T09:00:00+07:00");
    act(f, { type: "buyOutfit", outfit: "headset" }, t, noLuck);
    expect(f.affection).toBe(30 + OUTFITS.headset.aff);
    expect(f.s.wear).toBe("headset");
    act(f, { type: "buyOutfit", outfit: "mahkota" }, t, noLuck);
    expect(f.s.wear).toBe("mahkota");
    expect(f.coins).toBe(5000 - OUTFITS.headset.price - OUTFITS.mahkota.price);
    expect(() => act(f, { type: "buyOutfit", outfit: "headset" }, t, noLuck)).toThrow(/sudah dimiliki/);
    act(f, { type: "wear", outfit: "headset" }, t, noLuck);
    expect(f.s.wear).toBe("headset");
    expect(() => act(f, { type: "wear", outfit: "topi" }, t, noLuck)).toThrow(/belum dimiliki/);
    act(f, { type: "wear", outfit: null }, t, noLuck);
    expect(f.s.wear).toBeNull();
  });
  it("lumbung: beli pakan kapan saja, makan memakai stok dulu (tanpa bayar lagi)", () => {
    const f = farm();
    act(f, { type: "buyFeed", feed: "supernova", qty: 3 }, T("2026-11-02T09:00:00+07:00"), noLuck);
    expect(f.coins).toBe(1000 - 3 * FEEDS.supernova.price);
    expect(f.s.inv?.supernova).toBe(3);
    act(f, { type: "feed", feed: "supernova" }, T("2026-11-02T12:00:00+07:00"), noLuck);
    expect(f.s.inv?.supernova).toBe(2);
    expect(f.coins).toBe(1000 - 3 * FEEDS.supernova.price);
    expect(() => act(f, { type: "buyFeed", feed: "supernova", qty: MAX_STOCK }, T("2026-11-02T13:00:00+07:00"), noLuck)).toThrow(/Lumbung penuh/);
    expect(() => act(farm(50), { type: "buyFeed", feed: "nebula", qty: 2 }, T("2026-11-02T13:00:00+07:00"), noLuck)).toThrow(/kurang/);
  });
  it("berat tidak melewati batas maksimal", () => {
    const f = farm();
    f.kg = MAX_KG - 5;
    const r = act(f, { type: "feed", feed: "supernova" }, T("2026-11-02T12:00:00+07:00"), noLuck);
    expect(f.kg).toBe(MAX_KG);
    expect(r.note).toMatch(/\+5 kg/);
    act(f, { type: "feed", feed: "supernova" }, T("2026-11-02T17:00:00+07:00"), noLuck);
    expect(f.kg).toBe(MAX_KG);
  });
  it("makan hanya saat jadwal, sekali per jadwal; berat & kotoran bertambah", () => {
    const f = farm();
    expect(() => act(f, { type: "feed", feed: "nebula" }, T("2026-11-02T10:00:00+07:00"), noLuck)).toThrow(/Belum jadwal makan/);
    act(f, { type: "feed", feed: "supernova" }, T("2026-11-02T12:00:00+07:00"), noLuck);
    expect(f.kg).toBe(50 + FEEDS.supernova.kg);
    expect(f.dirt).toBe(1);
    expect(f.coins).toBe(1000 - FEEDS.supernova.price);
    expect(() => act(f, { type: "feed", feed: "nebula" }, T("2026-11-02T12:30:00+07:00"), noLuck)).toThrow(/sudah makan/);
  });
  it("jadwal makan terlewat → lapar (berat & afeksi turun), sapi sedih", () => {
    const f = farm();
    advance(f, T("2026-11-02T14:00:00+07:00"), noLuck);
    expect(f.kg).toBe(50); // tidak di bawah berat minimum
    expect(f.affection).toBe(30 - 6);
    expect(moodOf(f, T("2026-11-02T14:00:00+07:00"))).toBe("sedih");
  });
  it("sakit: tidak mau makan, berat turun lebih cepat, sembuh dengan obat", () => {
    const f = farm();
    f.kg = 120;
    f.sick = true;
    expect(() => act(f, { type: "feed", feed: "nebula" }, T("2026-11-02T12:00:00+07:00"), noLuck)).toThrow(/tidak mau makan/);
    advance(f, T("2026-11-02T14:00:00+07:00"), noLuck);
    expect(f.kg).toBe(116);
    act(f, { type: "medicine" }, T("2026-11-02T15:00:00+07:00"), noLuck);
    expect(f.sick).toBe(false);
    expect(f.coins).toBe(1000 - MEDICINE.price);
    expect(moodOf(f, T("2026-11-02T15:00:00+07:00"))).not.toBe("sakit");
  });
  it("kandang kotor menaikkan peluang sakit", () => {
    // Sapi makan Silase Nebula (faktor 1,0), angka acak 0,1: kotoran 1 → risiko 5% (sehat); kotoran 3 → 25% (sakit).
    const sickAt = (dirt: number) => {
      const f = farm();
      f.dirt = dirt;
      act(f, { type: "feed", feed: "nebula" }, T("2026-11-02T12:00:00+07:00"), noLuck);
      advance(f, T("2026-11-02T14:00:00+07:00"), () => 0.1);
      return f.sick;
    };
    expect(sickAt(0)).toBe(false);
    expect(sickAt(3)).toBe(true);
  });
  it("tahap & gambar mengikuti berat; afeksi → hati", () => {
    expect(stageOf(50).key).toBe("pedet");
    expect(stageOf(150).key).toBe("remaja");
    expect(stageOf(300).key).toBe("dewasa");
    expect([0, 20, 21, 60, 100].map(hearts)).toEqual([1, 1, 2, 3, 5]);
  });
  it("panen hanya malam, sekali sehari; Pedet maksimal 250 ml", () => {
    const f = farm();
    f.affection = 100;
    expect(() => act(f, { type: "harvest" }, T("2026-11-02T18:00:00+07:00"), noLuck)).toThrow(/Perah susu hanya/);
    const r = act(f, { type: "harvest" }, T("2026-11-02T20:00:00+07:00"), () => 0.99);
    expect(r.milk!.ml).toBeLessThanOrEqual(250);
    expect(() => act(f, { type: "harvest" }, T("2026-11-02T21:00:00+07:00"), noLuck)).toThrow(/sudah diperah/);
  });
  it("Grade S: hanya sapi Dewasa 5♥ dengan 2× Konsentrat Supernova; dijamin setelah 7 hari", () => {
    const f = farm(10_000);
    f.kg = 400;
    f.affection = 100;
    f.s.fed = { [`${day}-1`]: "supernova", [`${day}-2`]: "supernova" };
    f.s.pity = 7;
    const r = act(f, { type: "harvest" }, T("2026-11-02T20:00:00+07:00"), () => 0);
    expect(r.milk!.grade).toBe("S");
    const g = farm(10_000);
    g.kg = 400;
    g.affection = 100;
    g.s.fed = { [`${day}-1`]: "nebula", [`${day}-2`]: "supernova" };
    g.s.pity = 7;
    expect(act(g, { type: "harvest" }, T("2026-11-02T20:00:00+07:00"), () => 0.9999).milk!.grade).not.toBe("S");
  });
  it("simulasi tidak berjalan sebelum periode dimulai", () => {
    const f = farm();
    const start = slotWindow(day, 2).end + 1;
    advance(f, T("2026-11-02T19:00:00+07:00"), noLuck, start);
    expect(f.affection).toBe(30);
  });
});

describe("Sapi baru", () => {
  it("jadwal makan sebelum sapi dipelihara tidak membuatnya lapar/sedih", () => {
    const f = farm();
    f.s.since = T("2026-11-02T08:00:00+07:00");
    expect(moodOf(f, T("2026-11-02T09:00:00+07:00"))).toBe("senang");
  });
});
