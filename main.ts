import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const W = 1200;
const H = 675;

// 5x7 bitmap font, drawn by hand. Each glyph is 7 rows; each row is a 5-bit
// number, bit 4 = leftmost pixel.
const FONT = {
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
  "6": [6, 8, 16, 30, 17, 17, 14],
  "7": [31, 1, 2, 4, 8, 8, 8],
  "8": [14, 17, 17, 14, 17, 17, 14],
  "9": [14, 17, 17, 15, 1, 2, 12],
  " ": [0, 0, 0, 0, 0, 0, 0],
  ".": [0, 0, 0, 0, 0, 12, 12],
  ",": [0, 0, 0, 0, 12, 4, 8],
  "!": [4, 4, 4, 4, 4, 0, 4],
  "?": [14, 17, 1, 6, 4, 0, 4],
  "-": [0, 0, 0, 14, 0, 0, 0],
  ":": [0, 12, 12, 0, 12, 12, 0],
  "'": [4, 4, 8, 0, 0, 0, 0],
  ">": [8, 4, 2, 1, 2, 4, 8],
  "/": [1, 2, 2, 4, 8, 8, 16],
  "(": [2, 4, 8, 8, 8, 4, 2],
  ")": [8, 4, 2, 2, 2, 4, 8],
};

// ---- CRC32 + minimal PNG encoder (RGB, 8-bit, no filtering) ----
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 8 + data.length);
  return out;
}

function encodePNG(w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3);
  }
  const idat = deflateSync(raw, { level: 9 });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- Pixel buffer + drawing helpers ----
const buf = new Uint8Array(W * H * 3);

function setPx(x, y, r, g, b) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = (y * W + x) * 3;
  buf[i] = r;
  buf[i + 1] = g;
  buf[i + 2] = b;
}

function fillRect(x0, y0, x1, y1, r, g, b) {
  const a = Math.max(0, x0);
  const c = Math.min(W, x1);
  const d = Math.max(0, y0);
  const e = Math.min(H, y1);
  for (let y = d; y < e; y++) {
    for (let x = a; x < c; x++) setPx(x, y, r, g, b);
  }
}

function fillCircle(cx, cy, rad, r, g, b) {
  for (let y = cy - rad; y <= cy + rad; y++) {
    for (let x = cx - rad; x <= cx + rad; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= rad * rad) setPx(x, y, r, g, b);
    }
  }
}

function thickLine(x0, y0, x1, y1, rad, r, g, b) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= steps; i++) {
    const t = steps === 0 ? 0 : i / steps;
    fillCircle(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), rad, r, g, b);
  }
}

// Deterministic PRNG (fixed seed, no Math.random).
let seed = 20261121;
function rnd() {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed;
}

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

// Neon sunset gradient: hot pink -> orange -> dark purple.
function skyColor(y) {
  const t = y / (H - 1);
  let a, b, f;
  if (t < 0.5) {
    a = [255, 46, 136];
    b = [255, 122, 24];
    f = t / 0.5;
  } else {
    a = [255, 122, 24];
    b = [38, 10, 66];
    f = (t - 0.5) / 0.5;
  }
  return [lerp(a[0], b[0], f), lerp(a[1], b[1], f), lerp(a[2], b[2], f)];
}

function textWidth(text, scale) {
  return text.length * 6 * scale - scale;
}

function drawGlyph(ch, x, y, scale, r, g, b) {
  const glyph = FONT[ch] || FONT[" "];
  for (let row = 0; row < 7; row++) {
    const bits = glyph[row];
    for (let col = 0; col < 5; col++) {
      if ((bits >> (4 - col)) & 1) {
        fillRect(x + col * scale, y + row * scale, x + (col + 1) * scale, y + (row + 1) * scale, r, g, b);
      }
    }
  }
}

function drawText(text, x, y, scale, r, g, b) {
  for (let i = 0; i < text.length; i++) {
    drawGlyph(text[i], x + i * 6 * scale, y, scale, r, g, b);
  }
}

// GTA-style text: white fill with a dark outline, readable at a glance.
function drawTextOutlined(text, x, y, scale, fr, fg, fb, or, og, ob) {
  const o = Math.max(2, Math.floor(scale / 5));
  const offs = [[-o, 0], [o, 0], [0, -o], [0, o], [-o, -o], [o, -o], [-o, o], [o, o]];
  for (const off of offs) drawText(text, x + off[0], y + off[1], scale, or, og, ob);
  drawText(text, x, y, scale, fr, fg, fb);
}

