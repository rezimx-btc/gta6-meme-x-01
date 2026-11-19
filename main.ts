// gta6-meme-x-01 — deterministic GTA 6 waiting meme generator.
// Node.js standard library only. Run: node main.ts
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";

const W = 1200;
const H = 675;

const POST_TEXT =
  "Still waiting for GTA 6 like... 13 years later and I'm still on this beach chair. @makefunai https://make.fun/bounty/gta6-meme-x-01 makefun-rhubarb-awning-honey";

// ---------- deterministic PRNG (mulberry32, fixed seed) ----------
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function (): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260613);

// ---------- CRC32 + minimal PNG encoder (RGB, no filter) ----------
const CRC_TABLE: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = (c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1) >>> 0;
  CRC_TABLE.push(c >>> 0);
}
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}
function encodePNG(width: number, height: number, rgb: Buffer): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 3)] = 0;
    rgb.copy(raw, y * (1 + width * 3) + 1, y * width * 3, (y + 1) * width * 3);
  }
  const idat = deflateSync(raw, { level: 9 });
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------- 5x7 bitmap font (my own design; each glyph = 7 rows of 5 bits) ----------
type Glyph = number[];
const FONT: Record<string, Glyph> = {
  A: [14, 17, 17, 31, 17, 17, 17],
  B: [30, 17, 17, 30, 17, 17, 30],
  C: [14, 17, 16, 16, 16, 17, 14],
  D: [30, 17, 17, 17, 17, 17, 30],
  E: [31, 16, 16, 30, 16, 16, 31],
  F: [31, 16, 16, 30, 16, 16, 16],
  G: [14, 17, 16, 23, 17, 17, 15],
  H: [17, 17, 17, 31, 17, 17, 17],
  I: [14, 4, 4, 4, 4, 4, 14],
  J: [7, 2, 2, 2, 2, 18, 12],
  K: [17, 18, 20, 24, 20, 18, 17],
  L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17],
  N: [17, 25, 21, 19, 17, 17, 17],
  O: [14, 17, 17, 17, 17, 17, 14],
  P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13],
  R: [30, 17, 17, 30, 20, 18, 17],
  S: [15, 16, 16, 14, 1, 1, 30],
  T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14],
  V: [17, 17, 17, 17, 17, 10, 4],
  W: [17, 17, 17, 21, 21, 27, 17],
  X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 10, 4, 4, 4, 4],
  Z: [31, 1, 2, 4, 8, 16, 31],
  "0": [14, 17, 19, 21, 25, 17, 14],
  "1": [4, 12, 4, 4, 4, 4, 14],
  "2": [14, 17, 1, 6, 8, 16, 31],
  "3": [31, 2, 4, 2, 1, 17, 14],
  "4": [2, 6, 10, 18, 31, 2, 2],
  "5": [31, 16, 30, 1, 1, 17, 14],
  "6": [14, 16, 16, 30, 17, 17, 14],
  "7": [31, 1, 2, 4, 8, 8, 8],
  "8": [14, 17, 17, 14, 17, 17, 14],
  "9": [14, 17, 17, 15, 1, 1, 14],
  " ": [0, 0, 0, 0, 0, 0, 0],
  ".": [0, 0, 0, 0, 0, 12, 12],
  ",": [0, 0, 0, 0, 12, 4, 8],
  "!": [4, 4, 4, 4, 4, 0, 4],
  "'": [4, 4, 8, 0, 0, 0, 0],
  "-": [0, 0, 0, 14, 0, 0, 0],
  ":": [0, 12, 12, 0, 12, 12, 0],
  "/": [1, 2, 2, 4, 8, 8, 16],
};

// ---------- canvas ----------
type RGB = [number, number, number];
const px = Buffer.alloc(W * H * 3);

