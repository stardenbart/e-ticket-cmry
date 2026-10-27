// Teka-teki silang (TTS) Mooniverse — grid 13 kolom × 10 baris sesuai desain panitia.
// File ini hanya untuk SERVER (berisi kunci jawaban). Browser hanya menerima `publicPuzzle()`.
//
// Mengganti soal: ubah `answer`/`clue` di ENTRIES. Posisi (row, col, arah) mengikuti desain grid;
// `buildGrid()` memastikan huruf di persilangan cocok (dicek juga oleh unit test).

export type Dir = "A" | "D"; // A = mendatar, D = menurun

export type Entry = { num: number; dir: Dir; row: number; col: number; answer: string; clue: string };

export const ROWS = 10;
export const COLS = 13;
export const POINTS_PER_ENTRY = 10;

export const ENTRIES: Entry[] = [
  { num: 1, dir: "D", row: 0, col: 1, answer: "KOREOGRAFI", clue: "Rangkaian gerak tari yang disusun untuk penampilan di atas panggung" },
  { num: 2, dir: "A", row: 0, col: 7, answer: "MASKOT", clue: "Sapi berkacamata VR adalah ... resmi Mooniverse" },
  { num: 3, dir: "D", row: 0, col: 10, answer: "KARAOKE", clue: "Bernyanyi bersama mengikuti lirik yang tampil di layar" },
  { num: 4, dir: "A", row: 1, col: 0, answer: "LOGO", clue: "Simbol visual sebuah merek atau acara" },
  { num: 5, dir: "D", row: 1, col: 6, answer: "FOODCOURT", clue: "Area berisi banyak stan makanan (bahasa Inggris, tanpa spasi)" },
  { num: 6, dir: "D", row: 2, col: 12, answer: "BALON", clue: "Benda karet berisi udara yang sering menghiasi pesta" },
  { num: 7, dir: "D", row: 3, col: 8, answer: "KAMERA", clue: "Alat untuk mengabadikan momen di photo spot" },
  { num: 8, dir: "A", row: 4, col: 1, answer: "OS", clue: "Singkatan kategori karyawan outsourcing di CMD" },
  { num: 9, dir: "A", row: 6, col: 0, answer: "DRESSCODENEON", clue: "Aturan berpakaian bertema cahaya terang ala Mooniverse (tanpa spasi)" },
  { num: 10, dir: "A", row: 9, col: 1, answer: "IDOL", clue: "Sebutan bahasa Inggris untuk penyanyi yang dielu-elukan penggemar" },
];

export const entryKey = (e: Pick<Entry, "num" | "dir">) => `${e.num}${e.dir}`;
export const MAX_SCORE = ENTRIES.length * POINTS_PER_ENTRY;

export function cellsOf(e: Pick<Entry, "dir" | "row" | "col"> & { length: number }) {
  return Array.from({ length: e.length }, (_, i) => (e.dir === "A" ? [e.row, e.col + i] : [e.row + i, e.col]) as [number, number]);
}

/** Grid huruf (null = kotak hitam). Melempar error bila persilangan tidak cocok atau keluar grid. */
export function buildGrid(entries: Entry[] = ENTRIES) {
  const grid: (string | null)[][] = Array.from({ length: ROWS }, () => Array<string | null>(COLS).fill(null));
  for (const e of entries) {
    cellsOf({ ...e, length: e.answer.length }).forEach(([r, c], i) => {
      if (r >= ROWS || c >= COLS) throw new Error(`${entryKey(e)} keluar grid`);
      const ch = e.answer[i];
      if (grid[r][c] && grid[r][c] !== ch) throw new Error(`${entryKey(e)} bentrok di (${r},${c}): ${grid[r][c]} ≠ ${ch}`);
      grid[r][c] = ch;
    });
  }
  return grid;
}

export const normalizeAnswer = (s: string) => s.toUpperCase().replace(/[^A-Z]/g, "");

export type PublicEntry = { key: string; num: number; dir: Dir; row: number; col: number; length: number; clue: string };

/** Data yang aman dikirim ke browser: posisi & panjang, tanpa jawaban. */
export function publicPuzzle() {
  const grid = buildGrid();
  const numbers: Record<string, number> = {};
  for (const e of ENTRIES) numbers[`${e.row},${e.col}`] = e.num;
  return {
    rows: ROWS,
    cols: COLS,
    open: grid.map((row) => row.map((c) => c !== null)),
    numbers,
    entries: ENTRIES.map<PublicEntry>((e) => ({ key: entryKey(e), num: e.num, dir: e.dir, row: e.row, col: e.col, length: e.answer.length, clue: e.clue })),
    maxScore: MAX_SCORE,
  };
}

export const findEntry = (key: string) => ENTRIES.find((e) => entryKey(e) === key) ?? null;
