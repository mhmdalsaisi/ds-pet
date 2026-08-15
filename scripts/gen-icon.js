'use strict';

/**
 * 从 DeepSeek 官方风格 SVG 生成应用图标和托盘图标。
 * 输出: assets/icon.png (512) 与 assets/tray.png (32)
 * 用 zlib.deflateSync 编码 PNG (RGBA, 每行 filter=0)
 */

const zlib = require('node:zlib');
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

/* ---------------- PNG 编码 ---------------- */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type RGBA
  ihdr[10] = 0;  // compression
  ihdr[11] = 0;  // filter
  ihdr[12] = 0;  // interlace
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

/* ---------------- 像素绘制 ---------------- */

function makeCanvas(size) {
  const buf = Buffer.alloc(size * size * 4);
  return { size, buf, set(x, y, [r, g, b, a = 255]) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    const da = a / 255;
    const oa = buf[i + 3] / 255;
    const na = da + oa * (1 - da);
    if (na === 0) return;
    buf[i] = Math.round((r * da + buf[i] * oa * (1 - da)) / na);
    buf[i + 1] = Math.round((g * da + buf[i + 1] * oa * (1 - da)) / na);
    buf[i + 2] = Math.round((b * da + buf[i + 2] * oa * (1 - da)) / na);
    buf[i + 3] = Math.round(na * 255);
  } };
}

function fillEllipse(cv, cx, cy, rx, ry, color, rotDeg = 0) {
  const rad = (rotDeg * Math.PI) / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = x - cx, dy = y - cy;
      const rx2 = dx * cos + dy * sin;
      const ry2 = -dx * sin + dy * cos;
      if ((rx2 * rx2) / (rx * rx) + (ry2 * ry2) / (ry * ry) <= 1) cv.set(x, y, color);
    }
  }
}

function fillCircle(cv, cx, cy, r, color) { fillEllipse(cv, cx, cy, r, r, color); }

function fillTriangle(cv, ax, ay, bx, by, cx, cy, color) {
  const minX = Math.floor(Math.min(ax, bx, cx)), maxX = Math.ceil(Math.max(ax, bx, cx));
  const minY = Math.floor(Math.min(ay, by, cy)), maxY = Math.ceil(Math.max(ay, by, cy));
  const sign = (p1, p2, p3) => (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
  const A = { x: ax, y: ay }, B = { x: bx, y: by }, C = { x: cx, y: cy };
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const P = { x, y };
      const d1 = sign(P, A, B), d2 = sign(P, B, C), d3 = sign(P, C, A);
      const neg = d1 < 0 || d2 < 0 || d3 < 0;
      const pos = d1 > 0 || d2 > 0 || d3 > 0;
      if (!(neg && pos)) cv.set(x, y, color);
    }
  }
}

/* ---------------- 画鲸鱼 ---------------- */

function drawWhale(size) {
  const cv = makeCanvas(size);
  const s = size / 256; // 基准 256

  const BODY = [77, 107, 254];
  const BODY_DARK = [58, 79, 216];
  const BELLY = [223, 231, 255];
  const WHITE = [255, 255, 255];
  const PUPIL = [22, 38, 94];

  const cx = 124 * s, cy = 142 * s;
  const rx = 92 * s, ry = 50 * s;

  // 尾巴 (先画, 身体盖住连接处)
  fillTriangle(cv, 196 * s, 108 * s, 242 * s, 78 * s, 230 * s, 114 * s, BODY);
  fillTriangle(cv, 196 * s, 176 * s, 242 * s, 206 * s, 230 * s, 170 * s, BODY);

  // 身体
  fillEllipse(cv, cx, cy, rx, ry, BODY, -6);

  // 肚皮
  fillEllipse(cv, (cx - 6) * 1, cy + 18 * s, 64 * s, 24 * s, BELLY, -6);

  // 胸鳍
  fillEllipse(cv, 114 * s, 170 * s, 26 * s, 9 * s, BODY_DARK, -14);

  // 眼睛
  fillCircle(cv, 90 * s, 118 * s, 17 * s, WHITE);
  fillCircle(cv, 93 * s, 121 * s, 8 * s, PUPIL);
  fillCircle(cv, 88 * s, 115 * s, 3 * s, WHITE);

  // 腮红
  fillEllipse(cv, 66 * s, 132 * s, 8 * s, 4.4 * s, [255, 157, 184, 200], 0);

  // 水花 (底部小椭圆, 半透明)
  fillEllipse(cv, 122 * s, 216 * s, 62 * s, 8 * s, [158, 208, 255, 70], 0);

  return cv.buf;
}

/* ---------------- 输出 ---------------- */

const outDir = path.join(__dirname, '..', 'assets');
fs.mkdirSync(outDir, { recursive: true });

const source = path.join(outDir, 'deepseek_fill.svg');

(async () => {
  await sharp(source).resize(512, 512).png().toFile(path.join(outDir, 'icon.png'));
  await sharp(source).resize(32, 32).png().toFile(path.join(outDir, 'tray.png'));
  console.log('generated assets/icon.png (512x512) and assets/tray.png (32x32) from deepseek_fill.svg');
})().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
