// <CampfireScene intensity={0..1} fireY={0..1 | [portrait, wide]} className style />
// The night camp on <canvas>, painted like a key-art frame: a deep starry sky with a milky-way band,
// a low moon and moonlit cloud, layered mountains, mist and treeline; a camp of canvas tents, a
// cart, a weapon rack and the Elvian banner; the Sovereign and General Mara Voss seated on logs,
// and Sparky curled by the stones; a real fire (log crib, coal bed, layered additive flame tongues
// with turbulence, heat glow, embers and smoke that catches the light).
//
// Lighting is two cached layers of the same geometry: a cold, moonlit pass and a warm, fire-lit
// pass (with long shadows thrown away from the fire), the warm one masked by a radial falloff.
// Each frame draws cold, then warm at a flickering alpha, then the fire, embers and smoke on top,
// so the firelight visibly breathes over ground, stones, tents and figures for a few full-screen
// blits. Figures, Sparky, frame trees and foreground grass are near-silhouettes lit by `litShape`:
// a crisp rim on the edge facing the light (fire in the warm pass, moon in the cold one). `intensity` (0–1) raises the flames, the light's reach and its strength. `fireY` places
// the fire as a fraction of the height (a pair picks [portrait, wide] by aspect).
//
// devicePixelRatio capped at 2, layers rebuilt on resize (coalesced to one frame), paused offscreen
// or in a hidden tab, a single still frame under reduced motion, and nothing is drawn or stepped
// while the box measures 0×0. Fills its positioned parent. Decorative (aria-hidden).

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
  canvasLit: mix(mix(N.canvas, C.navy800, 0.3), C.frost500, 0.12),
  canvasShade: mix(N.canvasDark, C.navy900, 0.35),
  canvasWarm: mix(C.parch400, C.ember300, 0.5),
  canvasWarmDark: mix(C.ember600, N.canvasDark, 0.5),
  wood: mix(N.woodDark, C.navy950, 0.2),
  woodLit: mix(N.wood, C.stone600, 0.25),
  woodWarm: mix(C.ember500, C.ink, 0.3),
  woodWarmDark: mix(C.ember600, C.ink, 0.65),
  figure: mix(C.navy950, C.navy850, 0.35),
  figureMoon: mix(C.navy800, C.frost500, 0.25),
  figureWarm: mix(mix(C.ember600, C.ink, 0.72), BLACK, 0.35),
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
/** Fire anchor and scale for a w×h canvas. `fy` is the ground under the fire. */
function layout(w, h, fireY) {
  const wide = w > h * 0.9;
  const frac = Array.isArray(fireY) ? (wide ? fireY[1] : fireY[0]) : fireY;
  const s = clamp(Math.min(w / 380, h / 600), 0.55, 1.7);
  const fy = h * clamp(Number(frac) || 0.82, 0.3, 0.95);
  const fx = w * 0.5;
  const horizon = fy - 150 * s;
  return { w, h, fx, fy, s, horizon, lx: fx, ly: fy - 34 * s, wide };
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
function litShape(ctx, path, lx, ly, cx, cy, { dark, rimCol, rimW = 1.4, rimA = 1, bounce, bounceA = 0, span = 30 }) {
  const dx = lx - cx;
  const dy = ly - cy;
  const d = Math.hypot(dx, dy) || 1;
  const nx = dx / d;
  const ny = dy / d;
  ctx.fillStyle = dark;
  ctx.fill(path);
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
  ctx.fillStyle = rgba(rimCol, rimA);
  ctx.fill(cut, 'evenodd');
  ctx.restore();
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
function moonPos(L) {
  return { x: L.w * (L.wide ? 0.87 : 0.8), y: clamp(L.horizon * (L.wide ? 0.32 : 0.42), 40, L.h * 0.4), r: clamp(11 * L.s, 8, 18) };
}

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
  const moon = moonPos(L);
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

  // Moon: a soft halo, a disc with faint maria, a thin cloud across it.
  softDot(ctx, moon.x, moon.y, moon.r * 16, K.moonGlow, 0.12);
  softDot(ctx, moon.x, moon.y, moon.r * 5, K.moonGlow, 0.32);
  softDot(ctx, moon.x, moon.y, moon.r * 2.4, C.lattice200, 0.4);
  ctx.fillStyle = K.moon;
  ctx.beginPath();
  ctx.arc(moon.x, moon.y, moon.r, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = rgba(C.frost300, 0.45);
  for (const [dx, dy, rr] of [
    [-0.3, -0.2, 0.32],
    [0.25, 0.15, 0.24],
    [-0.05, 0.42, 0.2],
    [0.35, -0.38, 0.14],
  ]) {
    ctx.beginPath();
    ctx.arc(moon.x + dx * moon.r, moon.y + dy * moon.r, rr * moon.r, 0, TAU);
    ctx.fill();
  }
  // a whisper of shading on the lower-left limb
  const limb = ctx.createLinearGradient(moon.x + moon.r, moon.y - moon.r, moon.x - moon.r, moon.y + moon.r);
  limb.addColorStop(0.45, rgba(C.frost500, 0));
  limb.addColorStop(1, rgba(C.frost500, 0.45));
  ctx.fillStyle = limb;
  ctx.fillRect(moon.x - moon.r, moon.y - moon.r, moon.r * 2, moon.r * 2);
  ctx.restore();

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
    litShape(ctx, p, w * 0.5 + 600, horizon - 900, w * 0.5, horizon, { dark: K.pineNear, rimCol: K.figureMoon, rimW: 1.2, rimA: 0.35 });
  }
}

function groundPath(L) {
  const p = new Path2D();
  p.rect(-10, L.horizon + 6 * L.s, L.w + 20, L.h - L.horizon);
  return p;
}

function paintGround(ctx, L, warm) {
  const { w, h, s, horizon, fx, fy } = L;
  const top = horizon + 4 * s;
  if (!warm) {
    const g = ctx.createLinearGradient(0, top, 0, h);
    g.addColorStop(0, mix(K.ground, K.haze, 0.25));
    g.addColorStop(0.35, K.ground);
    g.addColorStop(1, K.groundDeep);
    ctx.fillStyle = g;
    ctx.fillRect(0, top, w, h - top);
    // the trodden clearing
    ctx.save();
    ctx.translate(fx, fy - 10 * s);
    ctx.scale(1, 0.28);
    softDot(ctx, 0, 0, 330 * s, K.dirt, 0.85);
    ctx.restore();
  } else {
    const wg = ctx.createLinearGradient(0, top, 0, top + 70 * s);
    wg.addColorStop(0, rgba(K.dirtWarm, 0));
    wg.addColorStop(1, rgba(K.dirtWarm, 1));
    ctx.fillStyle = wg;
    ctx.fillRect(0, top, w, h - top);
    ctx.save();
    ctx.translate(fx, fy - 4 * s);
    ctx.scale(1, 0.32);
    softDot(ctx, 0, 0, 200 * s, K.dirtHot, 0.9);
    ctx.restore();
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
  // texture: pebbles and tufts, the same scatter in both passes
  const rnd = mulberry32(2203);
  const tufts = Math.round(clamp((w * (h - top)) / 1700, 70, 380));
  for (let i = 0; i < tufts; i += 1) {
    const y = top + (rnd() ** 1.4) * (h - top);
    const x = rnd() * w;
    const depth = clamp((y - horizon) / (fy - horizon), 0.15, 1.8);
    const nearFire = Math.hypot((x - fx) / s, ((y - fy) / s) * 2.4) < 70;
    if (nearFire) continue;
    const kind = rnd();
    if (kind < 0.55) {
      // grass tuft
      const ht = (3 + rnd() * 5) * s * depth;
      ctx.strokeStyle = warm ? rgba(K.grassWarm, 0.6) : rgba(K.grass, 0.6);
      ctx.lineWidth = Math.max(0.6, 0.8 * s * depth);
      ctx.beginPath();
      for (let b = -2; b <= 2; b += 1) {
        ctx.moveTo(x + b * 1.2 * s * depth, y);
        ctx.quadraticCurveTo(x + b * 1.5 * s * depth, y - ht * 0.6, x + b * 2.4 * s * depth + (rnd() - 0.5) * 2, y - ht);
      }
      ctx.stroke();
    } else {
      // pebble with a lit cap
      const r = (0.6 + rnd() * 1.3) * s * depth;
      ctx.fillStyle = warm ? K.woodWarmDark : K.stone;
      ctx.beginPath();
      ctx.ellipse(x, y, r * 1.4, r * 0.8, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = warm ? rgba(K.stoneWarmLit, 0.3) : rgba(K.stoneMoon, 0.18);
      ctx.beginPath();
      ctx.ellipse(x + (warm ? (x < fx ? r * 0.4 : -r * 0.4) : r * 0.3), y - r * 0.35, r * 0.8, r * 0.35, 0, 0, TAU);
      ctx.fill();
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
  ctx.fillStyle = warm ? mix(K.canvasWarm, C.parch200, 0.3) : mix(K.canvasLit, C.frost300, 0.15);
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

function seatLog(ctx, L, x, y, sc, dir, warm) {
  const u = L.s * sc;
  const { lx, ly } = localFrame(ctx, L, x, y, u, dir);
  const log = new Path2D();
  log.moveTo(-30, -9);
  log.quadraticCurveTo(-4, -13, 20, -10);
  log.lineTo(22, 1);
  log.quadraticCurveTo(-4, 4, -30, 2);
  log.closePath();
  if (warm) warmFill(ctx, log, lx, ly, 0, -4, 30, K.woodWarmDark, K.woodWarm, 1);
  else {
    ctx.fillStyle = K.wood;
    ctx.fill(log);
  }
  // the cut end facing the fire, with rings
  const end = new Path2D();
  end.ellipse(21, -4.5, 3.6, 6, 0, 0, TAU);
  ctx.fillStyle = warm ? mix(C.ember500, C.parch400, 0.3) : K.woodLit;
  ctx.fill(end);
  ctx.strokeStyle = rgba(BLACK, 0.4);
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.ellipse(21, -4.5, 1.8, 3, 0, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = rgba(BLACK, 0.35);
  ctx.beginPath();
  ctx.moveTo(-24, -6);
  ctx.quadraticCurveTo(-4, -8, 14, -6);
  ctx.stroke();
  ctx.restore();
}

// A seated, cloaked figure facing +x (the fire), in local units (~80 tall).
function figurePaths(kind) {
  const sov = kind === 'sovereign';
  // the cloak: from the nape over the shoulders, falling behind the log and pooling on the ground
  const cloak = new Path2D();
  cloak.moveTo(-1, -61);
  cloak.bezierCurveTo(-10, -61, -17, -55, -19, -45);
  cloak.bezierCurveTo(-22, -28, sov ? -28 : -25, -8, sov ? -40 : -30, 14);
  cloak.lineTo(sov ? -50 : -36, 14.5);
  cloak.bezierCurveTo(sov ? -44 : -32, 11, sov ? -40 : -30, 12, -2, 14);
  cloak.bezierCurveTo(4, 4, 7, -8, 9, -22);
  cloak.bezierCurveTo(10, -40, 8, -55, -1, -61);
  cloak.closePath();

  // torso leaning to the warmth, forearms on the knees, hands open to the fire, shin and boot
  const body = new Path2D();
  body.moveTo(1, -60);
  body.bezierCurveTo(7, -59, 11, -55, 12.5, -50);
  body.bezierCurveTo(14, -44, 16, -38, 19, -33);
  body.bezierCurveTo(23, -30, 30, -28.5, 37, -28.5);
  body.bezierCurveTo(41, -28.5, 43.5, -26, 41.5, -23.5);
  body.bezierCurveTo(39, -22, 36, -22, 33, -21.5);
  body.bezierCurveTo(36, -18, 37, -13, 36, -7);
  body.bezierCurveTo(35, 0, 35, 5, 36, 9.5);
  body.bezierCurveTo(40, 9.5, 44, 11, 44.5, 14);
  body.lineTo(27.5, 14);
  body.bezierCurveTo(28, 6, 27, -2, 25, -8);
  body.bezierCurveTo(18, -8, 8, -6, 0, -4);
  body.bezierCurveTo(-6, -4, -9, -14, -9, -28);
  body.bezierCurveTo(-9, -44, -6, -56, 1, -60);
  body.closePath();

  // the near arm, drawn over the body so the fire picks it out: shoulder, elbow, open hand
  const arm = new Path2D();
  arm.moveTo(-3, -53);
  arm.bezierCurveTo(4, -56, 10, -50, 12, -42);
  arm.bezierCurveTo(14, -35, 18, -31, 24, -30);
  arm.bezierCurveTo(30, -30, 36, -31, 40, -30.5);
  arm.bezierCurveTo(43.5, -30, 44, -26, 41, -25.5);
  arm.bezierCurveTo(35, -25, 28, -24.5, 22, -24.5);
  arm.bezierCurveTo(15, -25, 9, -29, 5, -36);
  arm.bezierCurveTo(1, -42, -3, -47, -3, -53);
  arm.closePath();

  // a profile: brow, nose, lips, chin, the line of the jaw into the neck
  const head = new Path2D();
  head.moveTo(2, -77);
  head.bezierCurveTo(8, -77, 11, -73, 11, -69);
  head.lineTo(13.2, -65.6);
  head.lineTo(11.2, -64.6);
  head.bezierCurveTo(11.8, -63.2, 11.2, -61.8, 10.2, -61.3);
  head.bezierCurveTo(9.8, -59.6, 8.2, -58.6, 6, -58.6);
  head.bezierCurveTo(4.4, -58.6, 3.4, -58, 2.6, -55.5);
  head.lineTo(-1.5, -55.5);
  head.bezierCurveTo(-4, -60, -6, -63, -6, -69);
  head.bezierCurveTo(-6, -74, -3, -77, 2, -77);
  head.closePath();

  const extra = new Path2D();
  const hair = new Path2D();
  if (sov) {
    // a fur mantle across the shoulders
    extra.moveTo(-15, -50);
    for (let i = 0; i <= 10; i += 1) {
      const a = Math.PI * (1.02 + i * 0.096);
      extra.lineTo(Math.cos(a) * 16 + 0.5, -55 + Math.sin(a) * 7.5 + (i % 2 ? 1.8 : -1.2));
    }
    extra.lineTo(13, -50);
    extra.bezierCurveTo(6, -45, -6, -44, -15, -50);
    extra.closePath();
    // long hair falling to the shoulders behind the circlet
    hair.moveTo(-6.5, -68);
    hair.bezierCurveTo(-7, -77, 4, -80, 10.5, -73);
    hair.bezierCurveTo(5, -75, 0, -73.5, -1, -67);
    hair.bezierCurveTo(-2, -61, -4, -56, -7, -52);
    hair.bezierCurveTo(-11, -55, -9, -62, -6.5, -68);
    hair.closePath();
  } else {
    // a pauldron, and the sword riding behind the hip, scabbard tip on the ground
    extra.ellipse(-2, -52, 10, 5.5, -0.3, Math.PI, TAU);
    extra.closePath();
    extra.moveTo(-6, -20);
    extra.lineTo(-38, 8);
    extra.lineTo(-36.5, 10);
    extra.lineTo(-4.5, -18);
    extra.closePath();
    extra.moveTo(-4, -23.5);
    extra.lineTo(-10, -15);
    extra.lineTo(-8.5, -14);
    extra.lineTo(-2.5, -22.5);
    extra.closePath();
    // cropped and swept back, tied at the nape
    hair.moveTo(-6, -66);
    hair.bezierCurveTo(-6, -77, 6, -79.5, 11.2, -71);
    hair.bezierCurveTo(5, -73, 0.5, -72, -0.5, -66.5);
    hair.bezierCurveTo(-2, -64, -5, -62.5, -8, -60);
    hair.bezierCurveTo(-10.5, -58, -12.5, -59, -11, -61.5);
    hair.bezierCurveTo(-9, -63, -7, -63.5, -6, -66);
    hair.closePath();
  }
  return { cloak, body, arm, head, extra, hair, sov };
}

function figure(ctx, L, x, y, sc, dir, kind, warm) {
  const u = L.s * sc;
  if (warm) castShadow(ctx, L, x, y + 8 * u, 46 * u, 34 * u, 0.6);
  contactShadow(ctx, x, y + 10 * u, 34 * u, 6 * u, 0.6);
  seatLog(ctx, L, x, y + 10 * u, sc, dir, warm);
  const { lx, ly } = localFrame(ctx, L, x, y, u, dir);
  const P = figurePaths(kind);
  if (warm) {
    // near-silhouettes: a dark body, a hot crescent on the fire side, a soft bounce on the front
    const dark = K.figureWarm;
    const o = { dark, rimCol: C.ember300, rimW: 1.25, bounce: C.ember500, bounceA: 0.42, span: 34 };
    litShape(ctx, P.cloak, lx, ly, 2, -26, { ...o, rimCol: C.ember400, rimW: 1, bounceA: 0.2 });
    litShape(ctx, P.body, lx, ly, 14, -30, o);
    litShape(ctx, P.extra, lx, ly, 0, -44, { ...o, rimCol: C.ember400, rimW: 0.8, bounceA: 0.3, span: 16 });
    litShape(ctx, P.arm, lx, ly, 20, -36, { ...o, rimCol: C.ember200, rimW: 1.1, bounceA: 0.5, span: 22 });
    litShape(ctx, P.head, lx, ly, 3, -67, { ...o, rimCol: C.lattice300, rimW: 1.2, bounce: C.ember400, bounceA: 0.5, span: 9 });
    litShape(ctx, P.hair, lx, ly, -1, -68, { ...o, dark: mix(dark, BLACK, 0.4), rimCol: C.ember400, rimW: 0.8, bounceA: 0.2, span: 10 });
  } else {
    // moonlight from the upper right of the screen, mapped into this mirrored local frame
    const mx = dir * 600;
    const o = { dark: K.figure, rimCol: K.figureMoon, rimW: 1, rimA: 0.75 };
    litShape(ctx, P.cloak, mx, -800, 2, -26, o);
    litShape(ctx, P.body, mx, -800, 14, -30, o);
    litShape(ctx, P.extra, mx, -800, 0, -44, o);
    litShape(ctx, P.arm, mx, -800, 20, -36, o);
    litShape(ctx, P.head, mx, -800, 3, -67, o);
    litShape(ctx, P.hair, mx, -800, -1, -68, { ...o, dark: mix(K.figure, BLACK, 0.4) });
  }
  // the cloak's fold lines, picked out faintly
  ctx.strokeStyle = warm ? rgba(BLACK, 0.45) : rgba(BLACK, 0.5);
  ctx.lineWidth = 0.9;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-9, -48);
  ctx.quadraticCurveTo(-15, -20, -22, 11);
  ctx.moveTo(-2, -44);
  ctx.quadraticCurveTo(-5, -18, -10, 10);
  ctx.stroke();
  if (P.sov) {
    // a thin gold circlet that the fire finds
    ctx.strokeStyle = warm ? C.gold300 : C.gold700;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-5.5, -70);
    ctx.quadraticCurveTo(3, -72.5, 10.5, -71);
    ctx.stroke();
    ctx.fillStyle = warm ? C.lattice300 : C.gold600;
    ctx.beginPath();
    ctx.moveTo(4, -72);
    ctx.lineTo(5, -75.5);
    ctx.lineTo(6, -72);
    ctx.fill();
  } else if (warm) {
    // the sword's brass pommel glints
    ctx.fillStyle = C.gold400;
    ctx.beginPath();
    ctx.arc(-6.5, -21.5, 1.6, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function sparky(ctx, L, x, y, sc, warm) {
  // Sparky, the young acid drake, curled like a hound by the stones: chin on his forepaws, ears
  // swept back, a folded wing on his back, his tail wrapped round, one sleepy eye on the fire.
  const u = L.s * sc;
  contactShadow(ctx, x - 4 * u, y + 1 * u, 30 * u, 5 * u, 0.75);
  const { lx, ly } = localFrame(ctx, L, x, y, u, -1);
  const tail = new Path2D();
  tail.moveTo(-22, -1);
  tail.bezierCurveTo(-20, 4, 0, 5, 12, 2.5);
  tail.bezierCurveTo(15, 2, 17, 3.5, 13.5, 4.8);
  tail.bezierCurveTo(0, 7.5, -18, 6.5, -25, 0);
  tail.closePath();
  const body = new Path2D();
  body.moveTo(-22, 0);
  body.bezierCurveTo(-29, -6, -26, -17, -14, -19.5);
  body.bezierCurveTo(-4, -22, 8, -21, 14, -14);
  body.bezierCurveTo(16, -10, 17, -5, 16, -2);
  body.bezierCurveTo(8, 1, -10, 1.5, -22, 0);
  body.closePath();
  const head = new Path2D();
  head.moveTo(11, -11);
  head.bezierCurveTo(14, -17.5, 23, -18, 27, -13);
  head.bezierCurveTo(31, -12, 35, -9.5, 36.5, -7);
  head.bezierCurveTo(37.5, -5, 35.5, -3.5, 32, -3.5);
  head.bezierCurveTo(26, -3, 18, -3, 12, -5);
  head.closePath();
  // ears like a hound's, horned at the tips
  head.moveTo(17, -15.5);
  head.lineTo(9.5, -22);
  head.lineTo(21, -16.5);
  head.closePath();
  head.moveTo(21.5, -16.5);
  head.lineTo(15.5, -23.5);
  head.lineTo(24.5, -16);
  head.closePath();
  const paws = new Path2D();
  paws.moveTo(13, -3);
  paws.bezierCurveTo(22, -4, 30, -3, 35.5, -1.8);
  paws.bezierCurveTo(37, -0.8, 36, 0.6, 33.5, 0.6);
  paws.lineTo(13, 0.6);
  paws.closePath();
  const wing = new Path2D();
  wing.moveTo(-13, -18);
  wing.bezierCurveTo(-7, -28, 6, -27, 10.5, -17);
  wing.lineTo(5.5, -16);
  wing.lineTo(1.5, -19.5);
  wing.lineTo(-2.5, -16.5);
  wing.lineTo(-7, -19);
  wing.closePath();
  const parts = [
    [tail, -6, 3],
    [body, -4, -10],
    [wing, -1, -21],
    [paws, 24, -2],
    [head, 24, -10],
  ];
  if (warm) {
    const dark = mix(mix(C.ink, C.acid600, 0.1), BLACK, 0.2);
    for (const [p, cx, cy] of parts) {
      const soft = p === tail || p === wing;
      litShape(ctx, p, lx, ly, cx, cy, { dark, rimCol: C.ember200, rimW: 1, rimA: soft ? 0.4 : 1, bounce: C.ember500, bounceA: 0.45, span: 18 });
    }
  } else {
    const dark = mix(C.acid600, BLACK, 0.86);
    for (const [p, cx, cy] of parts) litShape(ctx, p, -600, -800, cx, cy, { dark, rimCol: K.figureMoon, rimW: 0.8, rimA: 0.6 });
  }
  // wing ribs and a ridge of small spines down the back
  ctx.strokeStyle = rgba(BLACK, 0.5);
  ctx.lineWidth = 0.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(1.5, -19.5);
  ctx.lineTo(-1, -25.5);
  ctx.moveTo(-2.5, -16.5);
  ctx.lineTo(-5, -24);
  ctx.stroke();
  // one sleepy eye, a sliver of acid green, and a faint glow where the fire meets the scales
  ctx.strokeStyle = rgba(C.acid300, warm ? 0.95 : 0.7);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(25, -11);
  ctx.quadraticCurveTo(26.8, -10, 28.6, -11);
  ctx.stroke();
  if (warm) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    softDot(ctx, 27, -10.5, 4, C.acid400, 0.25);
    ctx.restore();
  }
  ctx.restore();
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
    const n = 4;
    ctx.strokeStyle = rgba(C.ember300, 0.85);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let i = 0; i < n; i += 1) {
      const t = 0.35 + (i / n) * 0.6;
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

// ---- cached layers ---------------------------------------------------------------------------
function paintCamp(ctx, L, warm) {
  const s = L.s;
  // On a tall phone screen the camp gathers in closer so the tents still frame the fire.
  const spread = L.wide ? 1 : 0.74;
  const F = (dx, dy) => [L.fx + (Math.abs(dx) > 130 ? dx * spread : dx) * s, L.fy + dy * s];
  frameTrees(ctx, L, warm);
  const items = [
    { y: -112, draw: () => tent(ctx, L, ...F(-520, -112), 0.62, 1, warm) },
    { y: -104, draw: () => tent(ctx, L, ...F(540, -104), 0.66, -1, warm, { pennant: C.crimson600 }) },
    { y: -96, draw: () => tent(ctx, L, ...F(390, -96), 0.82, -1, warm) },
    { y: -78, draw: () => cart(ctx, L, ...F(-400, -78), 0.95, warm) },
    { y: -66, draw: () => tent(ctx, L, ...F(-262, -66), 1.12, 1, warm, { lantern: true }) },
    { y: -58, draw: () => tent(ctx, L, ...F(262, -60), 1.05, -1, warm, { pennant: C.ember600 }) },
    { y: -40, draw: () => weaponRack(ctx, L, ...F(L.wide ? 158 : 150, L.wide ? -40 : -70), L.wide ? 0.92 : 0.8, warm) },
    { y: 20, draw: () => woodpile(ctx, L, ...F(L.wide ? -170 : -150, L.wide ? 22 : 30), 1, warm) },
    { y: 4, draw: () => figure(ctx, L, ...F(-96, -2), 1.12, 1, 'mara', warm) },
    { y: 10, draw: () => figure(ctx, L, ...F(100, 2), 1.16, -1, 'sovereign', warm) },
  ];
  // back to front
  items.sort((a, b) => a.y - b.y);
  for (const it of items) it.draw();
  foreground(ctx, L, warm);
}

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
    litShape(ctx, blades, fx + 600, h - 900, fx, h, { dark: mix(K.groundDeep, BLACK, 0.4), rimCol: K.figureMoon, rimW: 0.7, rimA: 0.35 });
  }
}

function buildLayers(L, dpr, intensity) {
  const { w, h, s } = L;
  const reach = (300 + 120 * intensity) * s;
  const stones = ringStones();
  // cold: sky, terrain, camp in moonlight
  const cold = layer(w, h, dpr);
  paintSky(cold.ctx, L);
  paintTerrain(cold.ctx, L);
  paintGround(cold.ctx, L, false);
  paintCamp(cold.ctx, L, false);
  for (const st of stones) if (!st.front) stone(cold.ctx, L, st, false);
  // warm: the same camp lit by the fire, masked by its falloff
  const warmL = layer(w, h, dpr);
  const wc = warmL.ctx;
  wc.save();
  wc.clip(groundPath(L));
  paintGround(wc, L, true);
  wc.restore();
  paintCamp(wc, L, true);
  for (const st of stones) if (!st.front) stone(wc, L, st, true);
  wc.globalCompositeOperation = 'destination-in';
  wc.save();
  wc.translate(L.lx, L.ly);
  wc.scale(1, 0.62);
  const m = wc.createRadialGradient(0, 0, 0, 0, 0, reach);
  m.addColorStop(0, 'rgba(0,0,0,1)');
  m.addColorStop(0.22, 'rgba(0,0,0,0.92)');
  m.addColorStop(0.5, 'rgba(0,0,0,0.5)');
  m.addColorStop(0.78, 'rgba(0,0,0,0.16)');
  m.addColorStop(1, 'rgba(0,0,0,0)');
  wc.fillStyle = m;
  wc.fillRect(-reach, -reach, reach * 2, reach * 2);
  wc.restore();
  // fill everything outside the mask's box (transparent)
  wc.globalCompositeOperation = 'destination-out';
  wc.save();
  wc.beginPath();
  wc.rect(0, 0, w, h);
  wc.rect(L.lx - reach, L.ly - reach * 0.62, reach * 2, reach * 1.24);
  wc.fill('evenodd');
  wc.restore();
  wc.globalCompositeOperation = 'source-over';

  // foreground: the front of the ring and Sparky, in a small box around the fire
  const box = { x: L.fx - 100 * s, y: L.fy - 40 * s, w: 200 * s, h: 82 * s };
  const fgCold = layer(box.w, box.h, dpr);
  const fgWarm = layer(box.w, box.h, dpr);
  const sub = { ...L, fx: L.fx - box.x, fy: L.fy - box.y, lx: L.lx - box.x, ly: L.ly - box.y };
  for (const [c, warm] of [
    [fgCold.ctx, false],
    [fgWarm.ctx, true],
  ]) {
    for (const st of stones) if (st.front) stone(c, sub, st, warm);
    sparky(c, sub, sub.fx + 60 * s, sub.fy + 27 * s, 1.15, warm);
  }
  return { cold: cold.cv, warm: warmL.cv, fgCold: fgCold.cv, fgWarm: fgWarm.cv, box, pit: buildPit(L, dpr), reach };
}

// ---- per-frame: banner, fire, embers, smoke ---------------------------------------------------
function flickerAt(t) {
  return 0.84 + 0.08 * Math.sin(t * 7.3) * Math.sin(t * 3.1 + 1) + 0.05 * Math.sin(t * 13.7 + 0.4) + 0.03 * Math.sin(t * 23.1 + 2);
}

function banner(ctx, L, t, warmA) {
  const s = L.s;
  const px = Math.min(L.fx + (L.wide ? 206 : 178) * s, L.w - 52 * s);
  const py = L.fy - (L.wide ? 52 : 84) * s;
  const top = py - 230 * s;
  // pole and crossbar
  ctx.lineCap = 'round';
  ctx.strokeStyle = K.wood;
  ctx.lineWidth = 3 * s;
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px, top - 8 * s);
  ctx.moveTo(px - 2 * s, top);
  ctx.lineTo(px + 40 * s, top);
  ctx.stroke();
  ctx.strokeStyle = rgba(C.ember300, 0.55 * warmA);
  ctx.lineWidth = 1 * s;
  ctx.beginPath();
  ctx.moveTo(px - 1.2 * s, py);
  ctx.lineTo(px - 1.2 * s, py - 110 * s);
  ctx.stroke();
  // finial: a small gilt four-point star
  ctx.fillStyle = C.gold400;
  ctx.beginPath();
  const fy = top - 14 * s;
  const r = 6 * s;
  ctx.moveTo(px, fy - r);
  ctx.lineTo(px + r * 0.28, fy - r * 0.28);
  ctx.lineTo(px + r, fy);
  ctx.lineTo(px + r * 0.28, fy + r * 0.28);
  ctx.lineTo(px, fy + r);
  ctx.lineTo(px - r * 0.28, fy + r * 0.28);
  ctx.lineTo(px - r, fy);
  ctx.lineTo(px - r * 0.28, fy - r * 0.28);
  ctx.closePath();
  ctx.fill();
  // the cloth, rippling: left and right edges, a swallowtail
  const bw = 34 * s;
  const bl = 92 * s;
  const x0 = px + 3 * s;
  const ripple = (v) => Math.sin(t * 1.7 - v * 4.2) * 3.2 * s * v + Math.sin(t * 2.9 - v * 7) * 1.2 * s * v;
  const left = [];
  const right = [];
  const n = 10;
  for (let i = 0; i <= n; i += 1) {
    const v = i / n;
    const y = top + v * bl;
    left.push([x0 + ripple(v), y]);
    right.push([x0 + bw + ripple(v) * 1.15, y + Math.sin(t * 1.7 - v * 4.2 + 1) * 1.2 * s]);
  }
  const cloth = new Path2D();
  cloth.moveTo(...left[0]);
  for (const p of left.slice(1)) cloth.lineTo(...p);
  const [lbx, lby] = left[n];
  const [rbx, rby] = right[n];
  cloth.lineTo((lbx + rbx) / 2, lby - 16 * s);
  cloth.lineTo(rbx, rby + 6 * s);
  for (const p of right.slice(0, n).reverse()) cloth.lineTo(...p);
  cloth.closePath();
  const g = ctx.createLinearGradient(x0, top, x0 + bw, top);
  g.addColorStop(0, C.navy800);
  g.addColorStop(0.6, C.navy700);
  g.addColorStop(1, mix(C.navy700, C.frost500, 0.25));
  ctx.fillStyle = g;
  ctx.fill(cloth);
  // shading in the folds
  ctx.save();
  ctx.clip(cloth);
  for (let i = 0; i < n; i += 1) {
    const v = i / n;
    const d = Math.cos(t * 1.7 - v * 4.2);
    ctx.fillStyle = d > 0 ? rgba(C.frost300, 0.06 * d) : rgba(BLACK, -0.25 * d);
    ctx.fillRect(x0 - 8 * s, top + v * bl, bw + 20 * s, bl / n + 1);
  }
  // firelight washing the lower cloth
  const wg = ctx.createLinearGradient(0, top + bl, 0, top);
  wg.addColorStop(0, rgba(C.ember400, 0.38 * warmA));
  wg.addColorStop(1, rgba(C.ember400, 0));
  ctx.fillStyle = wg;
  ctx.fillRect(x0 - 8 * s, top, bw + 20 * s, bl + 10 * s);
  // the device: a gold border and the four-point star of Elvia
  ctx.strokeStyle = rgba(C.gold500, 0.85);
  ctx.lineWidth = 1.4 * s;
  ctx.stroke(cloth);
  const mid = left[4];
  const cx = mid[0] + bw * 0.5 + ripple(0.4) * 0.1;
  const cy = mid[1] - 2 * s;
  const sr = 10 * s;
  ctx.fillStyle = C.gold400;
  ctx.beginPath();
  ctx.moveTo(cx, cy - sr);
  ctx.lineTo(cx + sr * 0.22, cy - sr * 0.22);
  ctx.lineTo(cx + sr * 0.8, cy);
  ctx.lineTo(cx + sr * 0.22, cy + sr * 0.22);
  ctx.lineTo(cx, cy + sr);
  ctx.lineTo(cx - sr * 0.22, cy + sr * 0.22);
  ctx.lineTo(cx - sr * 0.8, cy);
  ctx.lineTo(cx - sr * 0.22, cy - sr * 0.22);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = rgba(C.gold400, 0.7);
  ctx.lineWidth = 1 * s;
  ctx.beginPath();
  ctx.arc(cx, cy, sr * 1.25, -1.2, 4.4);
  ctx.stroke();
  ctx.restore();
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

function drawFire(ctx, L, layers, t, k, flick) {
  const { fx, fy, s } = L;
  const pit = layers.pit;
  // heat glow under and around the flames
  ctx.globalCompositeOperation = 'lighter';
  ctx.save();
  ctx.translate(fx, fy - 46 * s * k);
  ctx.scale(1, 1.25);
  softDot(ctx, 0, 0, 120 * s * k, C.ember500, 0.3 * flick);
  ctx.restore();
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(pit.cv, fx - pit.ox, fy - pit.oy, pit.W, pit.H);
  // the coal bed breathing
  ctx.globalCompositeOperation = 'lighter';
  ctx.save();
  ctx.translate(fx, fy);
  ctx.scale(1, 0.34);
  softDot(ctx, 0, 0, 34 * s, C.ember400, 0.35 + 0.25 * Math.sin(t * 2.1) * Math.sin(t * 1.3 + 1));
  ctx.restore();
  // flame tongues
  for (const T of TONGUES) {
    const cyc = Math.sin(t * T.r + T.p) * 0.22 + Math.sin(t * T.r * 2.37 + T.p * 1.3) * 0.1;
    const h = T.h * s * k * (0.82 + cyc) * (0.9 + 0.12 * flick);
    const w = T.w * s * (0.9 + 0.1 * k);
    const bx = fx + T.x * s;
    const by = fy - 4 * s;
    const g = ctx.createLinearGradient(0, by, 0, by - h);
    for (const [o, col, a] of FLAME_COLS[T.l]) g.addColorStop(o, rgba(col, a));
    ctx.fillStyle = g;
    const tip = tongue(ctx, bx, by, w, h, t, T, s);
    ctx.fill();
    // detached licks: a teardrop of flame breaking from the tip and rising away
    if (T.l < 2) {
      const ph = (t * T.r * 0.32 + T.p / TAU) % 1;
      if (ph < 0.42) {
        const q = ph / 0.42;
        const lx = tip[0] + Math.sin(t * 3 + T.p) * 3 * s;
        const ly = tip[1] - q * 26 * s * k;
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
  // white-hot heart
  ctx.save();
  ctx.translate(fx, fy - 12 * s);
  ctx.scale(1.6, 1);
  softDot(ctx, 0, 0, 16 * s * k, C.lattice100, 0.55 * flick);
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
  const y = L.fy - 30 * s - life * 330 * s * k * e.rise;
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

const SMOKE = Array.from({ length: 11 }, (_, i) => ({ t: i / 11, x: ((i * 37) % 11) / 11 - 0.5, sz: 0.8 + ((i * 53) % 7) / 10 }));

function drawSmoke(ctx, L, t, k, flick) {
  const s = L.s;
  for (const p of SMOKE) {
    const life = (p.t + t * 0.045) % 1;
    const y = L.fy - (95 * k + life * 380) * s;
    const x = L.fx + p.x * 20 * s + Math.sin(t * 0.5 + p.t * 9) * 12 * s * life + life * life * 150 * s;
    const r = (16 + life * 90) * s * p.sz;
    const a = Math.sin(Math.PI * Math.min(1, life * 1.4)) * 0.36 * (1 - life * 0.55);
    if (a <= 0.003) continue;
    // lit from below: the low smoke takes the fire's colour, the high smoke the night's
    const warmth = clamp(1 - life * 2.2, 0, 1) * flick;
    const col = mix(mix(C.stone500, C.navy600, 0.4), C.ember400, warmth * 0.65);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1.25, 1);
    softDot(ctx, 0, 0, r, col, a);
    ctx.restore();
  }
}

function twinkles(ctx, L, list, t) {
  ctx.globalCompositeOperation = 'lighter';
  for (const st of list) {
    const tw = 0.5 + 0.5 * Math.sin(t * st.f + st.p);
    const x = st.x * L.w;
    const y = st.y * L.horizon * 0.9;
    const r = st.r * (0.6 + 0.6 * tw);
    ctx.fillStyle = rgba(C.lattice200, 0.35 + 0.5 * tw);
    ctx.beginPath();
    ctx.arc(x, y, r * 0.55, 0, TAU);
    ctx.fill();
    // four-point glint
    ctx.strokeStyle = rgba(C.lattice200, 0.22 * tw);
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(x - r * 3.4, y);
    ctx.lineTo(x + r * 3.4, y);
    ctx.moveTo(x, y - r * 3.4);
    ctx.lineTo(x, y + r * 3.4);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
}

function makeTwinkles(seed) {
  const rnd = mulberry32(seed);
  return Array.from({ length: 16 }, () => ({ x: rnd(), y: rnd(), r: 0.9 + rnd() * 1.1, f: 0.8 + rnd() * 1.8, p: rnd() * TAU }));
}

function drawFrame(ctx, L, layers, emberList, twinkleList, t, intensity) {
  const k = 0.72 + 0.5 * intensity;
  const flick = flickerAt(t);
  const warmA = clamp((0.62 + 0.38 * intensity) * flick, 0, 1);
  ctx.globalAlpha = 1;
  ctx.drawImage(layers.cold, 0, 0, L.w, L.h);
  twinkles(ctx, L, twinkleList, t);
  ctx.globalAlpha = warmA;
  ctx.drawImage(layers.warm, 0, 0, L.w, L.h);
  ctx.globalAlpha = 1;
  // a broad wash of firelight in the air
  ctx.globalCompositeOperation = 'lighter';
  ctx.save();
  ctx.translate(L.lx, L.ly);
  ctx.scale(1, 0.75);
  softDot(ctx, 0, 0, layers.reach * 0.55, C.ember500, 0.12 * flick * (0.6 + 0.4 * intensity));
  ctx.restore();
  ctx.globalCompositeOperation = 'source-over';
  banner(ctx, L, t, warmA);
  drawSmoke(ctx, L, t, k, flick);
  drawFire(ctx, L, layers, t, k, flick);
  const b = layers.box;
  ctx.drawImage(layers.fgCold, b.x, b.y, b.w, b.h);
  ctx.globalAlpha = Math.min(1, warmA * 1.1);
  ctx.drawImage(layers.fgWarm, b.x, b.y, b.w, b.h);
  ctx.globalAlpha = 1;
  drawEmbers(ctx, L, emberList, t, k, Math.round(emberList.length * (0.55 + 0.45 * intensity)));
}

function CampfireSceneImpl({ intensity = 0.7, fireY = 0.82, className = '', style }) {
  const wrap = useRef(null);
  const canvas = useRef(null);
  const reduced = useReducedMotion();
  const level = clamp(Number(intensity) || 0, 0, 1);
  const fy0 = Array.isArray(fireY) ? Number(fireY[0]) : Number(fireY);
  const fy1 = Array.isArray(fireY) ? Number(fireY[1]) : fy0;

  useEffect(() => {
    const el = wrap.current;
    const cv = canvas.current;
    if (!el || !cv) return undefined;
    const ctx = cv.getContext('2d');
    if (!ctx) return undefined;
    const emberList = makeEmbers(11, 60);
    const twinkleList = makeTwinkles(23);
    let L = null;
    let layers = null;
    let raf = 0;
    let pending = 0;
    let visible = true;
    let start = 0;

    const build = () => {
      pending = 0;
      const r = el.getBoundingClientRect();
      // Screens swap through zero-size layouts: never build, paint or step at 0×0.
      if (!(r.width >= 2 && r.height >= 2)) {
        L = null;
        layers = null;
        return;
      }
      const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
      const w = Math.round(r.width);
      const h = Math.round(r.height);
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      L = layout(w, h, [fy0, fy1]);
      layers = buildLayers(L, dpr, level);
    };
    const paint = (ms) => {
      if (!L || !layers) return;
      drawFrame(ctx, L, layers, emberList, twinkleList, reduced ? STILL_T : ms / 1000, level);
    };
    const loop = (ms) => {
      if (!start) start = ms - 1200;
      paint(ms - start);
      raf = visible && !reduced ? requestAnimationFrame(loop) : 0;
    };

    build();
    paint(STILL_T * 1000);
    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            if (pending) return;
            pending = requestAnimationFrame(() => {
              build();
              if (!raf) paint(STILL_T * 1000);
            });
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
    });
    return () => {
      ro?.disconnect();
      stopWatch();
      if (raf) cancelAnimationFrame(raf);
      if (pending) cancelAnimationFrame(pending);
    };
  }, [level, reduced, fy0, fy1]);

  return (
    <div ref={wrap} aria-hidden="true" className={`absolute inset-0 ${className}`} style={style}>
      <canvas ref={canvas} className="block h-full w-full" />
    </div>
  );
}

export const CampfireScene = memo(CampfireSceneImpl);
export default CampfireScene;