function setPx(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = c[0];
  px[i + 1] = c[1];
  px[i + 2] = c[2];
}
function fillRect(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) setPx(x, y, c);
}
function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}
function mix(c1: RGB, c2: RGB, t: number): RGB {
  return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
}
function line(x0: number, y0: number, x1: number, y1: number, c: RGB, w: number): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
  for (let s = 0; s <= steps; s++) {
    const x = Math.round(x0 + (dx * s) / steps);
    const y = Math.round(y0 + (dy * s) / steps);
    for (let oy = -w; oy <= w; oy++) for (let ox = -w; ox <= w; ox++) setPx(x + ox, y + oy, c);
  }
}
function disc(cx: number, cy: number, r: number, c: RGB): void {
  for (let y = cy - r; y <= cy + r; y++) {
    const dy = y - cy;
    const half = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy)));
    for (let x = cx - half; x <= cx + half; x++) setPx(x, y, c);
  }
}

// ---------- text ----------
function textWidth(s: string, scale: number): number {
  return s.length * 6 * scale - scale;
}
function drawText(x: number, y: number, s: string, scale: number, c: RGB): void {
  for (let ci = 0; ci < s.length; ci++) {
    const g = FONT[s[ci]] ?? FONT[" "];
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if ((g[row] >> (4 - col)) & 1) {
          fillRect(
            x + ci * 6 * scale + col * scale,
            y + row * scale,
            x + ci * 6 * scale + col * scale + scale - 1,
            y + row * scale + scale - 1,
            c,
          );
        }
      }
    }
  }
}
function drawTextCentered(y: number, s: string, scale: number, c: RGB): void {
  drawText(Math.floor((W - textWidth(s, scale)) / 2), y, s, scale, c);
}
function drawTextOutline(x: number, y: number, s: string, scale: number, fg: RGB, bg: RGB): void {
  for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-2, -2], [2, 2], [-2, 2], [2, -2]]) {
    drawText(x + dx, y + dy, s, scale, bg);
  }
  drawText(x, y, s, scale, fg);
}
function drawTextCenteredOutline(y: number, s: string, scale: number, fg: RGB, bg: RGB): void {
  const x = Math.floor((W - textWidth(s, scale)) / 2);
  drawTextOutline(x, y, s, scale, fg, bg);
}

// ---------- scene ----------
const SKY_STOPS: Array<[number, RGB]> = [
  [0.0, [43, 10, 74]],
  [0.35, [150, 25, 110]],
  [0.62, [255, 46, 136]],
  [0.82, [255, 122, 24]],
  [1.0, [255, 211, 25]],
];
function skyColor(t: number): RGB {
  for (let i = 1; i < SKY_STOPS.length; i++) {
    if (t <= SKY_STOPS[i][0]) {
      const [t0, c0] = SKY_STOPS[i - 1];
      const [t1, c1] = SKY_STOPS[i];
      return mix(c0, c1, (t - t0) / (t1 - t0));
    }
  }
  return SKY_STOPS[SKY_STOPS.length - 1][1];
}

const DARK: RGB = [22, 10, 36];
const BONE: RGB = [242, 234, 216];
const WHITE: RGB = [255, 255, 255];
const RED: RGB = [220, 30, 60];

function drawSky(): void {
  for (let y = 0; y < 400; y++) {
    const c = skyColor(y / 400);
    for (let x = 0; x < W; x++) setPx(x, y, c);
  }
  // stars in the upper sky
  for (let i = 0; i < 90; i++) {
    const x = Math.floor(rand() * W);
    const y = Math.floor(rand() * 150);
    setPx(x, y, [255, 255, 255]);
    if (rand() < 0.4) setPx(x + 1, y, [255, 255, 255]);
  }
}

function drawSun(): void {
  const cx = 600;
  const cy = 335;
  const r = 125;
  for (let y = cy - r; y <= cy + r; y++) {
    const dy = y - cy;
    const half = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy)));
    // retro sun slits in the lower half: leave sky showing through
    if (dy > 15 && ((dy - 15) % 24) < 6) continue;
    const t = (y - (cy - r)) / (2 * r);
    const c = mix([255, 226, 89], [255, 117, 24], t);
    for (let x = cx - half; x <= cx + half; x++) setPx(x, y, c);
  }
}

