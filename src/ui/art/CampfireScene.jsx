// <CampfireScene intensity={0..1} fireX fireY band moon variant scrim className style />
// The night camp on <canvas>, painted like a key-art frame: a deep starry sky with a milky-way band,
// moonlit cloud, layered mountains, mist and treeline; a camp of canvas tents, a cart, a weapon
// rack and the Elvian banner; the Sovereign and General Mara Voss seated on logs, leaning in to the
// warmth, and Sparky curled by the stones; a real fire (log crib, coal bed, layered flame tongues
// with turbulence, embers and thin smoke that catches the light at its root).
//
// Everything that does not move is painted ONCE into two stacked static canvases of the same
// geometry: a cold, moonlit pass and a warm, fire-lit pass (long shadows thrown away from the fire,
// a broad bounce of firelight on the ground and the low sky), the warm one masked by a radial
// falloff. The firelight's flicker is the warm canvas's CSS opacity, animated on the compositor
// (Web Animations), so it costs no repaint. Only two small canvases redraw, at most 30 times a
// second: the fire box (pit, flames, the front stones, Sparky breathing) and the air above it
// (smoke wisps and embers, at DPR 1). The moon is its own little canvas above `scrim` (a node the
// screen passes to sit between the camp and the live layers), so it stays luminous over any text
// scrim, and the fire itself is never dimmed by one.
//
// Props: `intensity` (0–1) raises the flames, the light's reach and its strength. `fireX`/`fireY`
// place the fire as fractions of the box (a pair picks [portrait, wide] by aspect). `band` anchors
// the fire group in a bottom band of `campfireBand(height)` px instead (the campfire screen keeps
// that band clear of text). `moon` is [x, y] fractions (or a [portrait, wide] pair of them), or
// false. `zoom` scales the whole camp. `variant="last"` is the Passing's last fire: a struck camp
// dusted with frost, the Sovereign alone across an empty log, a low red-gold fire, long smoke and
// a furled banner.
//
// devicePixelRatio capped at 2, layers rebuilt on resize (coalesced; small height-only changes such
// as a phone's URL bar are debounced), paused offscreen or in a hidden tab, a single still frame
// under reduced motion, and nothing is built or stepped while the box measures 0×0. The camp fades
// in over 350 ms once built. Fills its positioned parent. Decorative (aria-hidden).

import { memo, useEffect, useRef } from 'react';
import { C, LIGHT } from './palette.js';
import { clamp, mulberry32, useReducedMotion, watchVisibility } from './util.js';

const TAU = Math.PI * 2;
const STILL_T = 2.35; // the frame shown under reduced motion

