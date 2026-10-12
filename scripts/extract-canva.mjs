// Potong elemen dari moodboard Canva (design/canva/moodboard.jpg, 1414×2000) ke public/images/canva/.
// Latar moodboard navy bergradasi, jadi warna latar diambil dari sudut tiap potongan, dikurangkan,
// lalu "color to alpha" berbasis kecerahan (cocok untuk elemen neon di atas latar situs yang gelap).
// Tekstur (laser, layar LED) disimpan apa adanya sebagai latar.
//   node scripts/extract-canva.mjs
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const SRC = "design/canva/moodboard.jpg";
const OUT = "public/images/canva";
fs.mkdirSync(OUT, { recursive: true });

// [nama, x, y, lebar, tinggi, mode] — mode "key" = latar dibuang, "photo" = apa adanya
const CROPS = [
  ["texture-lasers", 42, 264, 656, 176, "photo"],
  ["texture-led-stage", 152, 480, 441, 224, "photo"],
  ["led-panels", 82, 896, 246, 308, "key"],
  ["stick-cyan", 1052, 896, 282, 154, "key"],
  ["stick-magenta", 942, 1012, 270, 154, "key"],
  ["crown-neon", 1176, 1006, 160, 128, "key"],
  ["bolt-neon", 858, 1176, 236, 240, "key"],
  ["mascot-head-big", 430, 1036, 455, 360, "key"],
  ["cow-line-left", 152, 1226, 314, 232, "key"],
  ["cow-line-right", 996, 1236, 378, 316, "key"],
];

// Area milik elemen tetangga yang ikut terpotong: [x1, y1, x2, y2] dalam koordinat moodboard, dibuat transparan.
const ERASE = {
  "bolt-neon": [[858, 1176, 900, 1335], [1035, 1245, 1094, 1416], [1005, 1295, 1094, 1416], [858, 1335, 876, 1358]],
  "cow-line-left": [[380, 1360, 466, 1458]],
  "cow-line-right": [[996, 1236, 1032, 1302]],
  "stick-cyan": [[1168, 1004, 1334, 1050]],
  "stick-magenta": [[1040, 1012, 1212, 1046], [1178, 1012, 1212, 1122], [942, 1048, 966, 1166], [942, 1012, 976, 1048]],
  "mascot-head-big": [[430, 1180, 472, 1396], [430, 1358, 540, 1396]],
};

for (const [name, left, top, width, height, mode] of CROPS) {
  const img = sharp(SRC).extract({ left, top, width, height });
  if (mode === "photo") {
    await img.webp({ quality: 82 }).toFile(path.join(OUT, `${name}.webp`));
    console.log(name, "photo");
    continue;
  }
  const { data, info } = await img.removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;
  // Warna latar per sudut (rata-rata 6×6 px), diinterpolasi bilinear ke tiap piksel.
  const corner = (cx, cy) => {
    const acc = [0, 0, 0];
    let n = 0;
    for (let y = cy; y < cy + 6; y++)
      for (let x = cx; x < cx + 6; x++) {
        const i = (y * W + x) * 3;
        acc[0] += data[i]; acc[1] += data[i + 1]; acc[2] += data[i + 2]; n++;
      }
    return acc.map((v) => v / n);
  };
  const [tl, tr, bl, br] = [corner(0, 0), corner(W - 6, 0), corner(0, H - 6), corner(W - 6, H - 6)];
  const out = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++) {
    const fy = y / (H - 1);
    for (let x = 0; x < W; x++) {
      const fx = x / (W - 1);
      const i = (y * W + x) * 3;
      const o = (y * W + x) * 4;
      const c = [0, 1, 2].map((k) => {
        const bg = (tl[k] * (1 - fx) + tr[k] * fx) * (1 - fy) + (bl[k] * (1 - fx) + br[k] * fx) * fy;
        return Math.max(0, data[i + k] - bg - 6) * (255 / Math.max(1, 255 - bg));
      });
      const gx = left + x;
      const gy = top + y;
      const erased = (ERASE[name] ?? []).some(([x1, y1, x2, y2]) => gx >= x1 && gx <= x2 && gy >= y1 && gy <= y2);
      const peak = erased ? 0 : Math.max(...c);
      let a = Math.min(1, (peak / 255) * 1.8);
      if (a < 0.05) a = 0;
      out[o] = a ? Math.min(255, c[0] / a) : 0;
      out[o + 1] = a ? Math.min(255, c[1] / a) : 0;
      out[o + 2] = a ? Math.min(255, c[2] / a) : 0;
      out[o + 3] = Math.round(a * 255);
    }
  }
  await sharp(out, { raw: { width: W, height: H, channels: 4 } }).webp({ quality: 88, alphaQuality: 90 }).toFile(path.join(OUT, `${name}.webp`));
  console.log(name, `${W}x${H}`);
}
