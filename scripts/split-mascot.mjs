// Pisahkan maskot (public/images/mooniverse/mascot.webp, 410×392) menjadi dua layer untuk animasi:
//   mascot-head.webp  — kepala (tanduk, telinga, kacamata VR, moncong), berputar di titik leher
//   mascot-body.webp  — badan + tangan melambai; area kepala dikosongkan kecuali pita dagu/leher,
//                       sehingga saat kepala miring tidak muncul celah maupun kepala ganda.
//   node scripts/split-mascot.mjs
import sharp from "sharp";

const DIR = "public/images/mooniverse";
const W = 410;
const H = 392;

// Garis kepala (koordinat gambar). Tangan kiri (x < 105, y > 185) tetap ikut badan.
const HEAD = [
  [0, 0], [410, 0], [410, 205], [338, 222], [318, 262], [292, 284], [250, 296], [205, 298],
  [160, 292], [128, 278], [108, 252], [104, 188], [60, 170], [0, 160],
];
// Bagian kepala yang dihapus dari layer badan: sama, tapi berhenti di atas dagu (pita y ≥ 250 tetap ada).
const HEAD_CUT = HEAD.map(([x, y]) => [x, Math.min(y, 250)]);

const poly = (pts) => pts.map(([x, y]) => `${x},${y}`).join(" ");
const mask = (pts, invert) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">` +
      `<rect width="100%" height="100%" fill="${invert ? "#fff" : "#000"}"/>` +
      `<polygon points="${poly(pts)}" fill="${invert ? "#000" : "#fff"}"/></svg>`,
  );

async function layer(maskSvg, out) {
  const src = sharp(`${DIR}/mascot.webp`).ensureAlpha();
  const { data, info } = await src.raw().toBuffer({ resolveWithObject: true });
  const m = await sharp(maskSvg).resize(W, H).blur(1.2).greyscale().raw().toBuffer();
  for (let i = 0, p = 0; i < data.length; i += 4, p++) data[i + 3] = Math.round((data[i + 3] * m[p]) / 255);
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .webp({ quality: 90, alphaQuality: 92 })
    .toFile(`${DIR}/${out}`);
  console.log(out);
}

await layer(mask(HEAD, false), "mascot-head.webp");
await layer(mask(HEAD_CUT, true), "mascot-body.webp");
