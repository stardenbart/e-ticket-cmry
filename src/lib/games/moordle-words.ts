// Moordle: tebak kata 5 huruf bertema konser & industri susu, satu kata per hari (tanggal WIB).
// File ini hanya untuk SERVER (berisi kunci jawaban). Browser hanya menerima hasil evaluasi tebakan.

export const WORD_LEN = 5;
export const MAX_GUESSES = 6;
/** Skor harian: benar di tebakan ke-1 = 60, ke-2 = 50, …, ke-6 = 10; gagal = 0. */
export const pointsFor = (guessNo: number) => (guessNo >= 1 && guessNo <= MAX_GUESSES ? (MAX_GUESSES + 1 - guessNo) * 10 : 0);

type Word = [word: string, theme: "Susu" | "Konser", desc: string];

const WORDS: Word[] = [
  ["PERAH", "Susu", "Proses mengambil susu dari sapi"], ["PAKAN", "Susu", "Santapan harian sapi di kandang"],
  ["BOTOL", "Susu", "Wadah susu yang sering dibawa ke sekolah"], ["KEMAS", "Susu", "Tahap membungkus produk sebelum dikirim"],
  ["SEGAR", "Susu", "Kata untuk susu yang baru diolah"], ["KEFIR", "Susu", "Minuman susu fermentasi yang asam"],
  ["LEMAK", "Susu", "Kandungan yang membuat susu terasa creamy"], ["MESIN", "Susu", "Peralatan utama di lini produksi pabrik"],
  ["LABEL", "Susu", "Tempat info nutrisi dan tanggal kedaluwarsa"], ["KADAR", "Susu", "Ukuran kandungan, misalnya protein atau lemak"],
  ["KIRIM", "Susu", "Mengantar produk dari pabrik ke toko"], ["PASAR", "Susu", "Tempat produk bertemu pembeli"],
  ["MINUM", "Susu", "Cara paling umum menikmati susu"], ["LEZAT", "Susu", "Rasa yang dikejar setiap produk makanan"],
  ["SEHAT", "Susu", "Alasan banyak orang rutin minum susu"], ["KOCOK", "Susu", "Dilakukan sebelum minum susu kemasan tertentu"],
  ["ENCER", "Susu", "Lawan kata dari kental"], ["GURIH", "Susu", "Rasa khas keju yang bikin nagih"],
  ["MANIS", "Susu", "Rasa dominan pada susu kental manis"],
  ["VOKAL", "Konser", "Penyanyi utama di sebuah band"], ["GITAR", "Konser", "Alat musik petik andalan di panggung"],
  ["TIKET", "Konser", "Dibeli dulu sebelum masuk venue konser"], ["LAMPU", "Konser", "Sorotan warna-warni di atas panggung"],
  ["TEMPO", "Konser", "Cepat lambatnya sebuah lagu"], ["IRAMA", "Konser", "Pola ketukan dalam musik"],
  ["MUSIK", "Konser", "Alasan semua orang berkumpul di konser"], ["ARTIS", "Konser", "Pengisi acara yang ditunggu penonton"],
  ["AUDIO", "Konser", "Sistem suara yang menggelegar di venue"], ["SORAK", "Konser", "Teriakan penonton saat lagu favorit mulai"],
  ["BALAD", "Konser", "Lagu pelan saat penonton menyalakan lampu HP"], ["LIRIK", "Konser", "Kata-kata lagu yang dinyanyikan bareng"],
  ["KABEL", "Konser", "Menghubungkan gitar ke amplifier"], ["DEBUT", "Konser", "Penampilan perdana sebuah band"],
  ["RAMAI", "Konser", "Suasana venue saat tiket habis terjual"], ["MEGAH", "Konser", "Panggung dengan skala besar dan mewah"],
  ["LASER", "Konser", "Sinar yang menari di atas penonton"], ["SINAR", "Konser", "Cahaya yang memancar dari spotlight"],
  ["DISKO", "Konser", "Musik dansa dengan bola cermin"], ["BIOLA", "Konser", "Alat musik gesek di orkestra"],
  ["PIANO", "Konser", "Alat musik bertuts hitam putih"], ["SUARA", "Konser", "Hal pertama yang dinilai dari seorang penyanyi"],
  ["HEBOH", "Konser", "Suasana penonton saat encore"], ["IDOLA", "Konser", "Sosok yang dielu-elukan para penggemar"],
  ["JOGET", "Konser", "Gerakan penonton mengikuti irama"], ["PESTA", "Konser", "Acara meriah yang bisa dengan band live"],
];

const DAY_MS = 86_400_000;
const WIB_MS = 7 * 3_600_000;
/** Hari pertama Moordle (#1). */
const FIRST_DAY = Math.floor(Date.UTC(2026, 9, 27) / DAY_MS);

/** Nomor hari berdasarkan tanggal WIB (berganti tiap 00:00 WIB). */
export const wibDay = (now = Date.now()) => Math.floor((now + WIB_MS) / DAY_MS);
/** Nomor teka-teki (#1 = 27 Okt 2026). */
export const puzzleNo = (day: number) => Math.max(1, day - FIRST_DAY + 1);
/** Waktu (UTC ms) pergantian ke kata berikutnya = 00:00 WIB besok. */
export const nextResetAt = (day: number) => (day + 1) * DAY_MS - WIB_MS;

/** Kata hari ini. Langkah 7 (koprima dengan 45 kata) → tidak berulang sebelum semua kata keluar. */
export function wordOf(day: number) {
  const step = WORDS.length % 7 ? 7 : 11;
  const [word, theme, desc] = WORDS[(day * step) % WORDS.length];
  return { word, theme, desc };
}

export type Mark = "c" | "p" | "a"; // c = posisi benar (hijau), p = ada di kata (kuning), a = tidak ada

export function evaluate(guess: string, answer: string): Mark[] {
  const res: Mark[] = Array(WORD_LEN).fill("a");
  const left: Record<string, number> = {};
  for (let i = 0; i < WORD_LEN; i++) {
    if (guess[i] === answer[i]) res[i] = "c";
    else left[answer[i]] = (left[answer[i]] ?? 0) + 1;
  }
  for (let i = 0; i < WORD_LEN; i++) {
    if (res[i] !== "c" && left[guess[i]] > 0) {
      res[i] = "p";
      left[guess[i]]--;
    }
  }
  return res;
}

export const normalizeGuess = (s: string) => s.toUpperCase().replace(/[^A-Z]/g, "");
