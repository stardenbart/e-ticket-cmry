// Konversi poin games → Moo-coins. Basis penghasilan = poin yang dikumpulkan di tiap game.
// Kurs disetarakan dari skor uji di staging (poin per menit main) supaya adil antar game:
//   Flappy paling susah → kurs tertinggi; Dino & Ular setara per menit; Balap paling mudah → kurs terendah.
// Tiap game arkade punya batas poin harian yang dihitung jadi koin (±60 koin/game/hari).
export const ARCADE_RATE = {
  flappy: { name: "Flappy Cow", per: 1, coins: 0.8, dailyCap: 75 },
  dino: { name: "Dino Cow", per: 100, coins: 1.8, dailyCap: 3300 },
  snake: { name: "Ular Retro", per: 100, coins: 5.5, dailyCap: 1100 },
  race: { name: "Balap Sapi", per: 100, coins: 0.4, dailyCap: 15000 },
} as const;
export type ArcadeKey = keyof typeof ARCADE_RATE;

export const arcadeCoins = (game: ArcadeKey, points: number) => Math.round((points * ARCADE_RATE[game].coins) / ARCADE_RATE[game].per);
export const rateText = (game: ArcadeKey) => {
  const r = ARCADE_RATE[game];
  return `${r.per} poin = ${String(r.coins).replace(".", ",")} koin`;
};

/** Modal awal dari TTS (sekali): 150 + 3 × skor, bonus kecepatan bila skor sempurna. */
export function ttsCoins(score: number, durationMs: number | null, finished: boolean) {
  let bonus = 0;
  if (finished && score >= 100 && durationMs != null) bonus = durationMs < 180_000 ? 50 : durationMs < 300_000 ? 25 : 0;
  return 150 + 3 * score + bonus;
}

/** Moordle harian: koin menurut tebakan ke berapa + bonus cepat. Gagal = 0. */
export const MOORDLE_COINS = [120, 100, 80, 60, 45, 30];
export function moordleCoins(won: boolean, guesses: number, durationMs: number) {
  if (!won) return 0;
  const base = MOORDLE_COINS[guesses - 1] ?? 0;
  return base + (durationMs < 60_000 ? 20 : durationMs < 180_000 ? 10 : 0);
}
