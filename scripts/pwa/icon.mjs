// The app icon, drawn in code: the First Architects' broken circle and star on night navy,
// rasterized with signed distance fields and written as PNG. No image files live in the repo;
// scripts/pwa/plugin.mjs renders these at dev-serve and build time.
//
//   renderIcon(size, { maskable })  -> RGBA Buffer (size*size*4)
//   encodePNG(width, height, rgba)  -> PNG Buffer
//
// Geometry matches src/ui/art/ArchitectSymbol.jsx (a 100x100 design space).

import { deflateSync } from 'node:zlib';

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const NAVY_950 = hex('#070d18');
const NAVY_700 = hex('#1f3150');
const GOLD_400 = hex('#e3c463');
const GOLD_GLOW = hex('#ffe9ae');
const STAR_COLOR = hex('#fff4d6');
const CORE = hex('#fffdf7');

const R = 33;
const RING_W = 4.8;
// The gap sits at about one o'clock (degrees, 0 = three o'clock, clockwise positive).
const GAP_START = -78;
const GAP_END = -38;

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const mix = (col, c, a) => {
  if (a <= 0) return;
  col[0] += (c[0] - col[0]) * a;
  col[1] += (c[1] - col[1]) * a;
  col[2] += (c[2] - col[2]) * a;
};

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = clamp01(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

const polar = (deg, r) => {
  const a = (deg * Math.PI) / 180;
  return [50 + Math.cos(a) * r, 50 + Math.sin(a) * r];
};

const inGap = (deg) => deg > GAP_START && deg < GAP_END;

/** Signed distance to the ring (butt caps at the gap). */
function ringDist(x, y) {
  const r = Math.hypot(x - 50, y - 50);
  const deg = (Math.atan2(y - 50, x - 50) * 180) / Math.PI;
  if (!inGap(deg)) return Math.abs(r - R) - RING_W / 2;
  const caps = [GAP_START, GAP_END].map((d) => {
    const [ax, ay] = polar(d, R - RING_W / 2);
    const [bx, by] = polar(d, R + RING_W / 2);
    return segDist(x, y, ax, ay, bx, by);
  });
  return Math.min(...caps);
}

// The four-pointed star: the same cubic curves as the in-game symbol, flattened to a polygon.
const STAR_PATH = [
  [50, 38.5], [51.1, 45.6], [52.4, 47.6], [58.6, 50],
  [52.4, 52.4], [51.1, 54.4], [50, 61.5],
  [48.9, 54.4], [47.6, 52.4], [41.4, 50],
  [47.6, 47.6], [48.9, 45.6], [50, 38.5],
];

function starPolygon(scale) {
  const pts = [];
  for (let k = 0; k < 4; k += 1) {
    const [p0, p1, p2, p3] = STAR_PATH.slice(k * 3, k * 3 + 4);
    for (let i = 0; i < 20; i += 1) {
      const t = i / 20;
      const u = 1 - t;
      const x = u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0];
      const y = u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1];
      pts.push([50 + (x - 50) * scale, 50 + (y - 50) * scale]);
    }
  }
  return pts;
}

function polyDist(x, y, pts) {
  let d = Infinity;
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i, i += 1) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    d = Math.min(d, segDist(x, y, xi, yi, xj, yj));
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside ? -d : d;
}

function roundRectDist(x, y, half, radius) {
  const qx = Math.abs(x - 50) - (half - radius);
  const qy = Math.abs(y - 50) - (half - radius);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
}

const TICKS = Array.from({ length: 24 }, (_, i) => i * 15)
  .filter((d) => {
    const n = ((d + 180) % 360) - 180;
    return !(n > GAP_START - 6 && n < GAP_END + 6);
  })
  .map((d) => [...polar(d, R + 5.5), ...polar(d, R + 8)]);

const STAR = starPolygon(1.18);

/**
 * Render the icon. `maskable` fills the whole square (the OS crops it) and keeps the symbol
 * inside the central safe zone; otherwise a rounded tile with a thin gilded inner border.
 */
export function renderIcon(size, { maskable = false } = {}) {
  const out = Buffer.alloc(size * size * 4);
  const unitPx = size / 100; // pixels per design unit
  const scale = maskable ? 0.78 : 0.9; // symbol scale about the centre
  const symPx = unitPx * scale;
  const cover = (d, px) => clamp01(0.5 - d * px);
  const col = [0, 0, 0];

  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      const u = ((px + 0.5) / size) * 100;
      const v = ((py + 0.5) / size) * 100;

      // Tile and background: a warm-lit navy, brighter just above the centre.
      const tileD = maskable ? -100 : roundRectDist(u, v, 50, 22);
      const alpha = maskable ? 1 : cover(tileD, unitPx);
      if (alpha <= 0) continue;
      const t = clamp01(Math.hypot(u - 50, v - 44) / 72);
      const e = t * t * (3 - 2 * t);
      col[0] = NAVY_700[0] + (NAVY_950[0] - NAVY_700[0]) * e;
      col[1] = NAVY_700[1] + (NAVY_950[1] - NAVY_700[1]) * e;
      col[2] = NAVY_700[2] + (NAVY_950[2] - NAVY_700[2]) * e;
      if (!maskable) mix(col, GOLD_400, 0.5 * cover(Math.abs(tileD + 4.2) - 0.45, unitPx));

      // Symbol space.
      const x = (u - 50) / scale + 50;
      const y = (v - 50) / scale + 50;
      const dc = Math.hypot(x - 50, y - 50);
      mix(col, GOLD_GLOW, 0.34 * Math.exp(-((dc / 20) ** 2)) + 0.1 * Math.exp(-((dc / 44) ** 2)));

      const ring = ringDist(x, y);
      mix(col, GOLD_GLOW, 0.36 * Math.exp(-((Math.max(ring, 0) / 3.2) ** 2)));
      for (const [ax, ay, bx, by] of TICKS) {
        const d = segDist(x, y, ax, ay, bx, by) - 0.8;
        if (d < 1.5) mix(col, STAR_COLOR, 0.4 * cover(d, symPx));
      }
      mix(col, GOLD_400, cover(ring, symPx));
      const r = Math.hypot(x - 50, y - 50);
      const deg = (Math.atan2(y - 50, x - 50) * 180) / Math.PI;
      if (!inGap(deg)) mix(col, CORE, 0.55 * cover(Math.abs(r - R) - 0.6, symPx));

      if (dc < 20) {
        const star = polyDist(x, y, STAR);
        mix(col, GOLD_GLOW, 0.45 * Math.exp(-((Math.max(star, 0) / 2.4) ** 2)));
        mix(col, STAR_COLOR, cover(star, symPx));
        mix(col, CORE, cover(dc - 1.7, symPx));
      }

      const o = (py * size + px) * 4;
      out[o] = Math.round(col[0]);
      out[o + 1] = Math.round(col[1]);
      out[o + 2] = Math.round(col[2]);
      out[o + 3] = Math.round(alpha * 255);
    }
  }
  return out;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

/** Minimal PNG writer: 8-bit RGBA, no filtering, zlib-compressed. */
export function encodePNG(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