// ---- colour: every shade below is mixed from the palette ------------------------------------
function rgbOf(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a, b, t) {
  const A = rgbOf(a);
  const B = rgbOf(b);
  return `#${A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}
function rgba(h, a) {
  const [r, g, b] = rgbOf(h);
  return `rgba(${r},${g},${b},${clamp(a, 0, 1).toFixed(3)})`;
}

const N = LIGHT.night;
const BLACK = mix(C.navy950, '#000000', 0.55);
const K = {
  skyTop: mix(C.navy950, BLACK, 0.55),
  skyMid: C.navy900,
  skyLow: mix(mix(C.navy800, C.navy700, 0.6), C.frost500, 0.08),
  haze: N.haze,
  mountain: mix(N.mountain, C.navy900, 0.25),
  mountainShade: mix(N.mountain, C.navy950, 0.55),
  snow: N.mountainSnow,
  ridge: mix(N.far, C.navy800, 0.3),
  pineFar: mix(N.pineFar, C.navy800, 0.15),
  pineMid: N.pineMid,
  pineNear: mix(N.pineNear, C.navy950, 0.35),
  ground: N.fg,
  groundDeep: mix(N.fgDeep, BLACK, 0.3),
  dirt: mix(N.fg, C.stone800, 0.35),
  dirtWarm: mix(C.ember600, C.ink, 0.42),
  dirtHot: mix(C.ember500, C.ember300, 0.25),
  grass: mix(N.pineMid, C.stone800, 0.2),
  grassWarm: mix(C.ember600, C.gold700, 0.35),
  // tent canvas in moonlight stays a dark navy shape; only its ridge catches the moon
  canvasLit: mix(mix(N.canvas, C.navy850, 0.55), C.frost500, 0.05),
  canvasShade: mix(N.canvasDark, C.navy950, 0.55),
  canvasWarm: mix(mix(C.parch400, C.ember400, 0.55), C.ink, 0.3),
  canvasWarmDark: mix(C.ember600, N.canvasDark, 0.5),
  wood: mix(N.woodDark, C.navy950, 0.2),
  woodLit: mix(N.wood, C.stone600, 0.25),
  woodWarm: mix(C.ember500, C.ink, 0.3),
  woodWarmDark: mix(C.ember600, C.ink, 0.65),
  figure: mix(C.navy950, C.navy850, 0.35),
  figureMoon: mix(C.navy800, C.frost500, 0.25),
  figureWarm: mix(mix(C.ember600, C.ink, 0.8), BLACK, 0.55),
  figureWarmLit: mix(C.ember500, C.ember300, 0.45),
  stone: mix(N.stoneDark, C.navy900, 0.25),
  stoneMoon: mix(N.stone, C.frost500, 0.2),
  stoneWarm: mix(C.stone800, C.ember600, 0.45),
  stoneWarmLit: mix(C.ember300, C.parch300, 0.35),
  iron: mix(C.iron500, C.navy800, 0.4),
  ironWarm: mix(C.iron300, C.ember300, 0.45),
  brass: C.brass500,
  shadow: mix(C.ink, BLACK, 0.5),
  moon: C.lattice100,
  moonGlow: C.frost300,
  cloud: mix(C.navy700, C.frost500, 0.22),
  cloudLit: mix(C.frost300, C.navy700, 0.35),
};

// ---- layout ----------------------------------------------------------------------------------
/**
 * Height in px of the clear bottom band the fire group sits in when `band` is set. The campfire
 * screen reserves the same height with CSS: clamp(220px, 30dvh, 280px), or 30dvh when short.
 */
function campfireBand(h) {
  return h < 600 ? h * 0.3 : clamp(h * 0.3, 220, 280);
}

const DEFAULT_MOON = [
  [0.83, 0.135],
  [0.9, 0.16],
];

/** Fire anchor and scale for a w×h canvas. `fy` is the ground under the fire. */
function layout(w, h, o) {
  const wide = w > h * 0.9;
  const pick = (v, d) => {
    const n = Number(Array.isArray(v) ? (wide ? v[1] : v[0]) : v);
    return Number.isFinite(n) ? n : d;
  };
  const fx = w * clamp(pick(o.fireX, 0.5), 0.08, 0.92);
  let s;
  let fy;
  let bandTop = null;
  if (o.band) {
    const b = campfireBand(h);
    s = clamp(Math.min(w / 380, b / 190) * (o.zoom || 1), 0.55, 1.6);
    fy = h - b * 0.25;
    bandTop = h - b;
  } else {
    s = clamp(Math.min(w / 380, h / 600) * (o.zoom || 1), 0.5, 1.9);
    fy = h * clamp(pick(o.fireY, 0.82), 0.3, 0.95);
  }
  const horizon = fy - 150 * s;
  let moon = null;
  if (o.moon !== false) {
    const m = Array.isArray(o.moon) ? (Array.isArray(o.moon[0]) ? (wide ? o.moon[1] : o.moon[0]) : o.moon) : wide ? DEFAULT_MOON[1] : DEFAULT_MOON[0];
    const r = clamp(10 * s, 9, 16);
    moon = { x: w * m[0], y: Math.min(h * m[1], horizon - r * 2), r };
  }
  return { w, h, fx, fy, s, horizon, lx: fx, ly: fy - 34 * s, wide, moon, bandTop, last: o.variant === 'last' };
}

// ---- small canvas helpers --------------------------------------------------------------------
function layer(w, h, dpr) {
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.round(w * dpr));
  cv.height = Math.max(1, Math.round(h * dpr));
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { cv, ctx };
}

function softDot(ctx, x, y, r, col, a) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(col, a));
  g.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

/** A radial "facing the fire" gradient in the current transform: lit near (lx,ly), dark beyond. */
function fireGrad(ctx, lx, ly, cx, cy, reach, col, a = 1) {
  const d = Math.hypot(cx - lx, cy - ly);
  const R = d + reach;
  const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, R);
  const a0 = clamp((d - reach * 0.9) / R, 0, 0.96);
  const a1 = clamp((d + reach * 0.05) / R, a0 + 0.01, 0.98);
  g.addColorStop(0, rgba(col, a));
  g.addColorStop(a0, rgba(col, a));
  g.addColorStop(a1, rgba(col, a * 0.28));
  g.addColorStop(1, rgba(col, 0));
  return g;
}

/** Fill a path with a dark base and the fire's light falling across it. */
function warmFill(ctx, path, lx, ly, cx, cy, reach, dark, lit, a = 1) {
  ctx.fillStyle = dark;
  ctx.fill(path);
  ctx.fillStyle = fireGrad(ctx, lx, ly, cx, cy, reach, lit, a);
  ctx.fill(path);
}

/** A crisp inner rim on the side of a shape that faces (lx,ly). */
function rim(ctx, path, lx, ly, cx, cy, reach, col, width, a = 1) {
  ctx.save();
  ctx.clip(path);
  const d = Math.hypot(cx - lx, cy - ly);
  const R = d + reach;
  const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, R);
  g.addColorStop(0, rgba(col, a));
  g.addColorStop(clamp((d - reach * 0.2) / R, 0, 0.97), rgba(col, a));
  g.addColorStop(clamp((d + reach * 0.25) / R, 0.02, 0.99), rgba(col, 0));
  g.addColorStop(1, rgba(col, 0));
  ctx.strokeStyle = g;
  ctx.lineWidth = width * 2;
  ctx.lineJoin = 'round';
  ctx.stroke(path);
  ctx.restore();
}

/** Moonlight on the upper-right edge of a shape (x0,y0)-(x1,y1) is its bounding box. */
function moonRim(ctx, path, x0, y0, x1, y1, width, a = 0.5) {
  ctx.save();
  ctx.clip(path);
  const g = ctx.createLinearGradient(x1, y0, x0 + (x1 - x0) * 0.45, y0 + (y1 - y0) * 0.6);
  g.addColorStop(0, rgba(C.frost300, a));
  g.addColorStop(1, rgba(C.frost300, 0));
  ctx.strokeStyle = g;
  ctx.lineWidth = width * 2;
  ctx.lineJoin = 'round';
  ctx.stroke(path);
  ctx.restore();
}

/**
 * Paint a silhouette lit from one side: a crisp crescent of `rimCol` on the edge facing (lx,ly)
 * (the part of the shape its own copy, nudged away from the light, does not cover) over a soft
 * bounce of `bounce` falling across the lit half. (cx,cy) is the shape's centre.
 */
function litShape(ctx, path, lx, ly, cx, cy, { dark, rimCol, rimW = 1.4, rimA = 1, bounce, bounceA = 0, span = 30, fade = null, rimHot = null, fill = true }) {
  const dx = lx - cx;
  const dy = ly - cy;
  const d = Math.hypot(dx, dy) || 1;
  const nx = dx / d;
  const ny = dy / d;
  if (fill) {
    ctx.fillStyle = dark;
    ctx.fill(path);
  }
  ctx.save();
  ctx.clip(path);
  if (bounce && bounceA > 0) {
    const g = ctx.createLinearGradient(cx + nx * span, cy + ny * span, cx - nx * span * 0.25, cy - ny * span * 0.25);
    g.addColorStop(0, rgba(bounce, bounceA));
    g.addColorStop(0.45, rgba(bounce, bounceA * 0.35));
    g.addColorStop(1, rgba(bounce, 0));
    ctx.fillStyle = g;
    ctx.fillRect(cx - span * 2, cy - span * 2, span * 4, span * 4);
  }
  // the crescent: everything inside the shape that its own copy, nudged away from the light, misses
  const cut = new Path2D();
  cut.rect(cx - 4000, cy - 4000, 8000, 8000);
  cut.addPath(path, { a: 1, b: 0, c: 0, d: 1, e: -nx * rimW, f: -ny * rimW });
  if (fade) {
    // a graded rim: hottest (rimHot) on the parts nearest the light, gone by fade[1]
    const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, fade[1]);
    const f0 = clamp(fade[0] / fade[1], 0, 0.95);
    g.addColorStop(0, rgba(rimHot || rimCol, rimA));
    g.addColorStop(f0, rgba(rimHot || rimCol, rimA));
    g.addColorStop(Math.min(0.99, f0 + (1 - f0) * 0.45), rgba(rimCol, rimA * 0.75));
    g.addColorStop(1, rgba(rimCol, 0));
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = rgba(rimCol, rimA);
  }
  ctx.fill(cut, 'evenodd');
  ctx.restore();
}

/** A limb or drape as a closed outline around a polyline: half-widths per point, round ends. */
function tube(pts, ws) {
  const n = pts.length;
  const Lp = [];
  const Rp = [];
  const ang = [];
  for (let i = 0; i < n; i += 1) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0];
    let dy = b[1] - a[1];
    const dl = Math.hypot(dx, dy) || 1;
    dx /= dl;
    dy /= dl;
    const [x, y] = pts[i];
    Lp.push([x - dy * ws[i], y + dx * ws[i]]);
    Rp.push([x + dy * ws[i], y - dx * ws[i]]);
    ang.push(Math.atan2(dx, -dy));
  }
  const p = new Path2D();
  p.moveTo(...Lp[0]);
  for (let i = 1; i < n - 1; i += 1) p.quadraticCurveTo(Lp[i][0], Lp[i][1], (Lp[i][0] + Lp[i + 1][0]) / 2, (Lp[i][1] + Lp[i + 1][1]) / 2);
  p.lineTo(...Lp[n - 1]);
  p.arc(pts[n - 1][0], pts[n - 1][1], ws[n - 1], ang[n - 1], ang[n - 1] - Math.PI, true);
  for (let i = n - 2; i > 0; i -= 1) p.quadraticCurveTo(Rp[i][0], Rp[i][1], (Rp[i][0] + Rp[i - 1][0]) / 2, (Rp[i][1] + Rp[i - 1][1]) / 2);
  p.lineTo(...Rp[0]);
  p.arc(pts[0][0], pts[0][1], ws[0], ang[0], ang[0] + Math.PI, true);
  p.closePath();
  return p;
}

/** A Path2D placed at (x,y), rotated by `rot` radians and scaled by k. */
function placed(path, x, y, rot = 0, k = 1) {
  const p = new Path2D();
  const c = Math.cos(rot) * k;
  const s = Math.sin(rot) * k;
  p.addPath(path, { a: c, b: s, c: -s, d: c, e: x, f: y });
  return p;
}

/** A shadow thrown from (x,y) on the ground directly away from the fire. */
function castShadow(ctx, L, x, y, len, wid, a = 0.62) {
  const ang = Math.atan2(y - L.fy, x - L.fx);
  const dist = Math.hypot(x - L.fx, (y - L.fy) * 2.2);
  const stretch = len * (1 + dist / (260 * L.s));
  ctx.save();
  ctx.translate(x, y);
  // ground plane: squash the shadow vertically
  ctx.scale(1, 0.42);
  ctx.rotate(Math.atan2(Math.sin(ang) * 2.4, Math.cos(ang)));
  const g = ctx.createLinearGradient(0, 0, stretch, 0);
  g.addColorStop(0, rgba(K.shadow, a));
  g.addColorStop(0.55, rgba(K.shadow, a * 0.45));
  g.addColorStop(1, rgba(K.shadow, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, -wid * 0.5);
  ctx.quadraticCurveTo(stretch * 0.7, -wid * 0.75, stretch, 0);
  ctx.quadraticCurveTo(stretch * 0.7, wid * 0.75, 0, wid * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function contactShadow(ctx, x, y, rx, ry, a = 0.6) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, rgba(K.shadow, a));
  g.addColorStop(1, rgba(K.shadow, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// ---- the sky (cold layer only) ---------------------------------------------------------------
function paintSky(ctx, L) {
  const { w, h, horizon } = L;
  const g = ctx.createLinearGradient(0, 0, 0, horizon + 40 * L.s);
  g.addColorStop(0, K.skyTop);
  g.addColorStop(0.5, K.skyMid);
  g.addColorStop(0.86, K.skyLow);
  g.addColorStop(1, mix(K.skyLow, K.haze, 0.5));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const rnd = mulberry32(4127);
  const moon = L.moon || { x: w * 0.85, y: horizon * 0.3, r: 10 };
  // the moon's own light on the sky around it (the disc itself is a separate layer above any scrim)
  softDot(ctx, moon.x, moon.y, moon.r * 18, K.moonGlow, 0.07);
  // The milky way: a soft band from low left to high right, dust lane down its spine.
  const ax = -0.1 * w;
  const ay = horizon * 0.95;
  const bx = 1.1 * w;
  const by = -0.12 * horizon;
  const len = Math.hypot(bx - ax, by - ay);
  const nx = -(by - ay) / len;
  const ny = (bx - ax) / len;
  const band = Math.max(60, Math.min(w, h) * 0.16);
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 46; i += 1) {
    const t = rnd();
    const off = (rnd() + rnd() + rnd() - 1.5) * band * 0.7;
    const x = ax + (bx - ax) * t + nx * off;
    const y = ay + (by - ay) * t + ny * off;
    const r = band * (0.45 + rnd() * 0.9);
    const col = rnd() < 0.3 ? C.gold200 : rnd() < 0.5 ? C.frost300 : C.frost500;
    softDot(ctx, x, y, r, col, 0.05 + rnd() * 0.045);
  }
  ctx.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 26; i += 1) {
    const t = 0.1 + rnd() * 0.85;
    const off = (rnd() - 0.4) * band * 0.35;
    softDot(ctx, ax + (bx - ax) * t + nx * off, ay + (by - ay) * t + ny * off, band * (0.18 + rnd() * 0.3), K.skyTop, 0.22 + rnd() * 0.2);
  }
  // Stars: dense along the band, sparse in the field, a few bright ones with four-point glints.
  const area = (w * horizon) / 1000;
  const field = Math.round(clamp(area * 0.9, 80, 380));
  const dense = Math.round(clamp(area * 2.2, 200, 1100));
  const star = (x, y, r, a, col) => {
    if (y > horizon + 4) return;
    ctx.fillStyle = rgba(col, a);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  };
  for (let i = 0; i < field; i += 1) star(rnd() * w, rnd() * horizon, 0.35 + rnd() * 0.7, 0.25 + rnd() * 0.55, rnd() < 0.2 ? C.gold200 : C.lattice200);
  for (let i = 0; i < dense; i += 1) {
    const t = rnd();
    const off = (rnd() + rnd() + rnd() + rnd() - 2) * band * 0.55;
    star(ax + (bx - ax) * t + nx * off, ay + (by - ay) * t + ny * off, 0.25 + rnd() * 0.55, 0.18 + rnd() * 0.5, rnd() < 0.5 ? C.frost100 : C.lattice200);
  }
  // fade stars into the horizon haze
  const fade = ctx.createLinearGradient(0, horizon * 0.55, 0, horizon + 10);
  fade.addColorStop(0, rgba(K.skyLow, 0));
  fade.addColorStop(1, rgba(mix(K.skyLow, K.haze, 0.4), 0.85));
  ctx.fillStyle = fade;
  ctx.fillRect(0, horizon * 0.55, w, horizon * 0.45 + 12);

  // Clouds: long low strata, moonlit on their upper edges.
  const banks = [
    { y: 0.5, x: 0.15, len: 0.55, th: 0.06 },
    { y: 0.68, x: 0.72, len: 0.6, th: 0.05 },
    { y: 0.3, x: 0.62, len: 0.42, th: 0.04 },
    { y: 0.82, x: 0.3, len: 0.7, th: 0.045 },
  ];
  for (const b of banks) {
    const cy = horizon * b.y;
    const cx = w * b.x;
    const hw = w * b.len * 0.5;
    const th = Math.max(10, horizon * b.th);
    const bend = rnd() * TAU;
    for (let i = 0; i < 26; i += 1) {
      const t = rnd() * 2 - 1;
      const x = cx + t * hw;
      // puffs ride a gently bending spine and thin out toward the ends of the bank
      const y = cy + Math.sin(t * 2.4 + bend) * th * 0.9 + (rnd() - 0.5) * th * 0.5 + t * th * 0.6;
      const rr = th * (0.6 + rnd() * 1.2) * (1 - t * t * 0.7);
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(2.6, 1);
      softDot(ctx, 0, 0, rr, K.cloud, 0.16);
      ctx.restore();
      // the moonlit crest
      const near = 1 - clamp(Math.hypot(x - moon.x, y - moon.y) / (w * 0.6), 0, 1);
      ctx.save();
      ctx.translate(x, y - rr * 0.35);
      ctx.scale(2.6, 0.5);
      ctx.globalCompositeOperation = 'lighter';
      softDot(ctx, 0, 0, rr * 0.8, K.cloudLit, 0.04 + near * 0.11);
      ctx.restore();
    }
  }
}

// ---- terrain ----------------------------------------------------------------------------------
function waves(seed, n) {
  const rnd = mulberry32(seed);
  return Array.from({ length: n }, (_, i) => ({ f: (0.6 + rnd() * 0.8) * (i + 1) * 1.7, p: rnd() * TAU, a: 1 / (i + 1) ** 1.15 }));
}
const sumWaves = (ws, x) => ws.reduce((acc, o) => acc + Math.sin(x * o.f + o.p) * o.a, 0);

function ridgeFill(ctx, L, ws, base, amp, fill, step = 4) {
  const { w, h } = L;
  ctx.beginPath();
  ctx.moveTo(0, h);
  const pts = [];
  for (let x = -step; x <= w + step; x += step) {
    const y = base - amp * (0.55 + 0.45 * sumWaves(ws, x / Math.max(320, w * 0.7)));
    pts.push([x, y]);
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  return pts;
}

function pineInto(path, x, base, ht, rnd) {
  const tiers = 4 + Math.floor(rnd() * 3);
  const wBase = ht * (0.26 + rnd() * 0.08);
  const top = base - ht;
  path.moveTo(x, top);
  const right = [];
  for (let i = 1; i <= tiers; i += 1) {
    const t = i / tiers;
    const y = top + ht * 0.92 * t;
    const wd = wBase * (0.25 + 0.75 * t) * (0.85 + rnd() * 0.3);
    right.push([x + wd, y, x + wd * 0.42, y - ht * 0.05]);
  }
  for (const [ox, oy, ix, iy] of right) {
    path.lineTo(ox, oy);
    path.lineTo(ix, iy);
  }
  path.lineTo(x + ht * 0.03, base);
  path.lineTo(x - ht * 0.03, base);
  for (let i = right.length - 1; i >= 0; i -= 1) {
    const [ox, oy, ix, iy] = right[i];
    path.lineTo(x - (ix - x) * (0.9 + rnd() * 0.2), iy);
    path.lineTo(x - (ox - x) * (0.9 + rnd() * 0.2), oy);
  }
  path.closePath();
}

function forestBand(ctx, L, seed, base, hMin, hMax, gap, fill, opts = {}) {
  const rnd = mulberry32(seed);
  const p = new Path2D();
  const avoid = opts.avoid || 0;
  for (let x = -20; x < L.w + 20; x += gap * (0.5 + rnd())) {
    if (avoid && Math.abs(x - L.fx) < avoid * (0.7 + rnd() * 0.5)) continue;
    const b = base + (rnd() - 0.5) * gap * 0.35 + (opts.wave ? opts.wave(x) : 0);
    pineInto(p, x, b, hMin + rnd() * (hMax - hMin), rnd);
  }
  // fill the gap under the trunks
  ctx.fillStyle = fill;
  ctx.fill(p);
  return p;
}

function paintTerrain(ctx, L) {
  const { w, h, s, horizon } = L;
  // two ranges of far mountains: snow and moonlight on the crests, the near range darker
  const ranges = [
    { seed: 91, base: horizon - 34 * s, amp: 150 * s, fill: mix(K.mountain, K.skyLow, 0.35), lit: 0.14 },
    { seed: 47, base: horizon - 10 * s, amp: 92 * s, fill: mix(K.mountain, C.navy950, 0.42), lit: 0.2 },
  ];
  for (const R of ranges) {
    // ridged noise: inverted |sin| octaves give sharp crests and broad valleys
    const rnd = mulberry32(R.seed);
    const oct = Array.from({ length: 4 }, (_, i) => ({ f: (1.1 + rnd() * 0.5) * 2 ** i, p: rnd() * TAU, a: 0.55 ** i }));
    const norm = oct.reduce((a, o) => a + o.a, 0);
    const pts = [];
    for (let x = -4; x <= w + 4; x += 3) {
      const v = oct.reduce((a, o) => a + o.a * (1 - Math.abs(Math.sin((x / (190 * s)) * o.f + o.p))), 0) / norm;
      const roll = 0.5 + 0.5 * Math.sin(x / (420 * s) + R.seed);
      pts.push([x, R.base - R.amp * clamp(0.12 + 0.55 * v * v + 0.3 * roll * v, 0.05, 1)]);
    }
    const mtn = new Path2D();
    mtn.moveTo(0, h);
    for (const [x, y] of pts) mtn.lineTo(x, y);
    mtn.lineTo(w, h);
    mtn.closePath();
    const mg = ctx.createLinearGradient(0, R.base - R.amp, 0, R.base);
    mg.addColorStop(0, R.fill);
    mg.addColorStop(1, mix(R.fill, K.mountainShade, 0.6));
    ctx.fillStyle = mg;
    ctx.fill(mtn);
    ctx.save();
    ctx.clip(mtn);
    // moonlit faces: slopes that fall away to the right face the moon; a cap of snow on the high ones
    const lit = new Path2D();
    const snow = new Path2D();
    for (let i = 1; i < pts.length; i += 1) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      if (y1 <= y0) continue;
      const dep = (R.base - y0) * 0.55;
      lit.moveTo(x0, y0);
      lit.lineTo(x1 + 1, y1);
      lit.lineTo(x1 - dep * 0.35, y1 + dep);
      lit.lineTo(x0 - dep * 0.35 - 1, y0 + dep);
      lit.closePath();
      const hi = (R.base - y0) / R.amp;
      if (hi > 0.62) {
        const sd = (hi - 0.62) * R.amp * 0.5;
        snow.moveTo(x0, y0);
        snow.lineTo(x1 + 1, y1);
        snow.lineTo(x1 - sd * 0.2, y1 + sd);
        snow.lineTo(x0 - sd * 0.2 - 1, y0 + sd);
        snow.closePath();
      }
    }
    const lg = ctx.createLinearGradient(0, R.base - R.amp, 0, R.base);
    lg.addColorStop(0, rgba(K.cloudLit, R.lit * 1.6));
    lg.addColorStop(1, rgba(K.cloudLit, 0));
    ctx.fillStyle = lg;
    ctx.fill(lit);
    ctx.fillStyle = rgba(K.snow, R.lit * 1.8);
    ctx.fill(snow);
    ctx.restore();
  }
  // mist pooled in the valley
  const mist = ctx.createLinearGradient(0, horizon - 60 * s, 0, horizon);
  mist.addColorStop(0, rgba(K.haze, 0));
  mist.addColorStop(1, rgba(K.haze, 0.6));
  ctx.fillStyle = mist;
  ctx.fillRect(0, horizon - 60 * s, w, 60 * s);

  // a far ridge of pines, then the near treeline either side of the clearing
  const rw = waves(17, 3);
  ridgeFill(ctx, L, rw, horizon + 4 * s, 22 * s, K.ridge, 6);
  forestBand(ctx, L, 33, horizon - 2 * s, 18 * s, 34 * s, 7 * s, K.pineFar, { wave: (x) => -10 * s * (0.5 + 0.5 * sumWaves(rw, x / Math.max(320, w * 0.7))) });
  const mist2 = ctx.createLinearGradient(0, horizon - 20 * s, 0, horizon + 12 * s);
  mist2.addColorStop(0, rgba(K.haze, 0));
  mist2.addColorStop(1, rgba(K.haze, 0.42));
  ctx.fillStyle = mist2;
  ctx.fillRect(0, horizon - 20 * s, w, 34 * s);
  forestBand(ctx, L, 57, horizon + 8 * s, 26 * s, 70 * s, 13 * s, K.pineMid, { wave: (x) => 8 * s * Math.sin(x / (90 * s)) });
  // a soft ground mist where the trees stand, so the clearing has no hard edge
  const mist3 = ctx.createLinearGradient(0, horizon - 8 * s, 0, horizon + 26 * s);
  mist3.addColorStop(0, rgba(K.haze, 0));
  mist3.addColorStop(0.6, rgba(K.haze, 0.38));
  mist3.addColorStop(1, rgba(K.haze, 0));
  ctx.fillStyle = mist3;
  ctx.fillRect(0, horizon - 8 * s, w, 34 * s);
}

function frameTrees(ctx, L, warm) {
  // a few tall dark pines at the edges, close to us, framing the clearing
  const { w, s, horizon } = L;
  const rnd = mulberry32(611);
  const p = new Path2D();
  const spots = L.wide ? [0.02, 0.07, 0.94, 0.985] : [-0.02, 1.02];
  for (const f of spots) pineInto(p, w * f + (rnd() - 0.5) * 10 * s, horizon + (40 + rnd() * 30) * s, (150 + rnd() * 70) * s, rnd);
  if (warm) {
    ctx.fillStyle = mix(K.figureWarm, BLACK, 0.4);
    ctx.fill(p);
  } else {
    // in the last winter the moonlit tops of the boughs are frost
    litShape(ctx, p, w * 0.5 + 600, horizon - 900, w * 0.5, horizon, L.last ? { dark: K.pineNear, rimCol: C.frost300, rimW: 2, rimA: 0.42 } : { dark: K.pineNear, rimCol: K.figureMoon, rimW: 1.2, rimA: 0.35 });
  }
}

/** The moon: a frost halo at 8× and 2.5× its radius, then a bright disc with faint maria. */
function paintMoon(ctx, R, r) {
  softDot(ctx, R, R, r * 8, K.moonGlow, 0.16);
  softDot(ctx, R, R, r * 4, C.frost200, 0.22);
  softDot(ctx, R, R, r * 2.5, C.lattice200, 0.5);
  const disc = ctx.createRadialGradient(R - r * 0.25, R - r * 0.3, 0, R, R, r);
  disc.addColorStop(0, C.lattice100);
  disc.addColorStop(0.75, C.lattice200);
  disc.addColorStop(1, mix(C.lattice200, C.frost300, 0.4));
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(R, R, r, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = rgba(C.frost300, 0.26);
  for (const [dx, dy, rr] of [
    [-0.3, -0.18, 0.3],
    [0.22, 0.18, 0.22],
    [-0.08, 0.45, 0.17],
    [0.38, -0.34, 0.12],
  ]) {
    ctx.beginPath();
    ctx.arc(R + dx * r, R + dy * r, rr * r, 0, TAU);
    ctx.fill();
  }
  const limb = ctx.createLinearGradient(R + r, R - r, R - r, R + r);
  limb.addColorStop(0.5, rgba(C.frost500, 0));
  limb.addColorStop(1, rgba(C.frost500, 0.3));
  ctx.fillStyle = limb;
  ctx.fillRect(R - r, R - r, r * 2, r * 2);
  ctx.restore();
}

function groundPath(L) {
  const p = new Path2D();
  p.rect(-10, L.horizon + 6 * L.s, L.w + 20, L.h - L.horizon);
  return p;
}

function flatDot(ctx, x, y, r, sy, col, a) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, sy);
  softDot(ctx, 0, 0, r, col, a);
  ctx.restore();
}

function paintGround(ctx, L, warm) {
  const { w, h, s, horizon, fx, fy, last } = L;
  const top = horizon + 4 * s;
  if (!warm) {
    const g = ctx.createLinearGradient(0, top, 0, h);
    g.addColorStop(0, mix(K.ground, K.haze, 0.25));
    g.addColorStop(0.35, K.ground);
    g.addColorStop(1, K.groundDeep);
    ctx.fillStyle = g;
    ctx.fillRect(0, top, w, h - top);
    // the trodden clearing
    flatDot(ctx, fx, fy - 10 * s, 330 * s, 0.28, K.dirt, 0.85);
    if (last) {
      // the last winter: a frost dusting over everything the fire does not reach
      ctx.fillStyle = rgba(C.frost300, 0.2);
      ctx.fillRect(0, top, w, h - top);
      const rnd = mulberry32(919);
      for (let i = 0; i < 26; i += 1) {
        const y = top + rnd() ** 0.9 * (h - top);
        const depth = clamp((y - horizon) / (fy - horizon), 0.25, 1.8);
        flatDot(ctx, rnd() * w, y, (50 + rnd() * 110) * s * depth, 0.3, C.frost200, 0.16 + rnd() * 0.12);
      }
    }
  } else {
    const wg = ctx.createLinearGradient(0, top, 0, top + 70 * s);
    wg.addColorStop(0, rgba(K.dirtWarm, 0));
    wg.addColorStop(1, rgba(K.dirtWarm, 1));
    ctx.fillStyle = wg;
    ctx.fillRect(0, top, w, h - top);
    if (last) {
      // frost lit by the fire, melted back to dark wet earth around the stones
      ctx.fillStyle = rgba(mix(C.ember300, C.parch300, 0.45), 0.2);
      ctx.fillRect(0, top, w, h - top);
      flatDot(ctx, fx, fy, 170 * s, 0.34, mix(K.dirtWarm, BLACK, 0.35), 0.85);
    }
    // trampled earth: a broad warm falloff, then the hot ring right round the stones
    flatDot(ctx, fx, fy - 2 * s, 420 * s, 0.3, mix(K.dirtWarm, C.ember500, 0.35), 0.75);
    flatDot(ctx, fx, fy - 4 * s, 200 * s, 0.32, K.dirtHot, last ? 0.7 : 0.9);
  }
  // a trodden track that leaves the clearing toward us and the lower left, widening with depth
  ctx.save();
  for (let i = 0; i <= 26; i += 1) {
    const t = i / 26;
    const px = fx - 30 * s + (w * 0.18 - fx + 30 * s) * t * t + Math.sin(t * 3) * 30 * s;
    const py = fy + 18 * s + (h + 20 - fy - 18 * s) * t;
    const r = (26 + t * 90) * s;
    ctx.save();
    ctx.translate(px, py);
    ctx.scale(1.7, 0.4);
    softDot(ctx, 0, 0, r, warm ? K.dirtWarm : K.dirt, warm ? 0.5 : 0.32);
    ctx.restore();
  }
  // broad, faint patches of darker and paler earth so the ground is not one flat fill
  const prn = mulberry32(1307);
  for (let i = 0; i < 16; i += 1) {
    const x = prn() * w;
    const y = top + (prn() ** 0.8) * (h - top);
    const depth = clamp((y - horizon) / (fy - horizon), 0.2, 1.8);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(2.4, 0.42);
    softDot(ctx, 0, 0, (40 + prn() * 80) * s * depth, prn() < 0.5 ? K.groundDeep : warm ? K.dirtWarm : K.dirt, 0.28);
    ctx.restore();
  }
  ctx.restore();
  // the ground nearest the lens falls away into shadow
  const fgTop = Math.max(fy + 30 * s, h - (h - top) * 0.3);
  const fg = ctx.createLinearGradient(0, fgTop, 0, h);
  fg.addColorStop(0, rgba(BLACK, 0));
  fg.addColorStop(1, rgba(BLACK, warm ? 0.5 : 0.42));
  ctx.fillStyle = fg;
  ctx.fillRect(0, fgTop, w, h - fgTop);

  // texture: clustered grass clumps of four kinds, pebbles, and rocks and roots by the ring —
  // the same scatter in both passes, darker toward the camera
  const rnd = mulberry32(2203);
  const clusters = Math.round(clamp((w * (h - top)) / 9000, 16, 70));
  const grass = new Path2D();
  const grassNear = new Path2D();
  for (let c = 0; c < clusters; c += 1) {
    const cy0 = top + rnd() ** 0.75 * (h - top);
    const cx0 = rnd() * w;
    const n = 2 + Math.floor(rnd() * 4);
    for (let j = 0; j < n; j += 1) {
      const depth = clamp((cy0 - horizon) / (fy - horizon), 0.18, 1.9);
      const x = cx0 + (rnd() - 0.5) * 34 * s * depth;
      const y = cy0 + (rnd() - 0.5) * 8 * s * depth;
      const kind = Math.floor(rnd() * 4);
      const k = (0.7 + rnd() * 0.8) * s * depth;
      const lean = (rnd() - 0.5) * 0.8;
      if (Math.hypot((x - fx) / s, ((y - fy) / s) * 2.6) < 150 && Math.abs(y - fy) < 40 * s) continue;
      const path = y > fgTop ? grassNear : grass;
      const blades = kind === 0 ? 9 : kind === 1 ? 4 : kind === 2 ? 6 : 4;
      for (let b = 0; b < blades; b += 1) {
        const f = blades > 1 ? b / (blades - 1) - 0.5 : 0;
        const ht = (kind === 0 ? 5 + rnd() * 3 : kind === 1 ? 12 + rnd() * 9 : kind === 2 ? 8 + rnd() * 4 : 6 + rnd() * 4) * k;
        const spread = kind === 2 ? 1.6 : kind === 0 ? 0.9 : 0.5;
        const tipX = x + (f * spread + lean) * ht + (rnd() - 0.5) * 2 * k;
        const tipY = y - ht * (kind === 3 ? 0.55 : 1) * (1 - Math.abs(f) * 0.3);
        const bx = x + f * 3 * k;
        path.moveTo(bx - 0.7 * k, y);
        if (kind === 3) {
          // dead stems, bent over at a kink
          const kx = bx + lean * ht * 0.3;
          const ky = y - ht * 0.7;
          path.lineTo(kx, ky);
          path.lineTo(tipX + ht * 0.3 * Math.sign(lean || 1), tipY + ht * 0.1);
          path.lineTo(kx + 0.6 * k, ky + 0.4 * k);
        } else {
          path.quadraticCurveTo(bx + (tipX - bx) * 0.2, y - ht * 0.55, tipX, tipY);
        }
        path.quadraticCurveTo(bx + (tipX - bx) * 0.25 + 0.6 * k, y - ht * 0.5, bx + 0.7 * k, y);
        path.closePath();
      }
    }
  }
  ctx.fillStyle = warm ? mix(K.grassWarm, K.dirtWarm, 0.35) : mix(K.grass, K.ground, 0.25);
  ctx.fill(grass);
  ctx.fillStyle = warm ? mix(K.grassWarm, BLACK, 0.55) : mix(K.grass, BLACK, 0.5);
  ctx.fill(grassNear);
  // pebbles, a scatter of sizes
  for (let i = 0; i < clusters * 2; i += 1) {
    const y = top + rnd() ** 1.2 * (h - top);
    const x = rnd() * w;
    const depth = clamp((y - horizon) / (fy - horizon), 0.15, 1.8);
    if (Math.hypot((x - fx) / s, ((y - fy) / s) * 2.6) < 60) continue;
    const r = (0.6 + rnd() ** 2 * 2.6) * s * depth;
    ctx.fillStyle = warm ? K.woodWarmDark : K.stone;
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.4, r * 0.8, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = warm ? rgba(K.stoneWarmLit, 0.3) : rgba(K.stoneMoon, last ? 0.4 : 0.18);
    ctx.beginPath();
    ctx.ellipse(x + (warm ? (x < fx ? r * 0.4 : -r * 0.4) : r * 0.3), y - r * 0.35, r * 0.8, r * 0.35, 0, 0, TAU);
    ctx.fill();
  }
  // rocks and roots near the ring, lit on the side that faces the fire
  const rr = mulberry32(3301);
  for (let i = 0; i < 7; i += 1) {
    const a = (i / 7) * TAU + rr() * 0.6;
    const dist = (66 + rr() * 60) * s;
    const x = fx + Math.cos(a) * dist * 1.25;
    const y = fy + 6 * s + Math.sin(a) * dist * 0.3;
    if (Math.abs(Math.abs(x - fx) - 98 * s) < 30 * s && y < fy + 22 * s) continue; // the seats
    const r = (3 + rr() * 4) * s;
    const p = new Path2D();
    p.moveTo(x - r * 1.3, y);
    p.bezierCurveTo(x - r * 1.2, y - r * 0.9, x + r * 0.2, y - r * 1.1, x + r * 1.3, y - r * 0.2);
    p.quadraticCurveTo(x + r * 0.6, y + r * 0.4, x - r * 1.3, y);
    if (warm) {
      castShadow(ctx, L, x, y, r * 4, r * 2, 0.5);
      litShape(ctx, p, L.lx, L.ly + 30 * s, x, y - r * 0.4, { dark: K.stoneWarm, rimCol: K.stoneWarmLit, rimW: r * 0.4, rimA: 0.75, bounce: C.ember400, bounceA: 0.3, span: r * 1.5 });
    } else {
      ctx.fillStyle = K.stone;
      ctx.fill(p);
      moonRim(ctx, p, x - r, y - r, x + r, y, 0.8, last ? 0.6 : 0.35);
    }
  }
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i += 1) {
    const side = i % 2 ? 1 : -1;
    const x0 = fx + side * (120 + rr() * 50) * s;
    const y0 = fy + (16 + rr() * 14) * s;
    ctx.strokeStyle = warm ? K.woodWarmDark : K.wood;
    ctx.lineWidth = (1.6 + rr()) * s;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.bezierCurveTo(x0 + side * 14 * s, y0 - 4 * s, x0 + side * 22 * s, y0 + 5 * s, x0 + side * 40 * s, y0 + 2 * s);
    ctx.stroke();
    if (warm) {
      ctx.strokeStyle = rgba(C.ember300, 0.35);
      ctx.lineWidth = 0.7 * s;
      ctx.stroke();
    }
  }
}

// ---- props ------------------------------------------------------------------------------------
// Every prop paints in a local frame: origin on the ground, +x toward the fire (mirrored with
// `dir`), units scaled by `u`. `ctx` light coordinates are mapped into that frame.
function localFrame(ctx, L, x, y, u, dir = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir * u, u);
  return { lx: (L.lx - x) / (dir * u), ly: (L.ly - y) / u };
}

function tent(ctx, L, x, y, sc, dir, warm, opts = {}) {
  const u = L.s * sc;
  if (warm) castShadow(ctx, L, x + dir * 6 * u, y, 70 * u, 70 * u, 0.55);
  contactShadow(ctx, x - dir * 18 * u, y - 4 * u, 70 * u, 14 * u, warm ? 0.5 : 0.65);
  const { lx, ly } = localFrame(ctx, L, x, y, u, dir);
  const W = 36;
  const H = 52;
  const D = [-62, -15];
  const A = [0, -H];
  const G1 = [-W, 0];
  const G2 = [W, 0];
  const add = (p, q) => [p[0] + q[0], p[1] + q[1]];
  const poly = (...pts) => {
    const p = new Path2D();
    p.moveTo(...pts[0]);
    for (const q of pts.slice(1)) p.lineTo(...q);
    p.closePath();
    return p;
  };
  // the far roof slope peeks over the ridge line
  const back = poly(A, add(A, D), add(G2, D), G2);
  // the near slope: a soft sag between the poles
  const slope = new Path2D();
  slope.moveTo(...A);
  slope.quadraticCurveTo(A[0] + D[0] * 0.5, A[1] + D[1] * 0.5 + 3, A[0] + D[0], A[1] + D[1]);
  slope.lineTo(G1[0] + D[0], G1[1] + D[1]);
  slope.quadraticCurveTo(G1[0] + D[0] * 0.5, G1[1] + D[1] * 0.5 - 2, G1[0], G1[1]);
  slope.closePath();
  const gable = new Path2D();
  gable.moveTo(...G1);
  gable.quadraticCurveTo(-W * 0.45, -H * 0.52, A[0], A[1]);
  gable.quadraticCurveTo(W * 0.45, -H * 0.52, G2[0], G2[1]);
  gable.closePath();

  ctx.fillStyle = warm ? K.canvasWarmDark : K.canvasShade;
  ctx.fill(back);
  if (warm) {
    warmFill(ctx, slope, lx, ly, -30, -22, 40, mix(K.canvasWarmDark, BLACK, 0.3), K.canvasWarmDark, 0.9);
    warmFill(ctx, gable, lx, ly, 0, -22, 70, K.canvasWarmDark, K.canvasWarm, 1);
  } else {
    const sg = ctx.createLinearGradient(0, -H, -20, 0);
    sg.addColorStop(0, mix(K.canvasShade, K.canvasLit, 0.35));
    sg.addColorStop(1, mix(K.canvasShade, BLACK, 0.25));
    ctx.fillStyle = sg;
    ctx.fill(slope);
    const gg = ctx.createLinearGradient(W, -H, -W, 0);
    gg.addColorStop(0, K.canvasLit);
    gg.addColorStop(1, mix(K.canvasLit, K.canvasShade, 0.7));
    ctx.fillStyle = gg;
    ctx.fill(gable);
  }
  // seams and the sag of the cloth
  ctx.lineWidth = 0.7;
  ctx.strokeStyle = rgba(BLACK, warm ? 0.28 : 0.35);
  ctx.beginPath();
  for (let i = 1; i < 5; i += 1) {
    const t = i / 5;
    ctx.moveTo(A[0] + D[0] * t, A[1] + D[1] * t);
    ctx.lineTo(G1[0] + D[0] * t, G1[1] + D[1] * t + 1);
  }
  for (const t of [-0.55, 0.55]) {
    ctx.moveTo(0, -H + 4);
    ctx.lineTo(W * t, 0);
  }
  ctx.stroke();
  // the doorway: a dark slit, flaps tied back, a lantern glow inside if lit
  const door = new Path2D();
  door.moveTo(0, -H * 0.66);
  door.quadraticCurveTo(-7, -H * 0.3, -12, 0);
  door.lineTo(12, 0);
  door.quadraticCurveTo(7, -H * 0.3, 0, -H * 0.66);
  door.closePath();
  if (opts.lantern) {
    const lg = ctx.createRadialGradient(-2, -9, 0, -2, -9, 22);
    lg.addColorStop(0, C.lattice300);
    lg.addColorStop(0.35, C.gold400);
    lg.addColorStop(1, C.ember600);
    ctx.fillStyle = lg;
  } else {
    ctx.fillStyle = mix(BLACK, C.ink, 0.4);
  }
  ctx.fill(door);
  const flapL = new Path2D();
  flapL.moveTo(0, -H * 0.66);
  flapL.quadraticCurveTo(-14, -H * 0.36, -17, -H * 0.12);
  flapL.quadraticCurveTo(-13, -H * 0.06, -12, 0);
  flapL.quadraticCurveTo(-7, -H * 0.3, 0, -H * 0.66);
  const flapR = new Path2D();
  flapR.moveTo(0, -H * 0.66);
  flapR.quadraticCurveTo(14, -H * 0.36, 17, -H * 0.12);
  flapR.quadraticCurveTo(13, -H * 0.06, 12, 0);
  flapR.quadraticCurveTo(7, -H * 0.3, 0, -H * 0.66);
  ctx.fillStyle = warm ? mix(K.canvasWarm, C.ink, 0.15) : mix(K.canvasLit, C.frost300, 0.15);
  ctx.globalAlpha = warm ? 0.85 : 0.7;
  ctx.fill(flapL);
  ctx.fill(flapR);
  ctx.globalAlpha = 1;
  if (opts.lantern) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    softDot(ctx, 0, -8, 40, C.ember400, 0.3);
    ctx.restore();
  }
  // edges: the ridge pole catching light, rim along the gable
  if (warm) rim(ctx, gable, lx, ly, 0, -24, 60, C.ember200, 1.4, 0.8);
  else moonRim(ctx, gable, -W, -H, W, 0, 1.2, 0.45);
  ctx.strokeStyle = warm ? K.woodWarm : K.woodLit;
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -H - 7);
  ctx.lineTo(0, -H + 1);
  ctx.moveTo(D[0], -H + D[1] - 6);
  ctx.lineTo(D[0], -H + D[1] + 1);
  ctx.stroke();
  // a small pennant on the ridge
  ctx.fillStyle = opts.pennant || C.navy600;
  ctx.beginPath();
  ctx.moveTo(0, -H - 7);
  ctx.lineTo(10, -H - 4.5);
  ctx.lineTo(0, -H - 2);
  ctx.fill();
  // guy ropes and stakes
  ctx.strokeStyle = warm ? rgba(C.parch400, 0.55) : rgba(C.stone400, 0.4);
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(0, -H - 4);
  ctx.lineTo(34, 7);
  ctx.moveTo(D[0], -H + D[1] - 4);
  ctx.lineTo(D[0] - 26, D[1] + 6);
  ctx.moveTo(-W * 0.55, -H * 0.4);
  ctx.lineTo(-W - 14, 6);
  ctx.stroke();
  ctx.fillStyle = warm ? K.woodWarm : K.wood;
  for (const [sx, sy] of [
    [34, 7],
    [D[0] - 26, D[1] + 6],
    [-W - 14, 6],
  ]) ctx.fillRect(sx - 0.8, sy - 3.5, 1.6, 4);
  ctx.restore();
}

function cart(ctx, L, x, y, sc, warm) {
  const u = L.s * sc;
  if (warm) castShadow(ctx, L, x, y, 60 * u, 60 * u, 0.5);
  contactShadow(ctx, x, y - 2 * u, 60 * u, 10 * u, 0.6);
  const { lx, ly } = localFrame(ctx, L, x, y, u, 1);
  const dark = warm ? K.woodWarmDark : K.wood;
  const lit = warm ? K.woodWarm : K.woodLit;
  // shafts resting on the ground
  ctx.strokeStyle = dark;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(30, -22);
  ctx.lineTo(70, 2);
  ctx.moveTo(24, -20);
  ctx.lineTo(58, 4);
  ctx.stroke();
  // cargo: sacks and a crate under a tied tarp
  const cargo = new Path2D();
  cargo.moveTo(-40, -30);
  cargo.bezierCurveTo(-38, -52, -18, -58, -6, -50);
  cargo.bezierCurveTo(4, -62, 26, -56, 30, -40);
  cargo.lineTo(34, -30);
  cargo.closePath();
  if (warm) warmFill(ctx, cargo, lx, ly, 0, -44, 40, K.canvasWarmDark, K.canvasWarm, 0.9);
  else {
    const cg = ctx.createLinearGradient(30, -60, -30, -30);
    cg.addColorStop(0, K.canvasLit);
    cg.addColorStop(1, K.canvasShade);
    ctx.fillStyle = cg;
    ctx.fill(cargo);
  }
  ctx.strokeStyle = rgba(BLACK, 0.4);
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(-20, -55);
  ctx.quadraticCurveTo(-16, -40, -20, -30);
  ctx.moveTo(10, -58);
  ctx.quadraticCurveTo(14, -42, 10, -30);
  ctx.stroke();
  // the bed
  const bed = new Path2D();
  bed.rect(-44, -32, 80, 12);
  if (warm) warmFill(ctx, bed, lx, ly, 0, -26, 30, dark, lit, 1);
  else {
    ctx.fillStyle = dark;
    ctx.fill(bed);
  }
  ctx.strokeStyle = rgba(BLACK, 0.45);
  ctx.beginPath();
  ctx.moveTo(-44, -26);
  ctx.lineTo(36, -26);
  ctx.stroke();
  // wheel with spokes and an iron tyre
  for (const [wx, r] of [
    [-22, 15],
    [-4, 15],
  ]) {
    ctx.save();
    ctx.translate(wx, -15);
    ctx.scale(wx < -10 ? 0.35 : 1, 1);
    ctx.strokeStyle = warm ? K.ironWarm : K.iron;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = lit;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * TAU + 0.2;
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.stroke();
    ctx.fillStyle = warm ? K.ironWarm : K.iron;
    ctx.beginPath();
    ctx.arc(0, 0, 2.6, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function weaponRack(ctx, L, x, y, sc, warm) {
  const u = L.s * sc;
  if (warm) castShadow(ctx, L, x, y, 50 * u, 40 * u, 0.5);
  contactShadow(ctx, x, y, 30 * u, 6 * u, 0.6);
  const { lx, ly } = localFrame(ctx, L, x, y, u, 1);
  const wood = warm ? K.woodWarm : K.woodLit;
  ctx.lineCap = 'round';
  // spears leaning on the bar
  ctx.strokeStyle = warm ? K.woodWarmDark : K.wood;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (const [bx, tx] of [
    [-16, -8],
    [-6, 2],
    [6, 13],
    [14, 22],
  ]) {
    ctx.moveTo(bx, 0);
    ctx.lineTo(tx, -66);
  }
  ctx.stroke();
  ctx.fillStyle = warm ? K.ironWarm : mix(K.iron, C.frost300, 0.3);
  for (const tx of [-8, 2, 13, 22]) {
    ctx.beginPath();
    ctx.moveTo(tx - 1.8, -66);
    ctx.lineTo(tx + 0.4, -76);
    ctx.lineTo(tx + 2.2, -66);
    ctx.fill();
  }
  // trestle
  ctx.strokeStyle = wood;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(-22, 0);
  ctx.lineTo(-14, -40);
  ctx.lineTo(-6, 0);
  ctx.moveTo(14, 0);
  ctx.lineTo(22, -40);
  ctx.lineTo(30, 0);
  ctx.moveTo(-18, -38);
  ctx.lineTo(26, -38);
  ctx.stroke();
  // a round shield leaning at the foot, brass boss
  const sh = new Path2D();
  sh.ellipse(-4, -12, 11, 13, -0.15, 0, TAU);
  if (warm) warmFill(ctx, sh, lx, ly, -4, -12, 20, mix(C.navy800, C.ember600, 0.4), mix(C.navy600, C.ember300, 0.5), 0.9);
  else {
    ctx.fillStyle = C.navy700;
    ctx.fill(sh);
  }
  ctx.strokeStyle = warm ? C.brass300 : C.brass700;
  ctx.lineWidth = 1.3;
  ctx.stroke(sh);
  ctx.fillStyle = warm ? C.gold400 : C.brass500;
  ctx.beginPath();
  ctx.arc(-4, -12, 2.6, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function woodpile(ctx, L, x, y, sc, warm) {
  const u = L.s * sc;
  if (warm) castShadow(ctx, L, x, y, 40 * u, 40 * u, 0.5);
  contactShadow(ctx, x, y, 30 * u, 6 * u, 0.6);
  const { lx, ly } = localFrame(ctx, L, x, y, u, 1);
  const rows = [
    [-14, -4, 4],
    [-9, -12, 3],
    [-4, -20, 2],
  ];
  for (const [x0, yy, n] of rows) {
    for (let i = 0; i < n; i += 1) {
      const cx = x0 + i * 9;
      const end = new Path2D();
      end.ellipse(cx, yy, 4.6, 4.2, 0, 0, TAU);
      if (warm) warmFill(ctx, end, lx, ly, cx, yy, 8, K.woodWarmDark, mix(C.ember500, C.parch400, 0.3), 0.9);
      else {
        ctx.fillStyle = mix(K.woodLit, K.wood, 0.4);
        ctx.fill(end);
      }
      ctx.strokeStyle = rgba(BLACK, 0.45);
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.arc(cx, yy, 2.2, 0, TAU);
      ctx.stroke();
    }
  }
  ctx.restore();
}


// ---- the seated figures -------------------------------------------------------------------------
// Drawn in a local frame: origin on the ground under the seat, +x toward the fire, ~64 units tall.
// 3/4 seated silhouettes leaning in to the warmth: elbows on knees, hands loose toward the fire
// (Mara's on the grip of her planted sword), a cloak draped over the log behind, a bowed head with
// a readable brow, nose and jaw. Bodies stay near-black; only the fire-facing side takes a graded
// rim (hottest at face, hands and knees) and a soft bounce, with a faint moon rim on the far side.

function poly(pts) {
  const p = new Path2D();
  p.moveTo(...pts[0]);
  for (const q of pts.slice(1)) p.lineTo(...q);
  p.closePath();
  return p;
}

function headPath() {
  const p = new Path2D();
  p.moveTo(-3, 4.6);
  p.bezierCurveTo(-6, 2, -6.2, -3.6, -2.2, -5.6);
  p.bezierCurveTo(1, -6.8, 4.4, -5.2, 5, -2.6);
  p.lineTo(5.4, -1.1); // brow
  p.lineTo(5.1, -0.3);
  p.lineTo(7.0, 1.9); // nose
  p.lineTo(5.5, 2.5);
  p.lineTo(5.8, 3.1); // lips
  p.lineTo(5.3, 3.6);
  p.lineTo(5.6, 4.2);
  p.bezierCurveTo(5.7, 5.3, 5.0, 6.0, 3.8, 6.1); // chin
  p.bezierCurveTo(2.0, 6.1, 0.6, 5.0, 0.0, 3.4); // jaw
  p.lineTo(-0.8, 5.6);
  p.closePath();
  return p;
}

function hairPath(sov) {
  const p = new Path2D();
  p.moveTo(-2.4, -5.9);
  p.bezierCurveTo(1.5, -7.4, 4.8, -5.6, 5.3, -2.9);
  p.lineTo(3.4, -3.3);
  p.bezierCurveTo(1.2, -3.6, 0, -1.6, -0.9, 0.8);
  if (sov) {
    // long hair to the shoulders
    p.bezierCurveTo(-1.6, 3.6, -2.8, 7, -4.4, 9.4);
    p.bezierCurveTo(-7.4, 7.8, -7, 0.6, -6.1, -2.8);
  } else {
    // cropped and tied back in a short tail
    p.bezierCurveTo(-1.6, 2.4, -2.8, 3.2, -4.2, 3.4);
    p.bezierCurveTo(-6.4, 3.8, -8.4, 5.2, -9.4, 6.8);
    p.bezierCurveTo(-9.8, 4.6, -8, 3, -6.6, 2.2);
    p.bezierCurveTo(-6.6, 0.4, -6.4, -1.6, -6.1, -2.8);
  }
  p.closePath();
  return p;
}

function crownPath() {
  // a circlet just above the brow with three small points
  const p = new Path2D();
  p.moveTo(-5.7, -2.2);
  p.lineTo(-2.6, -3.0);
  p.lineTo(-2.0, -5.6);
  p.lineTo(-1.1, -3.2);
  p.lineTo(0.6, -3.5);
  p.lineTo(1.2, -6.3);
  p.lineTo(2.0, -3.7);
  p.lineTo(3.4, -4.0);
  p.lineTo(4.1, -6.2);
  p.lineTo(4.6, -4.1);
  p.lineTo(5.1, -4.2);
  p.lineTo(5.2, -3.0);
  p.lineTo(-5.4, -1.0);
  p.closePath();
  return p;
}

const HEAD_AT = [15.6, -56];
const HEAD_ROT = 0.2;
const HEAD_K = 0.92;

function figureParts(kind) {
  const sov = kind === 'sovereign';
  const head = (p) => placed(p, HEAD_AT[0], HEAD_AT[1], HEAD_ROT, HEAD_K);
  const P = {};
  P.cloak = sov
    ? (() => {
        const p = new Path2D();
        p.moveTo(6, -50);
        p.bezierCurveTo(-2, -53.5, -9, -50.5, -12, -44);
        p.bezierCurveTo(-16, -34, -20, -20, -26, -6);
        p.bezierCurveTo(-28, -2, -31, 0, -35, 0.4);
        p.lineTo(-6, 0.4);
        p.bezierCurveTo(-6, -4, -5, -9, -3, -12);
        p.bezierCurveTo(-1, -22, 1, -36, 6, -50);
        p.closePath();
        return p;
      })()
    : (() => {
        const p = new Path2D();
        p.moveTo(6, -50);
        p.bezierCurveTo(-2, -53, -8, -50.5, -11, -44);
        p.bezierCurveTo(-14, -35, -17, -23, -21, -11);
        p.bezierCurveTo(-22, -8, -23.5, -5.5, -25, -4.5);
        p.lineTo(-6, -6);
        p.bezierCurveTo(-4, -14, 0, -34, 6, -50);
        p.closePath();
        return p;
      })();
  P.farLeg = tube(
    [
      [-2, -13],
      [24, -21.5],
      [28, -3.2],
    ],
    [6, 4.2, 3.2],
  );
  P.farBoot = poly([
    [23.5, -5],
    [29.5, -5.6],
    [35, -2],
    [35.4, 0],
    [23, 0],
  ]);
  P.farArm = tube(
    [
      [11, -44],
      [24, -25],
      [31.5, sov ? -30.5 : -33],
    ],
    [3.6, 3.0, 2.3],
  );
  P.torso = tube(
    [
      [-3, -13],
      [1, -29],
      [7.5, -44],
    ],
    [8.4, 8.6, 7.2],
  );
  P.neck = tube(
    [
      [9, -46],
      [13.4, -51.5],
    ],
    [2.8, 2.5],
  );
  P.head = head(headPath());
  P.hair = head(hairPath(sov));
  P.nearLeg = tube(
    [
      [-1, -12],
      [22, -20],
      [25.5, -2.6],
    ],
    [6.6, 4.5, 3.4],
  );
  P.nearBoot = poly([
    [20.6, -4.6],
    [26.8, -5.6],
    [33, -1.9],
    [33.4, 0.2],
    [20, 0.2],
  ]);
  if (sov) {
    P.nearArm = tube(
      [
        [5, -45],
        [19, -24],
        [29.5, -28.5],
      ],
      [4, 3.2, 2.5],
    );
    P.hands = new Path2D();
    P.hands.ellipse(31.4, -29.4, 3.8, 3, -0.35, 0, TAU);
    P.hands.ellipse(33.4, -31.2, 1.6, 1.1, -0.9, 0, TAU);
    // a fur mantle across the shoulders
    const m = new Path2D();
    m.moveTo(-9, -44);
    for (let i = 0; i <= 12; i += 1) {
      const a = Math.PI * (1.08 + i * 0.07);
      m.lineTo(3 + Math.cos(a) * 12.5 + (i % 2 ? 0.8 : -0.4), -46.5 + Math.sin(a) * 6.2 + (i % 2 ? -1.1 : 0.6));
    }
    m.bezierCurveTo(15, -44, 12, -41.5, 9, -41);
    m.bezierCurveTo(3, -40, -4, -40.5, -9, -44);
    m.closePath();
    P.mantle = m;
    P.crown = head(crownPath());
  } else {
    P.nearArm = tube(
      [
        [5, -45],
        [18, -25],
        [31, -32.5],
      ],
      [4, 3.2, 2.5],
    );
    P.hands = new Path2D();
    P.hands.ellipse(33.4, -32.6, 3, 2.7, -0.2, 0, TAU);
    // the sword, planted point-down before her: blade, guard, grip and pommel
    P.blade = poly([
      [34.3, -28],
      [35.9, -28],
      [36.1, -2.5],
      [35.3, 0.6],
      [34.6, -2.5],
    ]);
    P.guard = poly([
      [31, -29.6],
      [39.2, -28.8],
      [39.1, -27.6],
      [31, -28.2],
    ]);
    P.grip = tube(
      [
        [35, -29],
        [34.4, -36],
      ],
      [0.8, 0.8],
    );
    // a pauldron on the near shoulder, and the lame beneath it
    const pd = new Path2D();
    pd.moveTo(-0.5, -46.4);
    pd.bezierCurveTo(0.5, -52.8, 9.8, -54, 13, -47.6);
    pd.bezierCurveTo(9.4, -45.2, 3.6, -44.6, -0.5, -46.4);
    pd.closePath();
    pd.moveTo(1.2, -44.2);
    pd.bezierCurveTo(4, -45.8, 9.2, -45.8, 12.4, -44.6);
    pd.lineTo(11.8, -42.2);
    pd.bezierCurveTo(8.8, -43.3, 4.6, -43.3, 1.9, -42);
    pd.closePath();
    P.pauldron = pd;
  }
  return P;
}

let FIGS = null;
const figs = () => (FIGS ||= { sovereign: figureParts('sovereign'), mara: figureParts('mara') });

function seatLog(ctx, lx, ly, warm) {
  const log = new Path2D();
  log.moveTo(-30, -9);
  log.quadraticCurveTo(-4, -13.5, 18, -10.5);
  log.lineTo(20, -0.5);
  log.quadraticCurveTo(-4, 1.5, -30, 0);
  log.closePath();
  if (warm) warmFill(ctx, log, lx, ly, 0, -5, 30, K.woodWarmDark, K.woodWarm, 1);
  else {
    ctx.fillStyle = K.wood;
    ctx.fill(log);
  }
  const end = new Path2D();
  end.ellipse(19, -5.5, 3.4, 5.4, 0, 0, TAU);
  ctx.fillStyle = warm ? mix(C.ember500, C.parch400, 0.3) : K.woodLit;
  ctx.fill(end);
  ctx.strokeStyle = rgba(BLACK, 0.4);
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.ellipse(19, -5.5, 1.7, 2.8, 0, 0, TAU);
  ctx.moveTo(-24, -6.5);
  ctx.quadraticCurveTo(-4, -8.5, 14, -6.5);
  ctx.stroke();
}

function figure(ctx, L, x, y, sc, dir, kind, warm, opts = {}) {
  const u = L.s * sc;
  if (warm) castShadow(ctx, L, x - dir * 4 * u, y, 92 * u, 46 * u, 0.6);
  contactShadow(ctx, x - dir * 4 * u, y, 40 * u, 7 * u, 0.6);
  const { lx, ly } = localFrame(ctx, L, x, y, u, dir);
  seatLog(ctx, lx, ly, warm);
  if (opts.empty) {
    ctx.restore();
    return;
  }
  const P = figs()[kind];
  const sov = kind === 'sovereign';
  // moonlight from the upper right of the screen, mapped into this mirrored frame
  const mx = dir * 600;
  const my = -800;
  const dh = Math.hypot(lx - 31, ly + 30);
  const far = [dh, dh + 60];
  const cloakCol = sov ? mix(K.figureWarm, C.crimson600, 0.18) : mix(K.figureWarm, C.navy800, 0.3);
  const parts = [
    // [path, centre, light options]
    [P.cloak, -10, -26, { dark: cloakCol, rimA: 0.75, rimW: 1.4, bounceA: 0.12, span: 24 }, true],
    [P.farLeg, 18, -16, { dark: mix(K.figureWarm, BLACK, 0.35), rimA: 0.5, rimW: 1.2, bounceA: 0.15, span: 14 }],
    [P.farBoot, 29, -2.5, { dark: mix(K.figureWarm, BLACK, 0.35), rimA: 0.5, rimW: 1, bounceA: 0.2, span: 6 }],
    [P.farArm, 22, -32, { dark: mix(K.figureWarm, BLACK, 0.35), rimA: 0.6, rimW: 1.2, bounceA: 0.2, span: 10 }],
    [P.torso, 3, -29, { rimW: 1.6, bounceA: 0.14, span: 16 }, true],
    [P.neck, 11, -48.5, { rimW: 1.2, bounceA: 0.4, span: 4 }],
    [P.mantle, 3, -46, { dark: mix(K.figureWarm, C.parch400, 0.08), rimCol: C.ember200, rimW: 1.2, bounceA: 0.3, span: 10 }],
    [P.pauldron, 6, -47, { dark: mix(K.figureWarm, C.iron500, 0.25), rimCol: C.brass300, rimHot: C.lattice300, rimW: 1.1, bounceA: 0.35, span: 8 }],
    [P.head, HEAD_AT[0], HEAD_AT[1], { rimW: 1.5, rimHot: C.lattice300, bounce: C.ember400, bounceA: 0.62, span: 8 }, true],
    [P.hair, HEAD_AT[0] - 2, HEAD_AT[1] - 2, { dark: mix(K.figureWarm, BLACK, 0.4), rimCol: C.ember400, rimW: 1, bounceA: 0.15, span: 6 }, true],
    [P.nearLeg, 14, -15, { rimW: 1.8, bounceA: 0.45, span: 14 }],
    [P.nearBoot, 27, -2.5, { rimW: 1.2, bounceA: 0.35, span: 6 }],
    [P.blade, 35.2, -14, { dark: mix(C.iron700, BLACK, 0.3), rimCol: C.iron200, rimHot: C.lattice200, rimW: 0.7, bounceA: 0.25, span: 4 }],
    [P.guard, 35, -28.6, { dark: C.brass700, rimCol: C.gold300, rimW: 0.7, bounceA: 0.3, span: 4 }],
    [P.nearArm, 18, -32, { rimW: 1.7, bounceA: 0.22, span: 12 }],
    [P.grip, 34.7, -32.5, { dark: mix(C.ink, BLACK, 0.3), rimCol: C.ember300, rimW: 0.6, bounceA: 0.2, span: 3 }],
    [P.hands, sov ? 31.6 : 33.4, sov ? -29.6 : -32.6, { rimW: 1.4, rimHot: C.lattice300, bounce: C.ember400, bounceA: 0.6, span: 5 }],
  ];
  for (const [path, cx, cy, o, moonSide] of parts) {
    if (!path) continue;
    if (warm) {
      litShape(ctx, path, lx, ly, cx, cy, {
        dark: K.figureWarm,
        rimCol: C.ember300,
        rimHot: C.gold300,
        bounce: C.ember500,
        fade: far,
        ...o,
      });
      if (moonSide) litShape(ctx, path, mx, my, cx, cy, { fill: false, rimCol: C.frost300, rimW: 0.9, rimA: 0.16 });
    } else {
      litShape(ctx, path, mx, my, cx, cy, { dark: o.dark && path !== P.head ? mix(o.dark, K.figure, 0.6) : K.figure, rimCol: K.figureMoon, rimW: 0.9, rimA: moonSide ? 0.5 : 0.25 });
    }
  }
  if (P.crown) {
    ctx.fillStyle = warm ? C.gold400 : C.gold700;
    ctx.fill(P.crown);
    if (warm) litShape(ctx, P.crown, lx, ly, HEAD_AT[0], HEAD_AT[1] - 4, { fill: false, rimCol: C.lattice200, rimW: 0.8, rimA: 1 });
  }
  if (!sov) {
    // the pommel catches the fire
    ctx.fillStyle = warm ? C.gold400 : C.gold700;
    ctx.beginPath();
    ctx.arc(34.3, -37.4, 1.7, 0, TAU);
    ctx.fill();
  }
  if (warm) {
    // glints: the crown's fire-side point, the pommel, the sword's edge
    ctx.fillStyle = rgba(C.lattice100, 0.95);
    ctx.beginPath();
    if (sov) {
      const c = Math.cos(HEAD_ROT) * HEAD_K;
      const sn = Math.sin(HEAD_ROT) * HEAD_K;
      const gx = 4.1;
      const gy = -5.8;
      ctx.arc(HEAD_AT[0] + gx * c - gy * sn, HEAD_AT[1] + gx * sn + gy * c, 0.75, 0, TAU);
    } else {
      ctx.arc(34.9, -37.9, 0.6, 0, TAU);
    }
    ctx.fill();
    if (!sov) {
      ctx.strokeStyle = rgba(C.lattice200, 0.55);
      ctx.lineWidth = 0.45;
      ctx.beginPath();
      ctx.moveTo(35.85, -27.4);
      ctx.lineTo(36, -3);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// ---- Sparky ---------------------------------------------------------------------------------------
// The young acid drake curled like a hound by the stones (local frame, +x toward the fire): a wedge
// head resting on crossed forepaws, two horns swept back like his portrait's, an ear-fin, a folded
// wing along his back with its wrist claw up, small spines down the neck, and the tail wrapped round
// the front of him to end by his snout. One sleepy acid-green eye is the only green in the scene.
let SPARKY = null;
function sparkyParts() {
  if (SPARKY) return SPARKY;
  // a round, curled mound with the haunch tucked under
  const body = new Path2D();
  body.moveTo(-20, 0);
  body.bezierCurveTo(-24.5, -10, -16, -20.5, -5, -20.5);
  body.bezierCurveTo(4, -20.5, 9, -15, 10, -9);
  body.bezierCurveTo(11, -5, 13, -2, 14.5, 0);
  body.closePath();
  body.ellipse(-13.5, -5.5, 8.4, 6, 0, 0, TAU);
  // a foreleg folded forward to the paws
  body.addPath(
    tube(
      [
        [5, -9],
        [10, -4],
        [15.5, -1.6],
      ],
      [3.6, 2.9, 2.4],
    ),
  );
  // the neck arching down to the head
  const neck = tube(
    [
      [5, -13],
      [10.5, -11],
      [14, -7],
    ],
    [5, 4.2, 3.8],
  );
  // a short, rounded wedge of a head resting on the paws
  const head = new Path2D();
  head.moveTo(12, -5);
  head.bezierCurveTo(12, -11, 18, -12.6, 21.5, -10.6);
  head.bezierCurveTo(24, -9.2, 26.6, -7.3, 27.9, -5.7);
  head.bezierCurveTo(28.9, -4.4, 28.3, -2.6, 26.6, -2.4);
  head.lineTo(15, -2.2);
  head.bezierCurveTo(12.8, -2.2, 12, -3.4, 12, -5);
  head.closePath();
  const horns = new Path2D();
  horns.moveTo(15.4, -10.2);
  horns.quadraticCurveTo(11, -12.2, 7.4, -17.6);
  horns.quadraticCurveTo(12.8, -14.4, 18.4, -11.2);
  horns.closePath();
  horns.moveTo(18.2, -11.2);
  horns.quadraticCurveTo(15, -14.6, 13.6, -20);
  horns.quadraticCurveTo(17.2, -15.4, 20.8, -10.8);
  horns.closePath();
  const fin = poly([
    [14.6, -6.6],
    [9.4, -9.4],
    [11.2, -6.6],
    [9.4, -5.2],
    [14, -4.8],
  ]);
  const wing = new Path2D();
  wing.moveTo(-15.5, -13.5);
  wing.bezierCurveTo(-11.5, -21, -2.4, -23.6, 3.6, -20.6);
  wing.lineTo(6.8, -23.8); // the wrist claw
  wing.lineTo(6, -19.2);
  wing.bezierCurveTo(3.6, -16.4, -0.2, -15.4, -2.8, -15.4);
  wing.lineTo(-5.2, -13.2);
  wing.lineTo(-7.6, -15);
  wing.lineTo(-10, -12.8);
  wing.lineTo(-12.4, -14.4);
  wing.closePath();
  const spines = new Path2D();
  for (const [x, y, a] of [
    [7.6, -14.4, -0.55],
    [10.8, -12.2, -0.9],
    [-19.2, -11, 0.75],
    [-21.6, -7.6, 1.15],
  ]) {
    spines.moveTo(x - Math.cos(a) * 1.5, y - Math.sin(a) * 1.5);
    spines.lineTo(x + Math.sin(a) * 3, y - Math.cos(a) * 3);
    spines.lineTo(x + Math.cos(a) * 1.5, y + Math.sin(a) * 1.5);
    spines.closePath();
  }
  // the tail: round the back of him and along the front, its spade tip under his chin
  const tail = tube(
    [
      [-19.5, -3],
      [-25.4, 0],
      [-22, 4],
      [-8, 5.3],
      [6, 5],
      [15, 3.8],
    ],
    [3.4, 3.1, 2.7, 2.2, 1.7, 1],
  );
  tail.moveTo(14.4, 3.8);
  tail.lineTo(18.4, 1.9);
  tail.lineTo(21, 3.8);
  tail.lineTo(18, 5.6);
  tail.closePath();
  // crossed forepaws under the chin
  const paws = new Path2D();
  paws.ellipse(19.5, -1.1, 5.4, 2.1, 0, 0, TAU);
  paws.ellipse(23.4, 0.2, 5, 1.9, 0.04, 0, TAU);
  SPARKY = { body, neck, head, horns, fin, wing, spines, tail, paws };
  return SPARKY;
}

/** A scratch canvas the size of `ctx`'s, drawing in the same transform. */
function scratch(ctx) {
  const cv = document.createElement('canvas');
  cv.width = ctx.canvas.width;
  cv.height = ctx.canvas.height;
  const c = cv.getContext('2d');
  c.setTransform(ctx.getTransform());
  return c;
}

/** Lay scratch canvas `c` over `ctx` pixel for pixel. */
function blit(ctx, c) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(c.canvas, 0, 0);
  ctx.restore();
}

function fillParts(c, parts, style, dx = 0, dy = 0) {
  c.save();
  c.translate(dx, dy);
  c.fillStyle = style;
  for (const p of parts) c.fill(p);
  c.restore();
}

/**
 * A crisp rim of light on the side of a silhouette (the union of `parts`) that faces (lx, ly): the
 * silhouette minus itself nudged away from the light, so the inner edges where parts overlap get
 * none. `style` is a colour or gradient.
 */
function silhouetteRim(ctx, parts, lx, ly, cx, cy, w, style) {
  const d = Math.hypot(lx - cx, ly - cy) || 1;
  const c = scratch(ctx);
  fillParts(c, parts, style);
  c.globalCompositeOperation = 'destination-out';
  fillParts(c, parts, '#000', (-(lx - cx) / d) * w, (-(ly - cy) / d) * w);
  blit(ctx, c);
}

/** Sparky into `ctx` at (x, y) on the ground, facing `dir` (−1: the fire is to his left). */
function sparky(ctx, L, x, y, sc, dir, warm) {
  const u = L.s * sc;
  const { lx, ly } = localFrame(ctx, L, x, y, u, dir);
  const S = sparkyParts();
  const parts = [S.body, S.neck, S.head, S.fin, S.wing, S.spines, S.tail, S.paws];
  // dark olive scales falling to navy at the belly, painted as one silhouette on a scratch canvas
  const fill = ctx.createLinearGradient(0, -24, 0, 6);
  fill.addColorStop(0, mix(mix(C.acid600, C.navy950, 0.7), BLACK, 0.15));
  fill.addColorStop(0.5, mix(C.acid600, C.navy950, 0.84));
  fill.addColorStop(1, mix(C.navy950, BLACK, 0.5));
  const c = scratch(ctx);
  fillParts(c, parts, fill);
  c.globalCompositeOperation = 'source-atop';
  const dh = Math.hypot(lx - 22, ly + 5);
  if (warm) {
    // the fire's warmth across his near flank and face
    const bg = c.createRadialGradient(lx, ly, Math.max(0, dh - 10), lx, ly, dh + 44);
    bg.addColorStop(0, rgba(C.ember500, 0.5));
    bg.addColorStop(1, rgba(C.ember500, 0));
    c.fillStyle = bg;
    c.fillRect(-32, -28, 68, 38);
  }
  // the folded wing: a shade lighter, its leading bone and fold lines
  const wg = c.createLinearGradient(-14, -24, 2, -14);
  wg.addColorStop(0, rgba(mix(C.acid600, C.navy800, 0.6), 0.5));
  wg.addColorStop(1, rgba(C.navy950, 0));
  c.fillStyle = wg;
  c.fill(S.wing);
  c.strokeStyle = rgba(BLACK, 0.6);
  c.lineWidth = 0.7;
  c.stroke(S.wing);
  c.beginPath();
  c.moveTo(3.4, -21.4);
  c.quadraticCurveTo(-3, -18, -8.4, -15.4);
  c.moveTo(3.4, -21.4);
  c.quadraticCurveTo(-6, -19.5, -13.6, -14.8);
  c.stroke();
  // the tail lies in front of him and the head over his paws: dark seams where they overlap
  c.strokeStyle = rgba(BLACK, 0.7);
  c.lineWidth = 0.9;
  c.beginPath();
  c.moveTo(-24.6, 1.4);
  c.quadraticCurveTo(-18, 3, -8, 3.2);
  c.lineTo(6, 3);
  c.lineTo(14, 2.4);
  c.moveTo(12.6, -2.3);
  c.lineTo(27, -2.5);
  c.moveTo(17.6, 0.2);
  c.quadraticCurveTo(20, -0.3, 22, 0.2);
  c.stroke();
  c.beginPath();
  c.arc(-13.5, -5.5, 6.6, -2.7, -0.35);
  c.moveTo(4.2, -11.2);
  c.quadraticCurveTo(7.4, -6, 13, -3.2);
  c.strokeStyle = rgba(BLACK, 0.55);
  c.lineWidth = 0.7;
  c.stroke();
  // belly scales: a few soft bands
  c.strokeStyle = rgba(BLACK, 0.32);
  c.lineWidth = 0.5;
  c.beginPath();
  for (let i = 0; i < 3; i += 1) {
    const bx = -5 + i * 3.6;
    c.moveTo(bx, -1.5);
    c.quadraticCurveTo(bx + 1.6, -4.5, bx + 0.6, -7.5);
  }
  c.stroke();
  blit(ctx, c);
  // the horns are pale bone at the tips, like his portrait's
  ctx.fillStyle = mix(C.navy900, C.stone700, 0.4);
  ctx.fill(S.horns);
  ctx.save();
  ctx.clip(S.horns);
  const hg = ctx.createLinearGradient(17, -10, 9, -20);
  hg.addColorStop(0, rgba(C.parch400, 0));
  hg.addColorStop(1, rgba(warm ? C.parch200 : C.frost300, warm ? 0.85 : 0.4));
  ctx.fillStyle = hg;
  ctx.fillRect(6, -24, 18, 15);
  ctx.restore();
  // rim light: a warm crescent on the fire side (hot at the face and paws), a faint moon edge above
  if (warm) {
    const rg = ctx.createRadialGradient(lx, ly, Math.max(0, dh - 20), lx, ly, dh + 50);
    rg.addColorStop(0, rgba(C.lattice300, 1));
    rg.addColorStop(0.35, rgba(C.ember200, 0.95));
    rg.addColorStop(0.75, rgba(C.ember300, 0.55));
    rg.addColorStop(1, rgba(C.ember400, 0.1));
    silhouetteRim(ctx, parts, lx, ly, 2, -8, 1.3, rg);
    silhouetteRim(ctx, [S.horns], lx, ly, 13, -14, 0.8, rgba(C.lattice300, 0.9));
  }
  silhouetteRim(ctx, parts, dir * 600, -800, 0, -8, 0.7, rgba(C.frost300, 0.3));
  // a nostril, and one sleepy eye: a sliver of acid green with a soft glow
  ctx.fillStyle = rgba(BLACK, 0.8);
  ctx.beginPath();
  ctx.ellipse(26.6, -4.6, 0.6, 0.4, -0.3, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  softDot(ctx, 19.6, -7, 6, C.acid400, warm ? 0.42 : 0.26);
  ctx.restore();
  ctx.fillStyle = C.acid300;
  ctx.beginPath();
  ctx.moveTo(17.2, -7);
  ctx.quadraticCurveTo(19.6, -9.6, 22.2, -7.4);
  ctx.quadraticCurveTo(19.8, -5.6, 17.2, -7);
  ctx.fill();
  ctx.fillStyle = rgba(BLACK, 0.85);
  ctx.beginPath();
  ctx.ellipse(19.9, -7.3, 0.55, 1.15, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = rgba(C.lattice100, 0.95);
  ctx.beginPath();
  ctx.arc(20.5, -8, 0.42, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// ---- the Elvian banner (static: painted into both layers) ---------------------------------------
/** The banner on its pole, base at (x, y), scaled by k. `furled` wraps the cloth round the pole. */
function banner(ctx, L, x, y, k, warm, furled) {
  const s = L.s * k;
  const top = -230;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  if (warm) {
    ctx.restore();
    castShadow(ctx, L, x, y, 60 * L.s, 14 * L.s, 0.45);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
  }
  ctx.lineCap = 'round';
  ctx.strokeStyle = warm ? K.woodWarmDark : K.wood;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, top - 8);
  if (!furled) {
    ctx.moveTo(-2, top);
    ctx.lineTo(40, top);
  }
  ctx.stroke();
  // the fire-facing edge of the pole
  const side = L.fx < x ? -1 : 1;
  ctx.strokeStyle = warm ? rgba(C.ember300, 0.7) : rgba(C.frost300, 0.3);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(side * 1.2, 0);
  ctx.lineTo(side * 1.2, warm ? -120 : top);
  ctx.stroke();
  // finial: a small gilt four-point star
  const star = (cx, cy, r, w = 0.28) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r * w, cy - r * w);
    ctx.lineTo(cx + r * 0.8, cy);
    ctx.lineTo(cx + r * w, cy + r * w);
    ctx.lineTo(cx, cy + r);
    ctx.lineTo(cx - r * w, cy + r * w);
    ctx.lineTo(cx - r * 0.8, cy);
    ctx.lineTo(cx - r * w, cy - r * w);
    ctx.closePath();
    ctx.fill();
  };
  ctx.fillStyle = warm ? C.gold400 : C.gold600;
  star(0, top - 14, 6);
  if (furled) {
    // the reign's banner, furled and corded: the era is written
    const wrap = new Path2D();
    wrap.moveTo(-1.5, top + 4);
    wrap.bezierCurveTo(6, top + 8, 7, top + 40, 4, top + 92);
    wrap.bezierCurveTo(2, top + 100, -2, top + 100, -3.5, top + 92);
    wrap.bezierCurveTo(-5, top + 50, -5, top + 14, -1.5, top + 4);
    wrap.closePath();
    const g = ctx.createLinearGradient(-5, 0, 7, 0);
    g.addColorStop(0, C.navy800);
    g.addColorStop(1, warm ? mix(C.navy600, C.ember400, 0.35) : C.navy700);
    ctx.fillStyle = g;
    ctx.fill(wrap);
    ctx.strokeStyle = warm ? C.gold400 : C.gold700;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (const v of [22, 52, 80]) {
      ctx.moveTo(-4.5, top + v + 2);
      ctx.lineTo(6, top + v - 2);
    }
    ctx.stroke();
    ctx.restore();
    return;
  }
  // the cloth hangs in a still night: a gentle S of folds and a swallowtail
  const bw = 34;
  const bl = 92;
  const x0 = 3;
  const ripple = (v) => Math.sin(1.2 - v * 4.2) * 3.2 * v + Math.sin(0.8 - v * 7) * 1.2 * v;
  const left = [];
  const right = [];
  const n = 10;
  for (let i = 0; i <= n; i += 1) {
    const v = i / n;
    left.push([x0 + ripple(v), top + v * bl]);
    right.push([x0 + bw + ripple(v) * 1.15, top + v * bl + Math.sin(2.2 - v * 4.2) * 1.2]);
  }
  const cloth = new Path2D();
  cloth.moveTo(...left[0]);
  for (const p of left.slice(1)) cloth.lineTo(...p);
  const [lbx, lby] = left[n];
  const [rbx, rby] = right[n];
  cloth.lineTo((lbx + rbx) / 2, lby - 16);
  cloth.lineTo(rbx, rby + 6);
  for (const p of right.slice(0, n).reverse()) cloth.lineTo(...p);
  cloth.closePath();
  const g = ctx.createLinearGradient(x0, top, x0 + bw, top);
  g.addColorStop(0, C.navy800);
  g.addColorStop(0.6, C.navy700);
  g.addColorStop(1, mix(C.navy700, C.frost500, 0.18));
  ctx.fillStyle = g;
  ctx.fill(cloth);
  ctx.save();
  ctx.clip(cloth);
  for (let i = 0; i < n; i += 1) {
    const v = i / n;
    const d = Math.cos(1.2 - v * 4.2);
    ctx.fillStyle = d > 0 ? rgba(C.frost300, 0.06 * d) : rgba(BLACK, -0.25 * d);
    ctx.fillRect(x0 - 8, top + v * bl, bw + 20, bl / n + 1);
  }
  if (warm) {
    const wg = ctx.createLinearGradient(0, top + bl, 0, top);
    wg.addColorStop(0, rgba(C.ember400, 0.42));
    wg.addColorStop(1, rgba(C.ember400, 0));
    ctx.fillStyle = wg;
    ctx.fillRect(x0 - 8, top, bw + 20, bl + 10);
  }
  ctx.strokeStyle = rgba(warm ? C.gold400 : C.gold600, 0.85);
  ctx.lineWidth = 1.4;
  ctx.stroke(cloth);
  const mid = left[4];
  ctx.fillStyle = warm ? C.gold400 : C.gold600;
  star(mid[0] + bw * 0.5, mid[1] - 2, 10, 0.22);
  ctx.strokeStyle = rgba(warm ? C.gold400 : C.gold600, 0.7);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(mid[0] + bw * 0.5, mid[1] - 2, 12.5, -1.2, 4.4);
  ctx.stroke();
  ctx.restore();
  ctx.restore();
}

/** A struck tent: the canvas down in a heap, its pole laid across. */
function struckTent(ctx, L, x, y, sc, warm) {
  const u = L.s * sc;
  if (warm) castShadow(ctx, L, x, y, 50 * u, 50 * u, 0.5);
  contactShadow(ctx, x, y - 2 * u, 46 * u, 8 * u, 0.6);
  const { lx, ly } = localFrame(ctx, L, x, y, u, 1);
  const heap = new Path2D();
  heap.moveTo(-40, 0);
  heap.bezierCurveTo(-34, -14, -16, -20, -2, -16);
  heap.bezierCurveTo(10, -22, 30, -16, 38, 0);
  heap.closePath();
  if (warm) warmFill(ctx, heap, lx, ly, 0, -10, 40, K.canvasWarmDark, K.canvasWarm, 0.85);
  else {
    const g = ctx.createLinearGradient(20, -20, -20, 0);
    g.addColorStop(0, K.canvasLit);
    g.addColorStop(1, K.canvasShade);
    ctx.fillStyle = g;
    ctx.fill(heap);
    moonRim(ctx, heap, -40, -22, 38, 0, 1, L.last ? 0.6 : 0.35);
  }
  ctx.strokeStyle = rgba(BLACK, 0.35);
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(-20, -12);
  ctx.quadraticCurveTo(-10, -6, -14, 0);
  ctx.moveTo(12, -15);
  ctx.quadraticCurveTo(18, -8, 14, 0);
  ctx.stroke();
  ctx.strokeStyle = warm ? K.woodWarm : K.woodLit;
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-46, -3);
  ctx.lineTo(44, -12);
  ctx.stroke();
  ctx.restore();
}

// ---- the static layers ----------------------------------------------------------------------------
function paintCamp(ctx, L, warm) {
  const s = L.s;
  // On a tall phone screen the camp gathers in closer so the tents still frame the fire.
  const spread = L.wide ? 1 : 0.74;
  const F = (dx, dy) => [L.fx + (Math.abs(dx) > 130 ? dx * spread : dx) * s, L.fy + dy * s];
  frameTrees(ctx, L, warm);
  // the banner: beside the camp and clear of any text column
  let bx;
  let by;
  let bk = 1;
  if (L.last) {
    // furled and short, out past the Sovereign's shoulder, below the words on every layout
    bx = L.fx + 200 * s;
    by = L.fy - 40 * s;
    bk = 0.55;
  } else if (L.wide) {
    by = L.fy - 52 * s;
    const outside = L.fx + 380;
    bx = L.bandTop != null && outside < L.w - 50 * s ? outside : L.fx + 206 * s;
    if (L.bandTop != null && bx !== outside) bk = clamp((by - L.bandTop - 10) / (244 * s), 0.4, 1);
  } else {
    bx = L.fx + 158 * s;
    by = L.fy - 78 * s;
    if (L.bandTop != null) bk = clamp((by - L.bandTop - 10) / (244 * s), 0.4, 1);
  }
  bx = Math.min(bx, L.w - 46 * s * bk);
  const items = L.last
    ? [
        { y: -112, draw: () => tent(ctx, L, ...F(-520, -112), 0.62, 1, warm) },
        { y: -104, draw: () => tent(ctx, L, ...F(540, -104), 0.66, -1, warm, { pennant: C.crimson600 }) },
        { y: -78, draw: () => cart(ctx, L, ...F(-330, -78), 0.95, warm) },
        { y: -66, draw: () => struckTent(ctx, L, ...F(-235, -62), 1.05, warm) },
        { y: -56, draw: () => struckTent(ctx, L, ...F(280, -54), 0.95, warm) },
        // (on a wide screen the words sit right above it, so the furled banner stays in the phone strip)
        L.wide ? null : { y: -60, draw: () => banner(ctx, L, bx, by, bk, warm, true) },
        { y: 20, draw: () => woodpile(ctx, L, ...F(L.wide ? -170 : -150, L.wide ? 22 : 30), 0.8, warm) },
        { y: 12, draw: () => figure(ctx, L, ...F(-98, 12), 1.1, 1, 'mara', warm, { empty: true }) },
        { y: 14, draw: () => figure(ctx, L, ...F(100, 14), 1.14, -1, 'sovereign', warm) },
      ]
    : [
        { y: -112, draw: () => tent(ctx, L, ...F(-520, -112), 0.62, 1, warm) },
        { y: -104, draw: () => tent(ctx, L, ...F(540, -104), 0.66, -1, warm, { pennant: C.crimson600 }) },
        { y: -96, draw: () => tent(ctx, L, ...F(390, -96), 0.82, -1, warm) },
        { y: -78, draw: () => cart(ctx, L, ...F(-400, -78), 0.95, warm) },
        { y: -66, draw: () => tent(ctx, L, ...F(-262, -66), 1.12, 1, warm, { lantern: true }) },
        { y: -58, draw: () => tent(ctx, L, ...F(262, -60), 1.05, -1, warm, { pennant: C.ember600 }) },
        { y: by - L.fy > -60 * s ? -50 : -70, draw: () => banner(ctx, L, bx, by, bk, warm, false) },
        L.wide ? { y: -40, draw: () => weaponRack(ctx, L, ...F(158, -40), 0.92, warm) } : null,
        { y: 20, draw: () => woodpile(ctx, L, ...F(L.wide ? -170 : -150, L.wide ? 22 : 30), 1, warm) },
        { y: 12, draw: () => figure(ctx, L, ...F(-98, 12), 1.1, 1, 'mara', warm) },
        { y: 14, draw: () => figure(ctx, L, ...F(100, 14), 1.14, -1, 'sovereign', warm) },
      ];
  // back to front
  const list = items.filter(Boolean).sort((a, b) => a.y - b.y);
  for (const it of list) it.draw();
  // Sparky's shadow on the ground (he himself breathes in the live fire layer)
  const sp = sparkyAt(L);
  if (warm) castShadow(ctx, L, sp.x, sp.y, 70 * s, 34 * s, 0.6);
  contactShadow(ctx, sp.x, sp.y + 1 * s, 36 * s, 5 * s, 0.7);
  foreground(ctx, L, warm);
}

const sparkyAt = (L) => ({ x: L.fx + 66 * L.s, y: L.fy + 21 * L.s, sc: 1.08 });
/** Tall grass close to the lens along the bottom edge, thick at the corners, open in the middle. */
function foreground(ctx, L, warm) {
  const { w, h, s, fx } = L;
  const rnd = mulberry32(8821);
  const blades = new Path2D();
  const n = Math.round(clamp(w / (5 * s), 60, 320));
  for (let i = 0; i < n; i += 1) {
    const x = rnd() * w;
    const edge = Math.abs(x - fx) / (w * 0.5); // 0 centre … 1 corners
    if (rnd() > 0.2 + edge * edge * 0.95) continue;
    const ht = (14 + rnd() * 40) * s * (0.45 + edge * 0.9);
    const lean = (rnd() - 0.5) * ht * 0.6 + (x < fx ? -1 : 1) * ht * 0.12;
    const bw = (1.3 + rnd() * 1.6) * s;
    const by = h + 2;
    blades.moveTo(x - bw, by);
    blades.quadraticCurveTo(x + lean * 0.3, by - ht * 0.6, x + lean, by - ht);
    blades.quadraticCurveTo(x + lean * 0.3 + bw * 0.4, by - ht * 0.55, x + bw, by);
    blades.closePath();
  }
  if (warm) {
    litShape(ctx, blades, L.lx, L.ly, fx, h, { dark: mix(K.figureWarm, BLACK, 0.3), rimCol: C.ember400, rimW: 0.9, rimA: 0.7 });
  } else {
    litShape(ctx, blades, fx + 600, h - 900, fx, h, { dark: mix(K.groundDeep, BLACK, 0.4), rimCol: L.last ? C.frost300 : K.figureMoon, rimW: L.last ? 1.1 : 0.7, rimA: L.last ? 0.5 : 0.35 });
  }
}

// Stones of the fire ring: back half drawn behind the fire, front half in front of it.
function ringStones() {
  const rnd = mulberry32(77);
  const out = [];
  const n = 13;
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * TAU + 0.12;
    out.push({ a, x: Math.cos(a) * 42, y: Math.sin(a) * 12, r: 7 + rnd() * 3.5, k: 0.7 + rnd() * 0.3, rot: (rnd() - 0.5) * 0.6, seed: rnd() });
  }
  return out.map((st) => ({ ...st, front: Math.sin(st.a) > -0.05 }));
}

function stone(ctx, L, st, warm) {
  const u = L.s;
  const x = L.fx + st.x * u;
  const y = L.fy + st.y * u;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(st.rot * 0.3);
  const p = new Path2D();
  const r = st.r * u;
  p.moveTo(-r, 0);
  p.bezierCurveTo(-r, -r * 0.9 * st.k, -r * 0.2, -r * 1.05 * st.k, r * 0.25, -r * 0.95 * st.k);
  p.bezierCurveTo(r * 0.9, -r * 0.8 * st.k, r * 1.05, -r * 0.2, r, r * 0.15);
  p.bezierCurveTo(r * 0.7, r * 0.45, -r * 0.7, r * 0.45, -r, 0);
  p.closePath();
  if (warm) {
    // inner faces look at the fire: lit hard; outer faces fall away into shade
    const lx = L.lx - x;
    const ly = L.ly - y + 20 * u;
    ctx.fillStyle = K.stoneWarm;
    ctx.fill(p);
    ctx.fillStyle = fireGrad(ctx, lx, ly, 0, -r * 0.4, r * 1.2, K.stoneWarmLit, 1);
    ctx.fill(p);
    if (st.front) {
      // the front stones show their outer, unlit side to us
      const g = ctx.createLinearGradient(0, -r, 0, r * 0.45);
      g.addColorStop(0, rgba(K.stoneWarmLit, 0.5));
      g.addColorStop(0.35, rgba(K.stoneWarm, 0.0));
      g.addColorStop(1, rgba(mix(K.stoneWarm, BLACK, 0.7), 0.85));
      ctx.fillStyle = g;
      ctx.fill(p);
    }
  } else {
    ctx.fillStyle = K.stone;
    ctx.fill(p);
    moonRim(ctx, p, -r, -r, r, r * 0.4, 0.9, 0.35);
  }
  ctx.restore();
}

// ---- the fire pit sprite: charred logs in a crib, embers glowing in their cracks ------------
function buildPit(L, dpr) {
  const s = L.s;
  const W = 150 * s;
  const H = 90 * s;
  const { cv, ctx } = layer(W, H, dpr);
  const ox = W / 2;
  const oy = H * 0.72; // the fire's ground point inside the sprite
  ctx.translate(ox, oy);
  ctx.scale(s, s);
  // ash and the coal bed
  softDot(ctx, 0, 2, 40, mix(C.stone700, C.ember600, 0.3), 0.9);
  ctx.save();
  ctx.scale(1, 0.32);
  softDot(ctx, 0, 0, 36, C.ember500, 0.95);
  softDot(ctx, 0, 0, 22, C.ember300, 0.9);
  ctx.restore();
  const rnd = mulberry32(509);
  for (let i = 0; i < 70; i += 1) {
    const a = rnd() * TAU;
    const r = Math.sqrt(rnd()) * 30;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r * 0.3 + 1;
    ctx.fillStyle = rnd() < 0.5 ? rgba(C.lattice300, 0.7) : rgba(C.crimson600, 0.8);
    ctx.beginPath();
    ctx.ellipse(x, y, 1.2 + rnd() * 2, 0.8 + rnd(), 0, 0, TAU);
    ctx.fill();
  }
  // the logs: a teepee leaning in, and two laid across
  const logs = [
    [-32, 4, -4, -34, 6.5],
    [30, 5, 3, -36, 6.5],
    [-18, -6, 2, -40, 5.5],
    [20, -5, -2, -38, 5.5],
    [-40, 8, 36, -2, 7.5],
    [38, 9, -34, -1, 7],
  ];
  for (const [x0, y0, x1, y1, wd] of logs) {
    const across = Math.abs(y1 - y0) < 20;
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, mix(C.ink, C.ember600, 0.25));
    g.addColorStop(0.55, mix(C.ink, BLACK, 0.3));
    g.addColorStop(1, mix(C.ember500, C.ink, 0.2));
    ctx.strokeStyle = g;
    ctx.lineWidth = wd;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    // glowing cracks along the char
    // (only low on the leaning logs: higher up, inside the flame, they would read as a lattice)
    const n = across ? 4 : 2;
    ctx.strokeStyle = rgba(C.ember300, 0.85);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let i = 0; i < n; i += 1) {
      const t = across ? 0.35 + (i / n) * 0.6 : 0.12 + i * 0.14;
      const cx = x0 + (x1 - x0) * t;
      const cy = y0 + (y1 - y0) * t;
      const nx = -(y1 - y0);
      const ny = x1 - x0;
      const nl = Math.hypot(nx, ny) || 1;
      ctx.moveTo(cx - (nx / nl) * wd * 0.4, cy - (ny / nl) * wd * 0.4);
      ctx.lineTo(cx + (nx / nl) * wd * 0.3 + 1.5, cy + (ny / nl) * wd * 0.3);
    }
    ctx.stroke();
    // the top edge facing the flame catches light
    ctx.strokeStyle = rgba(C.ember300, 0.3);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(x0 + (x1 - x0) * 0.25, y0 + (y1 - y0) * 0.25 - wd * 0.4);
    ctx.lineTo(x1, y1 - wd * 0.4);
    ctx.stroke();
  }
  return { cv, ox, oy, W, H };
}

const TONGUES = [
  // layer 0: deep outer flame; 1: body; 2: hot core
  { l: 0, x: -14, w: 15, h: 74, r: 2.3, p: 0.0 },
  { l: 0, x: 12, w: 17, h: 74, r: 2.0, p: 2.1 },
  { l: 0, x: -2, w: 22, h: 90, r: 1.7, p: 4.0 },
  { l: 0, x: 24, w: 11, h: 52, r: 2.7, p: 1.2 },
  { l: 0, x: -26, w: 11, h: 50, r: 2.5, p: 3.3 },
  { l: 1, x: -8, w: 12, h: 76, r: 2.6, p: 0.7 },
  { l: 1, x: 9, w: 12, h: 70, r: 2.9, p: 2.9 },
  { l: 1, x: 0, w: 15, h: 88, r: 2.2, p: 5.1 },
  { l: 1, x: 18, w: 8, h: 44, r: 3.2, p: 4.4 },
  { l: 1, x: -18, w: 8, h: 42, r: 3.0, p: 1.9 },
  { l: 2, x: -3, w: 9, h: 48, r: 3.1, p: 0.3 },
  { l: 2, x: 6, w: 7, h: 40, r: 3.6, p: 2.4 },
  { l: 2, x: 0, w: 11, h: 30, r: 2.8, p: 4.6 },
];
const FLAME_COLS = [
  [
    [0, C.crimson500, 0.0],
    [0.08, C.ember500, 0.6],
    [0.45, C.crimson500, 0.32],
    [1, C.crimson600, 0],
  ],
  [
    [0, C.ember400, 0.0],
    [0.1, C.ember300, 0.85],
    [0.5, C.ember400, 0.6],
    [1, C.crimson500, 0],
  ],
  [
    [0, C.lattice100, 0.0],
    [0.1, C.lattice200, 0.95],
    [0.45, C.gold300, 0.75],
    [1, C.ember300, 0],
  ],
];

function tongue(ctx, bx, by, w, h, t, T, s) {
  const n = 9;
  const left = [];
  const right = [];
  for (let i = 0; i <= n; i += 1) {
    const v = i / n;
    const y = by - v * h;
    const turb = (Math.sin(t * T.r * 1.3 + T.p - v * 3.4) * 0.6 + Math.sin(t * T.r * 2.2 + T.p * 1.7 - v * 6.3) * 0.3) * w * 0.8 * v ** 1.2;
    const lean = Math.sin(t * 0.6 + T.p) * 4 * s * v * v;
    const bulge = v < 0.22 ? 0.72 + (v / 0.22) * 0.28 : 1;
    const hw = w * (1 - v) ** 0.9 * bulge;
    const cx = bx + turb + lean;
    left.push([cx - hw, y]);
    right.push([cx + hw, y]);
  }
  ctx.beginPath();
  ctx.moveTo(...left[0]);
  for (let i = 1; i < n; i += 1) {
    const [x0, y0] = left[i];
    const [x1, y1] = left[i + 1];
    ctx.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
  }
  ctx.lineTo(...left[n]);
  for (let i = n - 1; i > 0; i -= 1) {
    const [x0, y0] = right[i];
    const [x1, y1] = right[i - 1];
    ctx.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
  }
  ctx.lineTo(...right[0]);
  ctx.closePath();
  return left[n];
}


function sizeCanvas(cv, w, h, dpr) {
  cv.width = Math.max(1, Math.round(w * dpr));
  cv.height = Math.max(1, Math.round(h * dpr));
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

/** Darken toward the frame edges so the fire is the value peak of the picture. */
function edgeDark(ctx, L, a) {
  const { w, h, fx, fy, s } = L;
  const cy = fy - 50 * s;
  const R = Math.hypot(Math.max(fx, w - fx), Math.max(cy, h - cy));
  const g = ctx.createRadialGradient(fx, cy, Math.min(w, h) * 0.28, fx, cy, R);
  g.addColorStop(0, rgba(BLACK, 0));
  g.addColorStop(0.55, rgba(BLACK, a * 0.45));
  g.addColorStop(1, rgba(BLACK, a));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/** A small cached sprite painted in world coordinates offset to its own box. */
function sprite(L, x, y, w, h, dpr, draw) {
  const { cv, ctx } = layer(w, h, dpr);
  draw(ctx, { ...L, fx: L.fx - x, fy: L.fy - y, lx: L.lx - x, ly: L.ly - y });
  return { cv, x, y, w, h };
}

/** Paint the cold and warm static layers into their canvases; return the live layer's sprites. */
function paintStatic(coldCv, warmCv, L, dpr, intensity) {
  const { w, h, s } = L;
  const stones = ringStones();
  // cold: sky, terrain, camp in moonlight, dark at the edges
  const cc = sizeCanvas(coldCv, w, h, dpr);
  paintSky(cc, L);
  paintTerrain(cc, L);
  paintGround(cc, L, false);
  paintCamp(cc, L, false);
  for (const st of stones) if (!st.front) stone(cc, L, st, false);
  edgeDark(cc, L, 0.55);
  // warm: the same camp lit by the fire, masked by its falloff
  const wc = sizeCanvas(warmCv, w, h, dpr);
  wc.save();
  wc.clip(groundPath(L));
  paintGround(wc, L, true);
  wc.restore();
  // firelight bounced onto the ground and the low air behind the figures, and the heat glow over
  // the flames: low-frequency light that breathes with this layer's flicker. It sits behind the
  // camp, so the figures stay dark shapes against it, lit only on their fire-facing edges.
  wc.globalCompositeOperation = 'lighter';
  const hot = L.last ? mix(C.ember500, C.crimson500, 0.4) : C.ember500;
  flatDot(wc, L.fx, L.fy + 4 * s, 440 * s, 0.3, mix(hot, C.gold600, 0.25), L.last ? 0.24 : 0.32);
  flatDot(wc, L.fx, L.fy - 70 * s, 300 * s, 0.55, hot, L.last ? 0.1 : 0.14);
  flatDot(wc, L.fx, L.fy - 50 * s, 130 * s, 1.2, hot, 0.3);
  wc.globalCompositeOperation = 'source-over';
  paintCamp(wc, L, true);
  for (const st of stones) if (!st.front) stone(wc, L, st, true);
  const reach = (560 + 200 * intensity) * s * (L.last ? 0.62 : 1);
  wc.globalCompositeOperation = 'destination-in';
  wc.save();
  wc.translate(L.lx, L.ly);
  wc.scale(1, 0.62);
  const m = wc.createRadialGradient(0, 0, 0, 0, 0, reach);
  m.addColorStop(0, 'rgba(0,0,0,1)');
  m.addColorStop(0.2, 'rgba(0,0,0,0.95)');
  m.addColorStop(0.45, 'rgba(0,0,0,0.6)');
  m.addColorStop(0.75, 'rgba(0,0,0,0.18)');
  m.addColorStop(1, 'rgba(0,0,0,0)');
  wc.fillStyle = m;
  wc.fillRect(-reach, -reach, reach * 2, reach * 2);
  wc.restore();
  // clear everything outside the mask's box
  wc.globalCompositeOperation = 'destination-out';
  wc.beginPath();
  wc.rect(0, 0, w, h);
  wc.rect(L.lx - reach, L.ly - reach * 0.62, reach * 2, reach * 1.24);
  wc.fill('evenodd');

  // sprites for the live fire box: the front of the ring, and Sparky
  const stonesSp = sprite(L, L.fx - 60 * s, L.fy - 16 * s, 120 * s, 38 * s, dpr, (c, sub) => {
    for (const st of stones) if (st.front) stone(c, sub, st, false);
    c.globalAlpha = 0.92;
    for (const st of stones) if (st.front) stone(c, sub, st, true);
    c.globalAlpha = 1;
  });
  const sp = sparkyAt(L);
  const u = s * sp.sc;
  const spX = sp.x - 38 * u;
  const spY = sp.y - 27 * u;
  const sparkySp = sprite(L, spX, spY, 70 * u, 36 * u, dpr, (c, sub) => sparky(c, sub, sp.x - spX, sp.y - spY, sp.sc, -1, true));
  sparkySp.ax = sp.x;
  sparkySp.ay = sp.y;
  return {
    fireBox: { x: L.fx - 112 * s, y: L.fy - 160 * s, w: 224 * s, h: 200 * s },
    airBox: { x: L.fx - 160 * s, y: L.fy - (L.last ? 660 : 560) * s, w: 420 * s, h: (L.last ? 640 : 540) * s },
    stones: stonesSp,
    sparky: sparkySp,
    pit: buildPit(L, dpr),
  };
}

// ---- the live layer: fire, smoke and embers -------------------------------------------------------
function flickerAt(t) {
  return 0.84 + 0.08 * Math.sin(t * 7.3) * Math.sin(t * 3.1 + 1) + 0.05 * Math.sin(t * 13.7 + 0.4) + 0.03 * Math.sin(t * 23.1 + 2);
}

// The last fire burns low and red-gold.
const FLAME_COLS_LAST = [
  [
    [0, C.crimson600, 0.0],
    [0.08, C.crimson500, 0.6],
    [0.45, C.crimson600, 0.32],
    [1, C.crimson600, 0],
  ],
  [
    [0, C.ember500, 0.0],
    [0.1, C.ember400, 0.85],
    [0.5, C.crimson400, 0.55],
    [1, C.crimson500, 0],
  ],
  [
    [0, C.lattice300, 0.0],
    [0.1, C.gold300, 0.92],
    [0.45, C.ember300, 0.7],
    [1, C.ember400, 0],
  ],
];

function drawFire(ctx, L, S, t, k, flick) {
  const { fx, fy, s } = L;
  const pit = S.pit;
  const cols = L.last ? FLAME_COLS_LAST : FLAME_COLS;
  const hk = L.last ? 0.72 : 1;
  ctx.drawImage(pit.cv, fx - pit.ox, fy - pit.oy, pit.W, pit.H);
  // the body of the flame hides the crib's upper logs (their glowing cracks would read as a lattice)
  ctx.save();
  ctx.translate(fx, fy - 20 * s * hk);
  ctx.scale(1, 1.5);
  softDot(ctx, 0, 0, 24 * s * (0.8 + 0.2 * k), L.last ? C.crimson500 : C.ember500, 0.85);
  ctx.restore();
  ctx.globalCompositeOperation = 'lighter';
  // the coal bed breathing
  ctx.save();
  ctx.translate(fx, fy);
  ctx.scale(1, 0.34);
  softDot(ctx, 0, 0, 34 * s, C.ember400, 0.35 + 0.25 * Math.sin(t * 2.1) * Math.sin(t * 1.3 + 1));
  ctx.restore();
  for (const T of TONGUES) {
    const cyc = Math.sin(t * T.r + T.p) * 0.22 + Math.sin(t * T.r * 2.37 + T.p * 1.3) * 0.1;
    const h = T.h * s * k * hk * (0.82 + cyc) * (0.9 + 0.12 * flick);
    const w = T.w * s * (0.9 + 0.1 * k);
    const bx = fx + T.x * s;
    const by = fy - 4 * s;
    const g = ctx.createLinearGradient(0, by, 0, by - h);
    for (const [o, col, a] of cols[T.l]) g.addColorStop(o, rgba(col, a));
    ctx.fillStyle = g;
    const tip = tongue(ctx, bx, by, w, h, t, T, s);
    ctx.fill();
    // detached licks: a teardrop of flame breaking from the tip and rising away
    if (T.l < 2) {
      const ph = (t * T.r * 0.32 + T.p / TAU) % 1;
      if (ph < 0.42) {
        const q = ph / 0.42;
        const lx = tip[0] + Math.sin(t * 3 + T.p) * 3 * s;
        const ly = tip[1] - q * 26 * s * k * hk;
        const r = (1 - q) * w * 0.4;
        const lg = ctx.createRadialGradient(lx, ly, 0, lx, ly, r * 2.2);
        lg.addColorStop(0, rgba(T.l ? C.ember300 : C.ember400, 0.7 * (1 - q)));
        lg.addColorStop(1, rgba(C.crimson500, 0));
        ctx.fillStyle = lg;
        ctx.beginPath();
        ctx.ellipse(lx, ly, r, r * 2.1, 0, 0, TAU);
        ctx.fill();
      }
    }
  }
  // the white-hot heart (gold in the last fire)
  ctx.save();
  ctx.translate(fx, fy - 12 * s);
  ctx.scale(1.6, 1);
  softDot(ctx, 0, 0, 16 * s * k * hk, L.last ? C.gold300 : C.lattice100, 0.55 * flick);
  ctx.restore();
  ctx.globalCompositeOperation = 'source-over';
}

function makeEmbers(seed, n) {
  const rnd = mulberry32(seed);
  return Array.from({ length: n }, () => ({
    t: rnd(),
    x: (rnd() - 0.5) * 2.4,
    speed: 0.09 + rnd() * 0.16,
    amp: 6 + rnd() * 20,
    f: 1 + rnd() * 2.5,
    drift: (rnd() - 0.35) * 1.4,
    size: 0.7 + rnd() * 1.5,
    phase: rnd() * TAU,
    rise: 0.6 + rnd() * 0.6,
  }));
}

function emberPos(e, L, life, t, k) {
  const s = L.s;
  const y = L.fy - 30 * s - life * (L.last ? 260 : 330) * s * k * e.rise;
  const x = L.fx + e.x * 22 * s + Math.sin(t * e.f + e.phase + life * 4) * e.amp * s * life + e.drift * life * life * 140 * s;
  return [x, y];
}

function drawEmbers(ctx, L, list, t, k, count) {
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (let i = 0; i < count; i += 1) {
    const e = list[i];
    const life = (e.t + t * e.speed) % 1;
    const [x, y] = emberPos(e, L, life, t, k);
    const [px, py] = emberPos(e, L, Math.max(0, life - 0.007), t - 0.02, k);
    const a = (1 - life) ** 1.3 * (0.65 + 0.35 * Math.sin(t * 11 + e.phase));
    const col = life < 0.25 ? C.lattice300 : life < 0.6 ? C.ember300 : C.ember400;
    const sz = e.size * L.s * (1 - life * 0.55);
    ctx.strokeStyle = rgba(col, a);
    ctx.lineWidth = sz;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (sz > 1.2) {
      ctx.fillStyle = rgba(C.ember400, a * 0.14);
      ctx.beginPath();
      ctx.arc(x, y, sz * 1.8, 0, TAU);
      ctx.fill();
    }
  }
  ctx.globalCompositeOperation = 'source-over';
}

// Smoke: a few thin ribbons with a wave travelling up them, widening and fading as they climb;
// cool grey, catching the fire's colour only at the root.
const WISPS = [
  { x: -4, p: 0.0, sp: 1, amp: 14, drift: 1.0, len: 1 },
  { x: 7, p: 2.1, sp: 0.8, amp: 20, drift: 1.35, len: 0.85 },
  { x: -11, p: 4.2, sp: 1.15, amp: 11, drift: 0.6, len: 0.7 },
  { x: 2, p: 5.3, sp: 0.9, amp: 24, drift: 1.7, len: 0.95 },
];
const SMOKE_COOL = mix(C.stone500, C.navy600, 0.35);

function drawSmoke(ctx, L, t, k, flick) {
  const s = L.s;
  const H = (L.last ? 560 : 400) * s;
  const y0 = L.fy - (L.last ? 58 : 80) * k * s;
  const segs = 18;
  const root = mix(SMOKE_COOL, C.ember400, 0.5 * flick);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const W of WISPS) {
    const pts = [];
    for (let i = 0; i <= segs; i += 1) {
      const v = i / segs;
      const y = y0 - v * H * W.len;
      const x = L.fx + W.x * s + Math.sin(v * 5.2 - t * 0.9 * W.sp + W.p) * W.amp * s * (0.15 + v) + v * v * W.drift * 110 * s + Math.sin(t * 0.3 + W.p) * 6 * s * v;
      pts.push([x, y]);
    }
    for (const [a, b, wd, al] of [
      [0, 5, 2, 0.14],
      [5, 11, 5, 0.085],
      [11, 18, 10, 0.05],
    ]) {
      const breath = 0.7 + 0.3 * Math.sin(t * 0.7 + W.p + a * 0.4);
      ctx.beginPath();
      ctx.moveTo(...pts[a]);
      for (let i = a + 1; i <= b; i += 1) ctx.lineTo(...pts[i]);
      const col = a === 0 ? root : SMOKE_COOL;
      ctx.strokeStyle = rgba(col, al * 0.4 * breath);
      ctx.lineWidth = wd * 2.6 * s;
      ctx.stroke();
      ctx.strokeStyle = rgba(col, al * breath);
      ctx.lineWidth = wd * s;
      ctx.stroke();
    }
  }
}

function drawLive(R, t) {
  const { L, S, dpr } = R;
  const k = 0.72 + 0.5 * R.level;
  const flick = flickerAt(t);
  const fc = R.fireCtx;
  const fb = S.fireBox;
  fc.setTransform(dpr, 0, 0, dpr, -fb.x * dpr, -fb.y * dpr);
  fc.clearRect(fb.x, fb.y, fb.w, fb.h);
  drawFire(fc, L, S, t, k, flick);
  const st = S.stones;
  fc.drawImage(st.cv, st.x, st.y, st.w, st.h);
  // Sparky breathes: a slow rise and fall, every 3.6 s
  const sp = S.sparky;
  const br = 0.028 * Math.sin((t / 3.6) * TAU);
  fc.save();
  fc.translate(sp.ax, sp.ay);
  fc.scale(1 + br * 0.3, 1 + br);
  fc.drawImage(sp.cv, sp.x - sp.ax, sp.y - sp.ay, sp.w, sp.h);
  fc.restore();
  const ac = R.airCtx;
  const ab = S.airBox;
  ac.setTransform(1, 0, 0, 1, -ab.x, -ab.y);
  ac.clearRect(ab.x, ab.y, ab.w, ab.h);
  drawSmoke(ac, L, t, k, flick);
  drawEmbers(ac, L, R.embers, t, k, Math.round(R.embers.length * (L.last ? 0.4 : 0.55 + 0.45 * R.level)));
}

function placeCanvas(cv, box, dpr) {
  cv.width = Math.max(1, Math.round(box.w * dpr));
  cv.height = Math.max(1, Math.round(box.h * dpr));
  cv.style.left = `${box.x}px`;
  cv.style.top = `${box.y}px`;
  cv.style.width = `${box.w}px`;
  cv.style.height = `${box.h}px`;
  return cv.getContext('2d');
}

const FLICKER_MS = 4800;

function CampfireSceneImpl({ intensity = 0.7, fireX = 0.5, fireY = 0.82, band = false, moon, zoom = 1, variant = 'camp', scrim = null, className = '', style }) {
  const wrap = useRef(null);
  const stage = useRef(null);
  const coldRef = useRef(null);
  const warmRef = useRef(null);
  const moonRef = useRef(null);
  const airRef = useRef(null);
  const fireRef = useRef(null);
  const reduced = useReducedMotion();
  const level = clamp(Number(intensity) || 0, 0, 1);
  const fx0 = Array.isArray(fireX) ? Number(fireX[0]) : Number(fireX);
  const fx1 = Array.isArray(fireX) ? Number(fireX[1]) : fx0;
  const fy0 = Array.isArray(fireY) ? Number(fireY[0]) : Number(fireY);
  const fy1 = Array.isArray(fireY) ? Number(fireY[1]) : fy0;
  const moonKey = JSON.stringify(moon ?? null);
  const z = Number(zoom) || 1;

  useEffect(() => {
    const el = wrap.current;
    const st = stage.current;
    const coldCv = coldRef.current;
    const warmCv = warmRef.current;
    const moonCv = moonRef.current;
    const airCv = airRef.current;
    const fireCv = fireRef.current;
    if (!el || !st || !coldCv || !warmCv || !moonCv || !airCv || !fireCv) return undefined;
    if (!coldCv.getContext('2d')) return undefined;
    const opts = { fireX: [fx0, fx1], fireY: [fy0, fy1], band, moon: JSON.parse(moonKey) ?? undefined, zoom: z, variant };
    const embers = makeEmbers(11, 60);
    const warmBase = clamp(0.75 + 0.3 * level, 0, 1);
    const warmOp = (t) => clamp(warmBase * (0.86 + 0.6 * (flickerAt(t) - 0.84)), 0, 1);
    let R = null;
    let raf = 0;
    let pending = 0;
    let debounce = 0;
    let visible = true;
    let start = 0;
    let lastDraw = -1e9;
    let anim = null;

    const build = () => {
      pending = 0;
      const r = el.getBoundingClientRect();
      // Screens swap through zero-size layouts: never build, paint or step at 0×0.
      if (!(r.width >= 2 && r.height >= 2)) {
        R = null;
        return;
      }
      const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
      const w = Math.round(r.width);
      const h = Math.round(r.height);
      const L = layout(w, h, opts);
      const S = paintStatic(coldCv, warmCv, L, dpr, level);
      if (L.moon) {
        const MR = L.moon.r * 8;
        const mc = placeCanvas(moonCv, { x: L.moon.x - MR, y: L.moon.y - MR, w: MR * 2, h: MR * 2 }, dpr);
        mc.setTransform(dpr, 0, 0, dpr, 0, 0);
        paintMoon(mc, MR, L.moon.r);
        moonCv.style.display = '';
      } else {
        moonCv.style.display = 'none';
      }
      R = { L, S, dpr, w, h, level, embers, fireCtx: placeCanvas(fireCv, S.fireBox, dpr), airCtx: placeCanvas(airCv, S.airBox, 1) };
      st.style.opacity = '1';
    };
    const paint = (t) => {
      if (R) drawLive(R, t);
    };
    const loop = (ms) => {
      raf = visible && !reduced ? requestAnimationFrame(loop) : 0;
      if (!start) start = ms - 1200;
      // the fire is drawn at most 30 times a second; the light's flicker runs on the compositor
      if (ms - lastDraw < 31) return;
      lastDraw = ms;
      paint((ms - start) / 1000);
    };

    // the firelight's flicker: the warm layer's opacity, animated off the main thread
    if (reduced || typeof warmCv.animate !== 'function') {
      warmCv.style.opacity = String(warmOp(STILL_T));
    } else {
      const frames = [];
      const n = 48;
      for (let i = 0; i <= n; i += 1) frames.push({ opacity: warmOp(((i % n) / n) * (FLICKER_MS / 1000)) });
      anim = warmCv.animate(frames, { duration: FLICKER_MS, iterations: Infinity, easing: 'linear' });
    }
    st.style.transition = reduced ? 'none' : 'opacity 350ms ease-out';

    // Build after the first paint so the screen's own text shows at once; then the camp fades in.
    pending = requestAnimationFrame(() => {
      build();
      paint(STILL_T);
    });
    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            if (pending) return;
            const r = el.getBoundingClientRect();
            const rebuild = () => {
              debounce = 0;
              pending = requestAnimationFrame(() => {
                build();
                if (!raf) paint(STILL_T);
              });
            };
            // a phone's URL bar sliding: same width, a small height change — rebuild once it settles
            if (R && Math.round(r.width) === R.w && Math.abs(r.height - R.h) < R.h * 0.15) {
              clearTimeout(debounce);
              debounce = setTimeout(rebuild, 250);
            } else rebuild();
          })
        : null;
    ro?.observe(el);
    const stopWatch = watchVisibility(el, (v) => {
      visible = v;
      if (v && !reduced && !raf) raf = requestAnimationFrame(loop);
      if (!v && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      if (anim) {
        if (v) anim.play();
        else anim.pause();
      }
    });
    return () => {
      ro?.disconnect();
      stopWatch();
      clearTimeout(debounce);
      anim?.cancel();
      if (raf) cancelAnimationFrame(raf);
      if (pending) cancelAnimationFrame(pending);
    };
  }, [level, reduced, fx0, fx1, fy0, fy1, band, moonKey, z, variant]);

  return (
    <div ref={wrap} aria-hidden="true" className={`absolute inset-0 overflow-hidden ${className}`} style={style}>
      <div ref={stage} className="absolute inset-0" style={{ opacity: 0 }}>
        <canvas ref={coldRef} className="absolute inset-0 block h-full w-full" />
        <canvas ref={warmRef} className="absolute inset-0 block h-full w-full" />
        {scrim}
        <canvas ref={moonRef} className="absolute block" />
        <canvas ref={airRef} className="absolute block" />
        <canvas ref={fireRef} className="absolute block" />
      </div>
    </div>
  );
}

export const CampfireScene = memo(CampfireSceneImpl);
export default CampfireScene;
