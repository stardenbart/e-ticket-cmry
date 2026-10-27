// Teka-teki silang (TTS) Mooniverse — grid 13 kolom × 10 baris sesuai desain panitia.
// File ini hanya untuk SERVER (berisi kunci jawaban). Browser hanya menerima `publicPuzzle()`.
//
// Soal & jawaban dari panitia (26 Okt 2026). Mengganti soal: ubah `answer`/`clue` di ENTRIES. Posisi (row, col, arah) mengikuti desain grid;
// `buildGrid()` memastikan huruf di persilangan cocok (dicek juga oleh unit test).

export type Dir = "A" | "D"; // A = mendatar, D = menurun

export type Entry = { num: number; dir: Dir; row: number; col: number; answer: string; clue: string };

export const ROWS = 10;
export const COLS = 13;
export const POINTS_PER_ENTRY = 10;

export const ENTRIES: Entry[] = [
  { num: 1, dir: "D", row: 0, col: 1, answer: "SMARTWATCH", clue: "Aku tak membaca garis tangan, tetapi dapat menyimpan jejak aktivitas pemiliknya. Aku mengenali waktu, menghitung gerakan, dan menerima bisikan dunia digital tanpa harus dikeluarkan dari saku. Aku bukan manusia, tetapi sering menemani setiap langkahnya. Apakah aku?" },
  { num: 2, dir: "A", row: 0, col: 7, answer: "KULKAS", clue: "Aku tidak menghentikan waktu, tetapi bisa memperlambat perubahan yang dibawanya pada makanan. Di dalam diriku, sesuatu yang hangat kehilangan derajatnya, sementara kesegaran berusaha bertahan lebih lama. Aku bukan musim dingin, tetapi mampu menghadirkannya dalam sebuah kotak. Apakah aku?" },
  { num: 3, dir: "D", row: 0, col: 10, answer: "KIPASANGIN", clue: "Aku tak menghasilkan apa yang paling kamu rasakan dariku. Aku hanya menggerakkan sesuatu yang sudah ada, membuat yang diam terasa hidup. Aku memiliki bilah, tetapi bukan untuk memotong; aku berputar, tetapi bukan untuk berpindah tempat. Siapakah aku?" },
  { num: 4, dir: "A", row: 1, col: 0, answer: "EMAS", clue: "Kerajaan runtuh, mata uang berganti, dan pemilikku datang silih berganti. Aku tak perlu bernapas untuk bertahan selama berabad-abad. Identitasku ditulis dengan dua huruf yang bukan berasal dari bahasa yang paling sering kamu gunakan. Siapakah aku?" },
  { num: 5, dir: "D", row: 1, col: 6, answer: "MESINCUCI", clue: "Aku menerima sesuatu yang telah kehilangan kesegarannya, lalu memaksanya menari dalam pusaran. Air menjadi rekanku, sabun menjadi sekutuku, dan putaran menjadi senjataku. Aku bekerja paling keras ketika manusia ingin beristirahat dari pekerjaan rumah. Siapakah aku?" },
  { num: 6, dir: "D", row: 2, col: 12, answer: "MOTOR", clue: "Aku punya dua lingkaran yang setia berjalan beriringan, tetapi bukan saudara kembar yang diam. Aku memakan energi tanpa perlu mengunyah, mengubah putaran menjadi perjalanan, dan sering kali lebih gesit ketika ruang semakin sempit. Apakah aku?" },
  { num: 7, dir: "D", row: 3, col: 8, answer: "SEPEDA", clue: "Aku dapat melaju tanpa setetes bahan bakar, tetapi tidak tanpa tenaga. Dua lingkaranku menapak bumi, sedangkan tubuhku meminta keseimbangan yang terus diperbarui. Berhenti terlalu lama terkadang lebih sulit bagiku daripada bergerak. Apakah aku?" },
  { num: 8, dir: "A", row: 4, col: 1, answer: "TV", clue: "Aku pernah menjadi pusat perhatian satu ruangan, tempat keluarga berkumpul menyaksikan dunia yang jauh. Kini aku bisa menjadi portal, layar permainan, bahkan teman saat kesunyian. Namaku hanya dua huruf, tetapi aku dapat membawa ribuan cerita. Apakah aku?" },
  { num: 9, dir: "A", row: 6, col: 0, answer: "VACUUMCLEANER", clue: "Aku memburu musuh yang sering tak terlihat oleh mata. Aku tak memiliki gigi, tangan, atau perangkap, tetapi perbedaan tekanan adalah cara utamaku menaklukkan mereka. Setelah perburuan selesai, aku menyimpan hasilnya di dalam tubuhku sendiri. Apakah aku?" },
  { num: 10, dir: "A", row: 9, col: 1, answer: "HELM", clue: "Aku duduk di tempat yang menyimpan banyak gagasan, tetapi bukan untuk mengendalikan pikiran. Saat bahaya datang dari arah yang tak diharapkan, tugasku bukan melawan, melainkan membantu mengurangi akibat benturan. Aku sering diwajibkan sebelum perjalanan tertentu dimulai. Siapakah aku?" },
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