function drawSkyline(): void {
  let x = 0;
  while (x < W) {
    const bw = 46 + Math.floor(rand() * 48);
    const bh = 28 + Math.floor(rand() * 58);
    const top = 400 - bh;
    fillRect(x, top, x + bw - 3, 399, DARK);
    // antenna on some buildings
    if (rand() < 0.3) line(x + Math.floor(bw / 2), top, x + Math.floor(bw / 2), top - 16, DARK, 1);
    // lit windows
    for (let wy = top + 8; wy < 392; wy += 12) {
      for (let wx = x + 7; wx < x + bw - 8; wx += 12) {
        if (rand() < 0.35) fillRect(wx, wy, wx + 3, wy + 4, [255, 211, 25]);
      }
    }
    x += bw;
  }
}

function drawSea(): void {
  for (let y = 400; y < 445; y++) {
    const c = mix([14, 77, 100], [10, 46, 74], (y - 400) / 45);
    for (let x = 0; x < W; x++) setPx(x, y, c);
  }
  // sun reflection column on the water
  for (let i = 0; i < 260; i++) {
    const x = 560 + Math.floor(rand() * 80);
    const y = 402 + Math.floor(rand() * 40);
    setPx(x, y, [255, 170, 60]);
    if (rand() < 0.5) setPx(x + 1, y, [255, 200, 90]);
  }
}

function drawSand(): void {
  for (let y = 445; y < H; y++) {
    const c = mix([232, 192, 122], [200, 155, 90], (y - 445) / (H - 445));
    for (let x = 0; x < W; x++) setPx(x, y, c);
  }
  for (let i = 0; i < 500; i++) {
    const x = Math.floor(rand() * W);
    const y = 450 + Math.floor(rand() * 220);
    setPx(x, y, [190, 145, 85]);
  }
}

function drawPalm(baseX: number, lean: number): void {
  const topX = baseX + lean;
  const topY = 165;
  // curved trunk: segments from base to top
  let prevX = baseX;
  let prevY = 445;
  for (let s = 1; s <= 8; s++) {
    const t = s / 8;
    const x = Math.round(baseX + (topX - baseX) * t * t);
    const y = Math.round(445 + (topY - 445) * t);
    line(prevX, prevY, x, y, DARK, 5);
    prevX = x;
    prevY = y;
  }
  // fronds
  const fronds: Array<[number, number]> = [
    [-150, 55],
    [-110, 95],
    [-55, 115],
    [10, 118],
    [70, 100],
    [130, 62],
    [155, 18],
    [-160, 5],
  ];
  for (const [dx, dy] of fronds) {
    const ex = topX + dx;
    const ey = topY + dy;
    const mx = topX + Math.round(dx * 0.55);
    const my = topY - 28 + Math.round(dy * 0.45);
    line(topX, topY, mx, my, DARK, 3);
    line(mx, my, ex, ey, DARK, 3);
  }
  // coconuts
  disc(topX - 12, topY + 14, 7, DARK);
  disc(topX + 10, topY + 16, 7, DARK);
}

