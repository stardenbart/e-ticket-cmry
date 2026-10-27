// Latar "Neon City" bersama untuk Flappy Cow & Balap Sapi: langit gradasi, bintang berkedip, matahari
// synthwave, dan dua lapis gedung berjendela neon yang bergulir (parallax). Lapisan dirender sekali ke
// canvas offscreen lalu digambar ulang tiap frame (ringan di HP).

export const PINK = "#ff2e9f";
export const CYAN = "#19e6ff";
export const VIO = "#9d4dff";
export const FONT = 'ui-rounded,"Arial Rounded MT Bold",system-ui,sans-serif';

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

function makeLayer(period: number, height: number, hmin: number, hmax: number, body: string, wins: string[], wp: number) {
  const c = document.createElement("canvas");
  const k = 2;
  c.width = period * k;
  c.height = height * k;
  const g = c.getContext("2d")!;
  g.scale(k, k);
  let x = 0;
  while (x < period) {
    const w = Math.min(rnd(26, 54), period - x);
    const h = rnd(hmin, hmax);
    g.fillStyle = body;
    g.fillRect(x, height - h, w, h);
    for (let wy = height - h + 8; wy < height - 8; wy += 11)
      for (let wx = x + 5; wx < x + w - 7; wx += 9)
        if (Math.random() < wp) {
          g.fillStyle = wins[(Math.random() * wins.length) | 0];
          g.fillRect(wx, wy, 4, 5);
        }
    x += w + (Math.random() < 0.5 ? 0 : rnd(2, 8));
  }
  return c;
}

function makeSun() {
  const c = document.createElement("canvas");
  c.width = c.height = 400;
  const g = c.getContext("2d")!;
  const gr = g.createLinearGradient(0, 0, 0, 400);
  gr.addColorStop(0, "#ffd166");
  gr.addColorStop(0.45, PINK);
  gr.addColorStop(1, VIO);
  g.fillStyle = gr;
  g.beginPath();
  g.arc(200, 200, 200, 0, 7);
  g.fill();
  g.globalCompositeOperation = "destination-out";
  for (let i = 0; i < 6; i++) g.fillRect(0, 215 + i * 30, 400, 4 + i * 3);
  return c;
}

export type Scene = ReturnType<typeof makeScene>;

/** `horizon` = garis cakrawala (bawah gedung). `tall` = gedung tinggi (Flappy) atau rendah (Balap). */
export function makeScene(width: number, horizon: number, tall: boolean) {
  const far = makeLayer(480, horizon, tall ? 90 : 50, tall ? 230 : 170, "#1b0f45", [VIO, CYAN], 0.12);
  const near = makeLayer(520, horizon, tall ? 50 : 25, tall ? 160 : 95, "#0e0730", [PINK, CYAN, "#ffd166"], 0.22);
  const sun = makeSun();
  const stars = Array.from({ length: 32 }, () => [rnd(0, width), rnd(0, horizon * 0.6), rnd(0.6, 1.6)]);

  /** Gambar langit + matahari + gedung. `farOff`/`nearOff` = geseran parallax (px). */
  function draw(ctx: CanvasRenderingContext2D, t: number, farOff: number, nearOff: number, sunX: number, sunY: number, height = horizon) {
    const g = ctx.createLinearGradient(0, 0, 0, horizon);
    g.addColorStop(0, "#07031a");
    g.addColorStop(0.6, "#2a0b50");
    g.addColorStop(1, "#7a1b86");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#fff";
    stars.forEach((s, i) => {
      ctx.globalAlpha = 0.4 + 0.4 * Math.sin(t * 2 + i);
      ctx.fillRect(s[0], s[1], s[2], s[2]);
    });
    ctx.globalAlpha = 1;
    ctx.drawImage(sun, sunX, sunY, 200, 200);
    const fo = ((farOff % 480) + 480) % 480;
    const no = ((nearOff % 520) + 520) % 520;
    // Ulangi lapisan sampai menutup seluruh lebar canvas (Dino lebih lebar dari 480/520 px).
    for (let x = -fo; x < width; x += 480) ctx.drawImage(far, x, 0, 480, horizon);
    for (let x = -no; x < width; x += 520) ctx.drawImage(near, x, 0, 520, horizon);
  }
  return { draw };
}

export function glow(ctx: CanvasRenderingContext2D, c: string, b: number) {
  ctx.shadowColor = c;
  ctx.shadowBlur = b;
}

export function txt(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color: string, gc?: string) {
  ctx.font = `bold ${size}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  if (gc) glow(ctx, gc, 14);
  ctx.fillText(s, x, y);
  ctx.shadowBlur = 0;
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}