// ---- The make.fun ghost: big, waving, impossible to miss ----
function drawGhost(cx, headCy) {
  const R = 78;
  const bodyTop = headCy;
  const bodyBottom = headCy + 118;
  const OUT = [10, 5, 20];
  const WHITE = [255, 255, 255];
  // Outline pass (slightly expanded black shapes).
  fillCircle(cx, headCy, R + 6, OUT[0], OUT[1], OUT[2]);
  fillRect(cx - R - 6, bodyTop, cx + R + 6, bodyBottom + 6, OUT[0], OUT[1], OUT[2]);
  for (const hx of [cx - 52, cx, cx + 52]) {
    fillCircle(hx, bodyBottom, 26 + 6, OUT[0], OUT[1], OUT[2]);
  }
  thickLine(cx + R - 8, bodyTop + 62, cx + R + 66, bodyTop - 12, 17, OUT[0], OUT[1], OUT[2]);
  fillCircle(cx + R + 68, bodyTop - 14, 20, OUT[0], OUT[1], OUT[2]);
  // White pass.
  fillCircle(cx, headCy, R, WHITE[0], WHITE[1], WHITE[2]);
  fillRect(cx - R, bodyTop, cx + R, bodyBottom, WHITE[0], WHITE[1], WHITE[2]);
  for (const hx of [cx - 52, cx, cx + 52]) {
    fillCircle(hx, bodyBottom, 26, WHITE[0], WHITE[1], WHITE[2]);
  }
  thickLine(cx + R - 8, bodyTop + 62, cx + R + 66, bodyTop - 12, 11, WHITE[0], WHITE[1], WHITE[2]);
  fillCircle(cx + R + 68, bodyTop - 14, 14, WHITE[0], WHITE[1], WHITE[2]);
  // Face: two eyes + a smile.
  fillCircle(cx - 32, headCy - 10, 11, 10, 5, 20);
  fillCircle(cx + 32, headCy - 10, 11, 10, 5, 20);
  for (let a = 20; a <= 160; a += 5) {
    const rad = (a * Math.PI) / 180;
    const px = Math.round(cx + 30 * Math.cos(rad));
    const py = Math.round(headCy + 16 + 30 * Math.sin(rad));
    fillRect(px - 2, py - 2, px + 3, py + 3, 10, 5, 20);
  }
}

function drawScene() {
  // Sky gradient.
  for (let y = 0; y < H; y++) {
    const c = skyColor(y);
    for (let x = 0; x < W; x++) setPx(x, y, c[0], c[1], c[2]);
  }
  // Low retro sun with stripe cuts, half-hidden behind the skyline.
  const sunX = 600;
  const sunY = 540;
  const sunR = 110;
  fillCircle(sunX, sunY, sunR, 255, 207, 63);
  for (let y = sunY + 4; y < sunY + sunR; y++) {
    if ((y - sunY) % 18 < 6) {
      const c = skyColor(y);
      for (let x = sunX - sunR; x <= sunX + sunR; x++) {
        const dx = x - sunX;
        const dy = y - sunY;
        if (dx * dx + dy * dy <= sunR * sunR) setPx(x, y, c[0], c[1], c[2]);
      }
    }
  }
  // City skyline silhouette with lit windows.
  let x = 0;
  while (x < W) {
    const w = 40 + (rnd() % 55);
    const top = 480 + (rnd() % 100);
    fillRect(x, top, x + w, H, 21, 10, 36);
    for (let wy = top + 12; wy < H - 14; wy += 22) {
      for (let wx = x + 8; wx < x + w - 8; wx += 16) {
        // Keep the center text zone window-free so the small lines stay clean.
        const inTextZone = wx > 380 && wx < 820 && wy > 520 && wy < 620;
        if (rnd() % 3 === 0 && !inTextZone) fillRect(wx, wy, wx + 7, wy + 9, 255, 215, 106);
      }
    }
    if (rnd() % 4 === 0) {
      fillRect(x + Math.floor(w / 2), top - 22, x + Math.floor(w / 2) + 3, top, 21, 10, 36);
    }
    x += w + 4;
  }
  // Giant GTA-style "WAITED" — the joke: not WASTED, WAITED.
  const waited = "WAITED";
  const ws = 20;
  drawTextOutlined(waited, Math.floor((W - textWidth(waited, ws)) / 2), 64, ws, 255, 255, 255, 10, 5, 20);
  // The make.fun ghost, front and center.
  drawGhost(600, 310);
  // MAKE.FUN, big, on its own line.
  const mf = "MAKE.FUN";
  const ms = 7;
  drawTextOutlined(mf, Math.floor((W - textWidth(mf, ms)) / 2), 470, ms, 255, 255, 255, 10, 5, 20);
  // Small punchlines.
  const earn = "EARN WHILE YOU WAIT";
  drawTextOutlined(earn, Math.floor((W - textWidth(earn, 3)) / 2), 528, 3, 255, 255, 255, 10, 5, 20);
  const l1 = "13 YEARS FOR GTA 6";
  drawTextOutlined(l1, Math.floor((W - textWidth(l1, 3)) / 2), 558, 3, 255, 255, 255, 10, 5, 20);
  const l2 = "2013 -> 2026";
  drawTextOutlined(l2, Math.floor((W - textWidth(l2, 3)) / 2), 588, 3, 255, 215, 106, 10, 5, 20);
}

const POST_TEXT =
  "WAITED 13 years for GTA 6... meanwhile my AI agent earns on make.fun. @makefunai https://make.fun/bounty/gta6-meme-x-01 makefun-rhubarb-awning-honey";

const outDir = process.env.MAKEFUN_OUTPUT_DIR || "./out";
drawScene();
mkdirSync(outDir, { recursive: true });
writeFileSync(outDir + "/meme.png", encodePNG(W, H, Buffer.from(buf)));
writeFileSync(outDir + "/post.txt", POST_TEXT + "\n");
console.log("wrote meme.png + post.txt to " + outDir);

// ---- POST.json: the gate reads /output/POST.json, so copy it from the repo root ----
// (Same convention as the kit starter: MAKEFUN_BOT_DIR, falling back to this file's
// own directory when the variable is unset.)
try {
  const fsCopy = process.getBuiltinModule("node:fs");
  const pathCopy = process.getBuiltinModule("node:path");
  const urlCopy = process.getBuiltinModule("node:url");
  const botDir = process.env.MAKEFUN_BOT_DIR || urlCopy.fileURLToPath(new URL(".", import.meta.url));
  fsCopy.copyFileSync(pathCopy.join(botDir, "POST.json"), outDir + "/POST.json");
  console.log("copied POST.json to " + outDir);
} catch (err) {
  console.error("POST.json could not be copied: " + err.message);
  process.exit(1);
}
