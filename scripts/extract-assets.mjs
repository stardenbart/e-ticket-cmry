// Potong elemen dari visual stock Mooniverse (public/images/mooniverse_visual_stock.png) menjadi
// aset terpisah ber-alpha di public/images/mooniverse/. Latar sheet abu-abu gelap (~#181817), jadi
// dipakai "color to alpha" berbasis kecerahan: cocok untuk elemen neon di atas latar situs yang gelap.
//   node scripts/extract-assets.mjs
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const SRC = "public/images/mooniverse_visual_stock.png";
const OUT = "public/images/mooniverse";
const BG = 34; // ambang latar checker (nilai kanal 14–30)

// [nama, x, y, lebar, tinggi] dalam koordinat sheet 1536×1024
const CROPS = [
  ["mascot", 30, 8, 410, 392],
  ["logo", 425, 18, 715, 280],
  ["blimp", 1148, 22, 380, 210],
  ["cow-rock", 425, 300, 215, 172],
  ["cow-wink", 643, 300, 195, 172],
  ["cow-love", 838, 300, 175, 172],
  ["cow-chill", 1012, 300, 192, 172],
  ["crown", 1226, 240, 118, 110],
  ["heart", 1383, 240, 122, 115],
  ["sparkle", 1222, 368, 86, 92],
  ["bolt", 1320, 365, 76, 104],
  ["m", 1398, 360, 118, 112],
  ["tower-moo", 18, 318, 165, 515],
  ["tower-food", 178, 388, 172, 445],
  ["stage", 372, 470, 790, 352],
  ["banner-bolt", 1168, 482, 352, 132],
  ["banner-logo", 1168, 628, 352, 122],
  ["frame-a", 1160, 762, 362, 108],
  ["frame-b", 1160, 882, 362, 122],
  ["crowd", 8, 838, 548, 178],
  ["beams", 560, 832, 590, 182],
];

fs.mkdirSync(OUT, { recursive: true });

for (const [name, left, top, width, height] of CROPS) {
  const { data, info } = await sharp(SRC).extract({ left, top, width, height }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0, o = 0; i < data.length; i += 3, o += 4) {
    const c = [data[i], data[i + 1], data[i + 2]].map((v) => Math.max(0, v - BG) * (255 / (255 - BG)));
    const peak = Math.max(c[0], c[1], c[2]);
    let a = Math.min(1, (peak / 255) * 1.7);
    if (a < 0.04) a = 0;
    out[o] = a ? Math.min(255, c[0] / a) : 0;
    out[o + 1] = a ? Math.min(255, c[1] / a) : 0;
    out[o + 2] = a ? Math.min(255, c[2] / a) : 0;
    out[o + 3] = Math.round(a * 255);
  }
  await sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
    .webp({ quality: 88, alphaQuality: 90 })
    .toFile(path.join(OUT, `${name}.webp`));
  console.log(name, `${width}x${height}`);
}

// Foto panggung untuk hero (tanpa alpha), dua ukuran.
for (const w of [1600, 900]) {
  await sharp("public/images/mooniverse_ref.jpeg").resize({ width: w }).webp({ quality: 80 }).toFile(path.join(OUT, `stage-hero-${w}.webp`));
}
console.log("stage-hero 1600/900");