function drawChairAndSkeleton(): void {
  // beach chair: striped fabric
  const stripes: RGB[] = [
    [255, 92, 92],
    [255, 255, 255],
    [255, 92, 92],
    [255, 255, 255],
    [255, 92, 92],
  ];
  // backrest (tilted quad approximated by thick lines)
  for (let i = 0; i < 5; i++) {
    const t = i / 5;
    const x0 = Math.round(500 + 40 * t);
    const y0 = 625;
    const x1 = Math.round(560 + 40 * t);
    const y1 = 500;
    line(x0, y0, x1, y1, stripes[i], 7);
  }
  line(500, 625, 560, 500, DARK, 2);
  line(600, 625, 660, 500, DARK, 2);
  // seat
  for (let i = 0; i < 4; i++) {
    line(560 + i * 2, 600 + i * 2, 700, 600 + i * 2, i % 2 === 0 ? [255, 92, 92] : WHITE, 2);
  }
  line(560, 600, 700, 600, DARK, 2);
  // chair legs
  line(570, 600, 545, 640, DARK, 3);
  line(690, 600, 715, 640, DARK, 3);
  line(545, 640, 715, 640, DARK, 2);

  // skeleton, sitting and waiting
  const hx = 600;
  const hy = 512;
  disc(hx, hy, 26, BONE); // skull
  disc(hx - 9, hy - 2, 6, DARK); // left eye socket
  disc(hx + 9, hy - 2, 6, DARK); // right eye socket
  disc(hx, hy + 10, 3, DARK); // nose hole
  line(hx - 12, hy + 18, hx + 12, hy + 18, DARK, 1); // teeth line
  line(hx, hy + 26, hx, hy + 62, BONE, 4); // spine
  for (let i = 0; i < 4; i++) {
    const ry = hy + 34 + i * 8;
    line(hx - 20, ry, hx + 20, ry, BONE, 2); // ribs
  }
  line(hx - 18, hy + 34, hx - 34, hy + 62, BONE, 3); // left arm
  line(hx + 18, hy + 34, hx + 34, hy + 62, BONE, 3); // right arm
  line(hx - 34, hy + 62, hx - 20, hy + 66, BONE, 3); // left hand on armrest
  line(hx + 34, hy + 62, hx + 20, hy + 66, BONE, 3); // right hand on armrest
  line(hx - 8, hy + 62, hx - 30, hy + 96, BONE, 4); // left femur
  line(hx + 8, hy + 62, hx + 30, hy + 96, BONE, 4); // right femur
  line(hx - 30, hy + 96, hx - 34, hy + 122, BONE, 3); // left shin
  line(hx + 30, hy + 96, hx + 34, hy + 122, BONE, 3); // right shin
  disc(hx - 34, hy + 126, 5, BONE); // left foot
  disc(hx + 34, hy + 126, 5, BONE); // right foot
  // a tiny cobweb on the skull: it has been a while
  line(hx - 26, hy - 20, hx - 40, hy - 34, WHITE, 1);
  line(hx - 26, hy - 20, hx - 12, hy - 38, WHITE, 1);
  line(hx - 40, hy - 34, hx - 12, hy - 38, WHITE, 1);
}

function drawCalendar(): void {
  fillRect(790, 470, 1090, 635, WHITE);
  // border
  line(790, 470, 1090, 470, DARK, 2);
  line(790, 635, 1090, 635, DARK, 2);
  line(790, 470, 790, 635, DARK, 2);
  line(1090, 470, 1090, 635, DARK, 2);
  drawText(812, 482, "YEARS WAITING", 2, RED);
  line(800, 502, 1080, 502, DARK, 1);
  const years = ["2013", "2014", "2015", "2016", "2017", "2018", "2019", "2020", "2021", "2022", "2023", "2024", "2025", "2026"];
  for (let i = 0; i < years.length; i++) {
    const col = i < 7 ? 0 : 1;
    const row = i % 7;
    const x = 812 + col * 135;
    const y = 512 + row * 17;
    drawText(x, y, years[i], 2, DARK);
    // cross it out: still waiting
    line(x - 4, y + 3, x + 48, y + 10, RED, 2);
  }
}

function main(): void {
  drawSky();
  drawSun();
  drawSkyline();
  drawSea();
  drawSand();
  drawPalm(95, -45);
  drawPalm(1105, 45);
  drawChairAndSkeleton();
  drawCalendar();
  drawTextCenteredOutline(26, "STILL WAITING FOR GTA 6", 7, WHITE, DARK);
  // bottom line sits just below the chair legs so it never overlaps them
  drawTextCenteredOutline(644, "ME, 13 YEARS LATER", 4, WHITE, DARK);

  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "./out";
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "meme.png"), encodePNG(W, H, px));
  writeFileSync(join(outDir, "post.txt"), POST_TEXT + "\n");
}

main();
