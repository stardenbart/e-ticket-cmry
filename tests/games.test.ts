import { describe, expect, it } from "vitest";
import { COLS, ENTRIES, MAX_SCORE, ROWS, buildGrid, normalizeAnswer, publicPuzzle } from "@/lib/games/tts-puzzle";
import { SHIRT_SIZES } from "@/lib/employee-shared";
import { evaluate, nextResetAt, pointsFor, puzzleNo, wibDay, wordOf } from "@/lib/games/moordle-words";

describe("TTS Mooniverse", () => {
  it("grid 13×10, semua persilangan cocok", () => {
    const g = buildGrid();
    expect(g.length).toBe(ROWS);
    expect(g[0].length).toBe(COLS);
  });
  it("nomor soal sesuai desain (1–10 di posisi yang sama dengan gambar panitia)", () => {
    const pos = Object.fromEntries(ENTRIES.map((e) => [e.num, `${e.row},${e.col}`]));
    expect(pos).toEqual({ 1: "0,1", 2: "0,7", 3: "0,10", 4: "1,0", 5: "1,6", 6: "2,12", 7: "3,8", 8: "4,1", 9: "6,0", 10: "9,1" });
  });
  it("jawaban panitia terpasang", () =>
    expect(ENTRIES.map((e) => e.answer).sort()).toEqual(["EMAS", "HELM", "KIPASANGIN", "KULKAS", "MESINCUCI", "MOTOR", "SEPEDA", "SMARTWATCH", "TV", "VACUUMCLEANER"]));
  it("10 soal × 10 poin = 100", () => expect(MAX_SCORE).toBe(100));
  it("data untuk browser tidak memuat jawaban", () => {
    const json = JSON.stringify(publicPuzzle());
    for (const e of ENTRIES) expect(json).not.toContain(e.answer);
  });
  it("pencocokan jawaban abaikan huruf kecil, spasi, dan tanda baca", () => {
    expect(normalizeAnswer("mesin cuci")).toBe("MESINCUCI");
    expect(normalizeAnswer("Vacuum-Cleaner")).toBe("VACUUMCLEANER");
  });
});

describe("Ukuran baju", () => {
  it("dimulai dari S (tanpa 2S/3S/4S/XS)", () => {
    expect(SHIRT_SIZES[0]).toBe("S");
    expect(SHIRT_SIZES).not.toContain("XS");
    expect(SHIRT_SIZES).not.toContain("2S");
  });
});

describe("Moordle", () => {
  it("evaluasi huruf: hijau, kuning, abu-abu (huruf ganda dihitung benar)", () => {
    expect(evaluate("PERAH", "PERAH")).toEqual(["c", "c", "c", "c", "c"]);
    expect(evaluate("LABEL", "BOTOL")).toEqual(["a", "a", "p", "a", "c"]);
    expect(evaluate("LOBAK", "BOTOL")).toEqual(["p", "c", "p", "a", "a"]);
    expect(evaluate("KOKOK", "KOCOK")).toEqual(["c", "c", "a", "c", "c"]);
  });
  it("poin harian 60 → 10, gagal 0", () => {
    expect([1, 2, 3, 4, 5, 6].map(pointsFor)).toEqual([60, 50, 40, 30, 20, 10]);
    expect(pointsFor(7)).toBe(0);
  });
  it("hari berganti pukul 00:00 WIB; 27 Okt 2026 = #1", () => {
    const d = wibDay(Date.parse("2026-10-27T00:00:00+07:00"));
    expect(puzzleNo(d)).toBe(1);
    expect(wibDay(Date.parse("2026-10-27T23:59:59+07:00"))).toBe(d);
    expect(wibDay(Date.parse("2026-10-28T00:00:00+07:00"))).toBe(d + 1);
    expect(nextResetAt(d)).toBe(Date.parse("2026-10-28T00:00:00+07:00"));
  });
  it("kata tidak berulang selama 45 hari berturut-turut", () => {
    const d = wibDay(Date.parse("2026-10-27T12:00:00+07:00"));
    const words = Array.from({ length: 45 }, (_, i) => wordOf(d + i).word);
    expect(new Set(words).size).toBe(45);
    expect(words.every((w) => w.length === 5)).toBe(true);
  });
});
