// Where each duel happens. A stage is a painted backdrop (cached to an offscreen canvas on resize),
// animated lights drawn every frame (fires, water, the glowing symbol), an atmosphere of particles,
// and the light that falls on the foe. The march beat picks the stage; trials and the training yard
// have their own.

import { TAU, clamp01, glow, hex, lerp, mix, pine, ridge, rgba, rng, vgrad } from './util.js';

export function layout(cssW, cssH) {
  // Never a zero scale: every painter steps its loops by multiples of `s`.
  const w = Math.max(32, cssW);
  const h = Math.max(32, cssH);
  const phone = w < 600;
  const s = Math.min(w / 420, h / 640) * (phone ? 1 : 0.84);
  return {
    w,
    h,
    cx: w / 2,
    s,
    phone,
    horizon: h * (phone ? 0.43 : 0.47),
    floorY: h * (phone ? 0.65 : 0.72),
    // on phones the controls cover the bottom quarter: the crossguard rests just under the
    // Sovereign's bar and the blade rises into the open beside the foe
    bladeY: h * (phone ? 0.75 : 0.9),
  };
}

const BEAT_STAGE = {
  checkpoint: 'checkpoint',
  wilds: 'wilds',
  ruin: 'ruin',
  champion: 'ford',
  skirmish: 'ford_winter',
  last_stand: 'siege',
  trial: 'circle',
};

/** The stage for a duel config: the march beat, the War Room trial, or the training yard. */
export function stageFor(config) {
  if (config?.stage && STAGES[config.stage]) return config.stage;
  if (config?.beat && BEAT_STAGE[config.beat]) return BEAT_STAGE[config.beat];
  if (config?.modifiers?.stakes === 'drill' || config?.modifiers?.stakes === 'practice') return 'yard';
  return 'circle';
}

// ── shared painters ─────────────────────────────────────────────────────────────────────────

function stars(ctx, L, r, count, maxY, color = [255, 246, 226]) {
  for (let i = 0; i < count; i += 1) {
    const x = r() * L.w;
    const y = r() ** 1.6 * maxY;
    const big = r() < 0.08;
    ctx.fillStyle = rgba(color, 0.25 + r() * (big ? 0.7 : 0.45));
    ctx.beginPath();
    ctx.arc(x, y, (big ? 1.4 : 0.7) * Math.max(1, L.s), 0, TAU);
    ctx.fill();
  }
}

function moon(ctx, x, y, rad, color = [246, 239, 223]) {
  glow(ctx, x, y, rad * 6, color, 0.1, false);
  glow(ctx, x, y, rad * 2.2, color, 0.14, false);
  // the disc sits at ~85% luminance so its seas and craters still read under the grade
  const g = ctx.createRadialGradient(x - rad * 0.3, y - rad * 0.3, rad * 0.1, x, y, rad);
  g.addColorStop(0, rgba([232, 228, 216]));
  g.addColorStop(1, rgba(mix(color, [150, 156, 172], 0.5)));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, rad, 0, TAU);
  ctx.fill();
  ctx.fillStyle = rgba([128, 134, 152], 0.42);
  for (const [dx, dy, rr] of [[-0.3, -0.1, 0.24], [0.25, 0.3, 0.18], [0.1, -0.42, 0.13], [-0.05, 0.45, 0.1], [0.42, -0.12, 0.09]]) {
    ctx.beginPath();
    ctx.arc(x + dx * rad, y + dy * rad, rr * rad, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = rgba([255, 250, 236], 0.35);
  for (const [dx, dy, rr] of [[-0.24, -0.16, 0.06], [0.3, 0.24, 0.05]]) {
    ctx.beginPath();
    ctx.arc(x + dx * rad, y + dy * rad, rr * rad, 0, TAU);
    ctx.fill();
  }
}

function clouds(ctx, L, r, { y0, y1, count, color, alpha }) {
  for (let i = 0; i < count; i += 1) {
    const x = r() * L.w;
    const y = lerp(y0, y1, r());
    const len = (80 + r() * 160) * L.s;
    const th = (6 + r() * 10) * L.s;
    const g = ctx.createLinearGradient(x - len, 0, x + len, 0);
    g.addColorStop(0, rgba(color, 0));
    g.addColorStop(0.5, rgba(color, alpha * (0.5 + r() * 0.5)));
    g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, len, th, 0, 0, TAU);
    ctx.fill();
  }
}

/** The ground plane from the horizon to the bottom, darkening toward the viewer's feet. */
function ground(ctx, L, far, near, edge = null) {
  vgrad(ctx, 0, L.horizon - 1, L.w, L.h - L.horizon + 1, [
    [0, far],
    [0.35, mix(far, near, 0.55)],
    [1, near],
  ]);
  if (edge) {
    const g = ctx.createLinearGradient(0, L.horizon - 2, 0, L.horizon + 14 * L.s);
    g.addColorStop(0, rgba(edge, 0.55));
    g.addColorStop(1, rgba(edge, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, L.horizon - 2, L.w, 16 * L.s);
  }
}

/** Screen y of a ground row at depth z (0 = horizon, 1 = bottom of the screen), with perspective. */
function rowY(L, z) {
  return L.horizon + (L.h - L.horizon) * z ** 1.7;
}

function perspectiveGrid(ctx, L, { rows, cols, color, alpha, jitter = 0, seed = 1 }) {
  const r = rng(seed);
  ctx.strokeStyle = rgba(color, alpha);
  ctx.lineWidth = Math.max(1, 1.1 * L.s);
  for (let i = 1; i <= rows; i += 1) {
    const y = rowY(L, i / rows);
    ctx.globalAlpha = 0.35 + 0.65 * (i / rows);
    ctx.beginPath();
    ctx.moveTo(0, y + (r() - 0.5) * jitter);
    ctx.lineTo(L.w, y + (r() - 0.5) * jitter);
    ctx.stroke();
  }
  for (let j = -cols; j <= cols; j += 1) {
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(L.cx + j * 6 * L.s, L.horizon);
    ctx.lineTo(L.cx + j * (L.w / cols) * 1.4, L.h);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/** An ellipse of light (or inlay) lying on the ground around the duel. */
function groundRing(ctx, L, rx, color, alpha, width = 2) {
  ctx.save();
  ctx.translate(L.cx, L.floorY + 6 * L.s);
  ctx.scale(1, 0.26);
  ctx.strokeStyle = rgba(color, alpha);
  ctx.lineWidth = width * L.s * 3;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

function haze(ctx, L, y, hgt, color, alpha) {
  const g = ctx.createLinearGradient(0, y - hgt, 0, y + hgt);
  g.addColorStop(0, rgba(color, 0));
  g.addColorStop(0.5, rgba(color, alpha));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, y - hgt, L.w, hgt * 2);
}

function banner(ctx, x, top, w, h, cloth, trim, emblem = true) {
  ctx.fillStyle = rgba(cloth);
  ctx.beginPath();
  ctx.moveTo(x - w / 2, top);
  ctx.lineTo(x + w / 2, top);
  ctx.lineTo(x + w / 2, top + h);
  ctx.lineTo(x, top + h * 0.86);
  ctx.lineTo(x - w / 2, top + h);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = rgba(trim, 0.85);
  ctx.lineWidth = Math.max(1, w * 0.06);
  ctx.stroke();
  if (emblem) {
    ctx.strokeStyle = rgba(trim, 0.9);
    ctx.lineWidth = Math.max(1, w * 0.07);
    ctx.beginPath();
    ctx.arc(x, top + h * 0.38, w * 0.24, 0.5, TAU - 0.15);
    ctx.stroke();
    ctx.fillStyle = rgba(trim);
    ctx.beginPath();
    ctx.arc(x, top + h * 0.38, w * 0.06, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = rgba([20, 18, 16]);
  ctx.fillRect(x - w * 0.62, top - w * 0.08, w * 1.24, w * 0.12);
}

/** Ashlar masonry: a wall face with courses of stone, lit from one side. */
function masonry(ctx, x, y, w, h, base, s, seed) {
  const r = rng(seed);
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, rgba(mix(base, [0, 0, 0], 0.35)));
  g.addColorStop(0.5, rgba(base));
  g.addColorStop(1, rgba(mix(base, [0, 0, 0], 0.4)));
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  const course = 16 * s;
  ctx.strokeStyle = rgba([0, 0, 0], 0.32);
  ctx.lineWidth = Math.max(1, 1.2 * s);
  for (let yy = y + course, row = 0; yy < y + h; yy += course, row += 1) {
    ctx.beginPath();
    ctx.moveTo(x, yy);
    ctx.lineTo(x + w, yy);
    ctx.stroke();
    const off = row % 2 ? 0 : 18 * s;
    for (let xx = x + off; xx < x + w; xx += (30 + r() * 14) * s) {
      ctx.beginPath();
      ctx.moveTo(xx, yy - course);
      ctx.lineTo(xx, yy);
      ctx.stroke();
    }
  }
  ctx.fillStyle = rgba([255, 230, 190], 0.05);
  for (let i = 0; i < (w * h) / (900 * s * s); i += 1) ctx.fillRect(x + r() * w, y + r() * h, 3 * s, 1.5 * s);
}

function crenellations(ctx, x, y, w, size, color) {
  ctx.fillStyle = rgba(color);
  for (let xx = x; xx < x + w; xx += size * 2) ctx.fillRect(xx, y - size, size, size + 1);
}

function arch(ctx, x, base, w, h, color) {
  ctx.fillStyle = rgba(color);
  ctx.beginPath();
  ctx.moveTo(x - w / 2, base);
  ctx.lineTo(x - w / 2, base - h + w / 2);
  ctx.arc(x, base - h + w / 2, w / 2, Math.PI, TAU);
  ctx.lineTo(x + w / 2, base);
  ctx.closePath();
  ctx.fill();
}

/** A Syndicate walker: an armoured hull on two reverse-jointed legs, its cannon toward the ford. */
function walker(ctx, x, base, s, color, edge) {
  ctx.fillStyle = rgba(color);
  ctx.strokeStyle = rgba(color);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const sx of [-1, 1]) {
    const hip = [x + sx * 13 * s, base - 54 * s];
    const knee = [x + sx * 13 * s - 18 * s, base - 30 * s];
    const foot = [x + sx * 15 * s + 4 * s, base - 3 * s];
    ctx.lineWidth = 7 * s;
    ctx.beginPath();
    ctx.moveTo(hip[0], hip[1]);
    ctx.lineTo(knee[0], knee[1]);
    ctx.lineTo(foot[0], foot[1]);
    ctx.stroke();
    ctx.fillRect(foot[0] - 9 * s, foot[1] - 1 * s, 18 * s, 4 * s);
  }
  ctx.beginPath();
  ctx.moveTo(x - 34 * s, base - 80 * s);
  ctx.lineTo(x + 22 * s, base - 88 * s);
  ctx.lineTo(x + 36 * s, base - 70 * s);
  ctx.lineTo(x + 26 * s, base - 52 * s);
  ctx.lineTo(x - 30 * s, base - 50 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(x + 26 * s, base - 76 * s, 30 * s, 5 * s);
  ctx.fillRect(x - 20 * s, base - 96 * s, 4 * s, 12 * s);
  ctx.strokeStyle = rgba(edge, 0.8);
  ctx.lineWidth = 1.2 * s;
  ctx.beginPath();
  ctx.moveTo(x - 34 * s, base - 80 * s);
  ctx.lineTo(x + 22 * s, base - 88 * s);
  ctx.lineTo(x + 36 * s, base - 70 * s);
  ctx.stroke();
}

function standingStone(ctx, x, base, w, h, color, lean = 0, broken = false) {
  ctx.save();
  ctx.translate(x, base);
  ctx.rotate(lean);
  const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
  g.addColorStop(0, rgba(mix(color, [0, 0, 0], 0.4)));
  g.addColorStop(0.6, rgba(color));
  g.addColorStop(1, rgba(mix(color, [255, 255, 255], 0.08)));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-w / 2, 0);
  ctx.lineTo(-w * 0.42, -h * 0.92);
  if (broken) {
    ctx.lineTo(-w * 0.1, -h * 0.82);
    ctx.lineTo(w * 0.1, -h);
  } else ctx.quadraticCurveTo(0, -h * 1.06, w * 0.42, -h * 0.94);
  ctx.lineTo(w / 2, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ── stage painters (static; cached) ─────────────────────────────────────────────────────────

function paintCircle(ctx, L) {
  const { w, s, horizon, cx } = L;
  const r = rng(11);
  vgrad(ctx, 0, 0, w, horizon, [[0, hex('#03060c')], [1, hex('#0e1a2c')]]);
  stars(ctx, L, r, 70, horizon * 0.5);
  // the courtyard wall of the Citadel
  const top = horizon - 190 * s;
  masonry(ctx, 0, top, w, horizon - top + 4, hex('#232a37'), s, 3);
  crenellations(ctx, 0, top, w, 14 * s, hex('#1d232f'));
  for (const sx of [-1, 1]) arch(ctx, cx + sx * 150 * s, horizon + 2, 70 * s, 130 * s, hex('#06090f'));
  arch(ctx, cx, horizon + 2, 92 * s, 160 * s, hex('#05080d'));
  for (const sx of [-1, 1]) {
    banner(ctx, cx + sx * 62 * s, top + 26 * s, 34 * s, 104 * s, hex('#14264a'), hex('#e3c463'));
    banner(ctx, cx + sx * 238 * s, top + 26 * s, 30 * s, 92 * s, hex('#14264a'), hex('#c9a227'));
  }
  ground(ctx, L, hex('#2b2620'), hex('#0b0a0a'), hex('#e0a060'));
  perspectiveGrid(ctx, L, { rows: 11, cols: 9, color: hex('#000000'), alpha: 0.35, seed: 4 });
  groundRing(ctx, L, 150 * s, hex('#c9a227'), 0.35);
  groundRing(ctx, L, 240 * s, hex('#c9a227'), 0.22);
}

function paintYard(ctx, L) {
  const { w, s, horizon, cx } = L;
  const r = rng(12);
  vgrad(ctx, 0, 0, w, horizon, [[0, hex('#3a4a66')], [0.55, hex('#b98a6a')], [1, hex('#f2c98c')]]);
  glow(ctx, w * 0.78, horizon - 40 * s, 260 * s, hex('#ffe2a8'), 0.55, false);
  clouds(ctx, L, r, { y0: horizon * 0.2, y1: horizon * 0.7, count: 7, color: hex('#ffe9c4'), alpha: 0.3 });
  const top = horizon - 120 * s;
  masonry(ctx, 0, top, w, horizon - top + 4, hex('#6f5e52'), s, 5);
  crenellations(ctx, 0, top, w, 12 * s, hex('#5f5046'));
  for (const sx of [-1, 1]) banner(ctx, cx + sx * 120 * s, top + 16 * s, 30 * s, 84 * s, hex('#1b3159'), hex('#e3c463'));
  // weapon racks and a training post
  ctx.fillStyle = rgba(hex('#2e241c'));
  for (const sx of [-1, 1]) {
    const x = cx + sx * 205 * s;
    ctx.fillRect(x - 30 * s, horizon - 56 * s, 60 * s, 5 * s);
    ctx.fillRect(x - 28 * s, horizon - 56 * s, 4 * s, 56 * s);
    ctx.fillRect(x + 24 * s, horizon - 56 * s, 4 * s, 56 * s);
    for (let k = 0; k < 4; k += 1) ctx.fillRect(x - 18 * s + k * 12 * s, horizon - 74 * s, 2.5 * s, 70 * s);
  }
  ground(ctx, L, hex('#b08a62'), hex('#3b2b20'), hex('#ffe2a8'));
  ctx.fillStyle = rgba(hex('#5a4030'), 0.22);
  for (let i = 0; i < 160; i += 1) {
    const z = r();
    const y = rowY(L, z);
    ctx.fillRect(r() * w, y, (3 + z * 10) * s, (1 + z * 2) * s);
  }
  groundRing(ctx, L, 190 * s, hex('#ffffff'), 0.14);
}

function paintCheckpoint(ctx, L) {
  const { w, h, s, horizon, cx } = L;
  const r = rng(13);
  vgrad(ctx, 0, 0, w, horizon, [[0, hex('#24183a')], [0.45, hex('#7a3f4f')], [0.8, hex('#d9824e')], [1, hex('#f4b06a')]]);
  glow(ctx, w * 0.2, horizon - 18 * s, 300 * s, hex('#ffcf8a'), 0.5, false);
  ctx.fillStyle = rgba(hex('#ffe0a8'), 0.95);
  ctx.beginPath();
  ctx.arc(w * 0.2, horizon - 14 * s, 26 * s, Math.PI, TAU);
  ctx.fill();
  clouds(ctx, L, r, { y0: horizon * 0.15, y1: horizon * 0.75, count: 9, color: hex('#ffb47a'), alpha: 0.32 });
  ridge(ctx, w, h, { base: horizon - 30 * s, amp: 40 * s, step: 24 * s, seed: 7, color: hex('#5a3242'), alpha: 0.9 });
  ridge(ctx, w, h, { base: horizon - 6 * s, amp: 20 * s, step: 16 * s, seed: 8, color: hex('#3b2232') });
  // palisade, towers and the gate behind the fight
  const wallTop = horizon - 70 * s;
  ctx.fillStyle = rgba(hex('#2a1a1e'));
  for (let x = -10; x < w + 10; x += 9 * s) {
    const hh = 64 * s + (r() - 0.5) * 8 * s;
    ctx.beginPath();
    ctx.moveTo(x, horizon + 2);
    ctx.lineTo(x, horizon - hh);
    ctx.lineTo(x + 4.5 * s, horizon - hh - 6 * s);
    ctx.lineTo(x + 9 * s, horizon - hh);
    ctx.lineTo(x + 9 * s, horizon + 2);
    ctx.fill();
  }
  for (const sx of [-1, 1]) {
    const tx = cx + sx * 96 * s;
    ctx.fillStyle = rgba(hex('#24161a'));
    ctx.fillRect(tx - 26 * s, wallTop - 70 * s, 52 * s, 140 * s);
    ctx.beginPath();
    ctx.moveTo(tx - 34 * s, wallTop - 70 * s);
    ctx.lineTo(tx, wallTop - 108 * s);
    ctx.lineTo(tx + 34 * s, wallTop - 70 * s);
    ctx.fill();
    ctx.fillStyle = rgba(hex('#ffb35c'), 0.85);
    ctx.fillRect(tx - 6 * s, wallTop - 46 * s, 12 * s, 16 * s);
    banner(ctx, tx + sx * 34 * s, wallTop - 66 * s, 20 * s, 56 * s, hex('#1b3159'), hex('#e3c463'));
  }
  ctx.fillStyle = rgba(hex('#120b0d'));
  arch(ctx, cx, horizon + 2, 110 * s, 96 * s, hex('#140c0e'));
  // carts and tents along the road
  for (const [x, sc] of [[0.12, 1], [0.86, 1.1], [0.3, 0.7], [0.7, 0.7]]) {
    ctx.fillStyle = rgba(hex('#1c1216'));
    const bx = w * x;
    const by = horizon + 6 * s;
    ctx.beginPath();
    ctx.moveTo(bx - 26 * s * sc, by);
    ctx.lineTo(bx, by - 30 * s * sc);
    ctx.lineTo(bx + 26 * s * sc, by);
    ctx.fill();
  }
  ground(ctx, L, hex('#6e4636'), hex('#1a1012'), hex('#ffb879'));
  // the road: wet ruts reflecting the sky
  ctx.fillStyle = rgba(hex('#3c2628'), 0.85);
  ctx.beginPath();
  ctx.moveTo(cx - 30 * s, horizon);
  ctx.lineTo(cx + 30 * s, horizon);
  ctx.lineTo(cx + w * 0.55, h);
  ctx.lineTo(cx - w * 0.55, h);
  ctx.closePath();
  ctx.fill();
  for (let i = 0; i < 14; i += 1) {
    const z = 0.15 + r() * 0.85;
    const y = rowY(L, z);
    const x = cx + (r() - 0.5) * w * 0.9 * z;
    const pw = (20 + 60 * z) * s;
    const g = ctx.createLinearGradient(0, y - 3 * s, 0, y + 6 * s);
    g.addColorStop(0, rgba(hex('#f4a35e'), 0.45));
    g.addColorStop(1, rgba(hex('#7a3f4f'), 0.25));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, pw, pw * 0.12, 0, 0, TAU);
    ctx.fill();
  }
  haze(ctx, L, horizon, 30 * s, hex('#f4a35e'), 0.35);
}

function paintWilds(ctx, L) {
  const { w, h, s, horizon } = L;
  const r = rng(14);
  // deep navy overhead, a faint warm band at the horizon
  vgrad(ctx, 0, 0, w, horizon, [[0, hex('#070d18')], [0.5, hex('#16243a')], [0.86, hex('#3a4458')], [1, hex('#665e66')]]);
  stars(ctx, L, r, 60, horizon * 0.45);
  moon(ctx, w * 0.74, horizon * 0.28, 18 * s);
  // snow-capped peaks
  ridge(ctx, w, h, { base: horizon - 60 * s, amp: 90 * s, step: 30 * s, seed: 21, color: hex('#6c7690'), rough: 0.7, peaks: 0.2 });
  ridge(ctx, w, h, { base: horizon - 40 * s, amp: 60 * s, step: 22 * s, seed: 22, color: hex('#3f4a64'), rough: 0.6 });
  haze(ctx, L, horizon - 30 * s, 40 * s, hex('#8e98ac'), 0.26);
  // three depths of pine forest
  const layers = [
    { y: horizon - 4 * s, h0: 50, h1: 80, color: hex('#2b3a55'), snow: [hex('#c6d2e2'), 0.55], n: 26 },
    { y: horizon + 6 * s, h0: 80, h1: 130, color: hex('#1b2740'), snow: [hex('#d9e2ee'), 0.7], n: 16 },
  ];
  for (const layer of layers) {
    for (let i = 0; i < layer.n; i += 1) {
      const x = (i / layer.n) * w + (r() - 0.5) * 30 * s;
      if (Math.abs(x - L.cx) < 70 * s && layer.h0 > 60) continue; // keep the foe's silhouette clear
      pine(ctx, x, layer.y, lerp(layer.h0, layer.h1, r()) * s, layer.color, layer.snow);
    }
  }
  // the snow floor sits a step below the sky light so a dark-furred warg reads against it
  ground(ctx, L, hex('#7e899e'), hex('#2c3448'), hex('#c9d2e0'));
  // drifts and tracks
  ctx.fillStyle = rgba(hex('#dfe5ee'), 0.24);
  for (let i = 0; i < 12; i += 1) {
    const z = r();
    const y = rowY(L, 0.05 + z * 0.9);
    ctx.beginPath();
    ctx.ellipse(r() * w, y, (40 + 120 * z) * s, (4 + 10 * z) * s, 0, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = rgba(hex('#2e3a52'), 0.35);
  for (let i = 0; i < 18; i += 1) {
    const z = 0.2 + (i / 18) * 0.8;
    const y = rowY(L, z);
    const x = L.cx + 40 * s * Math.sin(i * 1.7) + (i % 2 ? 12 : -12) * s * z;
    ctx.beginPath();
    ctx.ellipse(x, y, 5 * s * z + 1, 2.4 * s * z + 0.6, 0, 0, TAU);
    ctx.fill();
  }
  // near trees framing the clearing
  for (const sx of [-1, 1]) pine(ctx, L.cx + sx * (L.w * 0.5 + 10 * s), h * 0.98, 330 * s, hex('#0d1424'), [hex('#cfd9e8'), 0.5]);
}

function paintRuin(ctx, L) {
  const { w, h, s, horizon, cx } = L;
  const r = rng(15);
  vgrad(ctx, 0, 0, w, horizon, [[0, hex('#05060f')], [0.7, hex('#1a1a35')], [1, hex('#2c2a46')]]);
  stars(ctx, L, r, 160, horizon * 0.9);
  // faint lattice threads across the sky: the world's weave, glimpsed
  ctx.strokeStyle = rgba(hex('#e3c463'), 0.07);
  ctx.lineWidth = Math.max(1, s);
  for (let i = 0; i < 9; i += 1) {
    ctx.beginPath();
    const y0 = r() * horizon * 0.7;
    ctx.moveTo(-10, y0);
    ctx.bezierCurveTo(w * 0.3, y0 + (r() - 0.5) * 80 * s, w * 0.7, y0 + (r() - 0.5) * 80 * s, w + 10, y0 + (r() - 0.5) * 60 * s);
    ctx.stroke();
  }
  ridge(ctx, w, h, { base: horizon - 16 * s, amp: 34 * s, step: 26 * s, seed: 31, color: hex('#141428') });
  // the ring of standing stones
  const stones = [-260, -190, -128, 128, 190, 260];
  for (const [i, dx] of stones.entries()) {
    const hh = (70 + r() * 50) * s;
    standingStone(ctx, cx + dx * s, horizon + 6 * s, (22 + r() * 10) * s, hh, hex('#3a3a52'), (r() - 0.5) * 0.12, i % 3 === 1);
  }
  // the great stone behind the fight (its symbol glows in the animated pass)
  standingStone(ctx, cx, horizon + 8 * s, 74 * s, 200 * s, hex('#46465f'));
  ground(ctx, L, hex('#2d2c40'), hex('#0a0a13'), hex('#7e7aa8'));
  ctx.fillStyle = rgba(hex('#1d1c2c'), 0.6);
  for (let i = 0; i < 90; i += 1) {
    const z = r();
    const y = rowY(L, z);
    ctx.beginPath();
    ctx.ellipse(r() * w, y, (2 + 14 * z) * s, (1 + 4 * z) * s, 0, 0, TAU);
    ctx.fill();
  }
  groundRing(ctx, L, 200 * s, hex('#e3c463'), 0.12, 1.5);
  haze(ctx, L, horizon + 10 * s, 40 * s, hex('#6b6896'), 0.3);
}

function paintFord(ctx, L, winter = false) {
  const { w, h, s, horizon, cx } = L;
  const r = rng(winter ? 17 : 16);
  if (winter) vgrad(ctx, 0, 0, w, horizon, [[0, hex('#2a2d40')], [0.6, hex('#7b6a72')], [1, hex('#d29a78')]]);
  else vgrad(ctx, 0, 0, w, horizon, [[0, hex('#040810')], [0.65, hex('#121e33')], [1, hex('#26324a')]]);
  if (!winter) {
    stars(ctx, L, r, 80, horizon * 0.6);
    moon(ctx, w * 0.22, horizon * 0.3, 16 * s);
  } else glow(ctx, w * 0.75, horizon - 10 * s, 260 * s, hex('#ffc89a'), 0.4, false);
  clouds(ctx, L, r, { y0: horizon * 0.2, y1: horizon * 0.8, count: 6, color: winter ? hex('#e8c0a8') : hex('#41506e'), alpha: 0.35 });
  // the far bank: hills, the depot, the walker
  ridge(ctx, w, h, { base: horizon - 22 * s, amp: 26 * s, step: 20 * s, seed: 41, color: winter ? hex('#4d4a5a') : hex('#101826') });
  const dx = w * 0.72;
  ctx.fillStyle = rgba(winter ? hex('#3a3442') : hex('#0b1019'));
  ctx.fillRect(dx - 40 * s, horizon - 34 * s, 80 * s, 30 * s);
  ctx.fillRect(dx - 24 * s, horizon - 52 * s, 16 * s, 20 * s);
  walker(ctx, w * 0.3, horizon - 2 * s, s, winter ? hex('#2c2834') : hex('#070b12'), winter ? hex('#4a4250') : hex('#1a2232'));
  // the river
  const riverTop = horizon;
  const riverBot = rowY(L, 0.42);
  vgrad(ctx, 0, riverTop, w, riverBot - riverTop, winter
    ? [[0, hex('#c9a49a')], [1, hex('#3d4458')]]
    : [[0, hex('#24324a')], [1, hex('#0a111d')]]);
  // reflections of the sky light
  const refX = winter ? w * 0.75 : w * 0.22;
  for (let i = 0; i < 26; i += 1) {
    const z = i / 26;
    const y = lerp(riverTop, riverBot, z);
    const len = (10 + 40 * z) * s * (0.5 + r());
    ctx.fillStyle = rgba(winter ? hex('#ffd9b0') : hex('#f2eedf'), 0.5 * (1 - z) + 0.1);
    ctx.fillRect(refX - len / 2 + (r() - 0.5) * 12 * s, y, len, Math.max(1, 1.4 * s));
  }
  if (winter) {
    ctx.fillStyle = rgba(hex('#eef2f8'), 0.75);
    for (let i = 0; i < 16; i += 1) {
      const y = lerp(riverTop, riverBot, r());
      ctx.beginPath();
      ctx.ellipse(r() * w, y, (12 + r() * 30) * s, (2 + r() * 3) * s, 0, 0, TAU);
      ctx.fill();
    }
  }
  // the near bank where the duel stands: gravel shallows
  const near = winter ? [hex('#69687a'), hex('#22222e')] : [hex('#2a3448'), hex('#080b12')];
  vgrad(ctx, 0, riverBot, w, h - riverBot, [[0, near[0]], [1, near[1]]]);
  ctx.fillStyle = rgba(winter ? hex('#e4e8ee') : hex('#5a6a86'), winter ? 0.26 : 0.25);
  for (let i = 0; i < 120; i += 1) {
    const z = 0.42 + r() * 0.58;
    ctx.beginPath();
    ctx.ellipse(r() * w, rowY(L, z), (1 + 5 * z) * s, (0.6 + 2 * z) * s, 0, 0, TAU);
    ctx.fill();
  }
  // Aegis pylons on the Elvian bank, framing the fight
  for (const sx of [-1, 1]) {
    const px = cx + sx * L.w * 0.42;
    const base = rowY(L, 0.55);
    ctx.fillStyle = rgba(hex('#1a1d26'));
    ctx.beginPath();
    ctx.moveTo(px - 12 * s, base);
    ctx.lineTo(px - 5 * s, base - 150 * s);
    ctx.lineTo(px + 5 * s, base - 150 * s);
    ctx.lineTo(px + 12 * s, base);
    ctx.fill();
    ctx.fillStyle = rgba(hex('#c9a227'));
    ctx.fillRect(px - 8 * s, base - 120 * s, 16 * s, 4 * s);
    ctx.fillRect(px - 6 * s, base - 80 * s, 12 * s, 3 * s);
  }
  haze(ctx, L, riverTop + 6 * s, 26 * s, winter ? hex('#ead2c4') : hex('#53627e'), 0.45);
}

function paintSiege(ctx, L) {
  const { w, s, horizon, cx } = L;
  const r = rng(18);
  vgrad(ctx, 0, 0, w, horizon, [[0, hex('#0b0507')], [0.55, hex('#3b1410')], [1, hex('#a5401c')]]);
  // smoke banks lit from below
  clouds(ctx, L, r, { y0: horizon * 0.1, y1: horizon * 0.85, count: 12, color: hex('#4a2620'), alpha: 0.55 });
  // the walls of the Marches fortress
  const top = horizon - 120 * s;
  masonry(ctx, 0, top, w, horizon - top + 4, hex('#2a1c1a'), s, 9);
  crenellations(ctx, 0, top, w, 12 * s, hex('#1e1412'));
  for (const sx of [-1, 1]) {
    const tx = cx + sx * 170 * s;
    masonry(ctx, tx - 40 * s, top - 70 * s, 80 * s, 72 * s, hex('#2f201d'), s, 10);
    crenellations(ctx, tx - 40 * s, top - 70 * s, 80 * s, 10 * s, hex('#22171a'));
  }
  // breaches and siege towers
  ctx.fillStyle = rgba(hex('#0d0708'));
  for (const x of [0.08, 0.92]) {
    ctx.beginPath();
    ctx.moveTo(w * x - 26 * s, horizon);
    ctx.lineTo(w * x - 18 * s, horizon - 150 * s);
    ctx.lineTo(w * x + 18 * s, horizon - 160 * s);
    ctx.lineTo(w * x + 26 * s, horizon);
    ctx.fill();
  }
  banner(ctx, cx, top + 10 * s, 36 * s, 96 * s, hex('#14264a'), hex('#e3c463'));
  ground(ctx, L, hex('#4b2c22'), hex('#0c0606'), hex('#ff8a4a'));
  perspectiveGrid(ctx, L, { rows: 10, cols: 8, color: hex('#000000'), alpha: 0.3, seed: 6, jitter: 4 });
  // debris
  ctx.fillStyle = rgba(hex('#1a0d0b'), 0.85);
  for (let i = 0; i < 26; i += 1) {
    const z = r();
    const y = rowY(L, z);
    const sz = (4 + 18 * z) * s;
    ctx.save();
    ctx.translate(r() * w, y);
    ctx.rotate(r() * TAU);
    ctx.fillRect(-sz / 2, -sz / 6, sz, sz / 3);
    ctx.restore();
  }
}

// ── animated passes (every frame) ───────────────────────────────────────────────────────────

const FLAME_HALO = hex('#ff9c48');

function flame(ctx, x, y, size, t, seed, motion) {
  const f = motion ? 0.82 + 0.18 * Math.sin(t * 11 + seed) * Math.sin(t * 5.3 + seed * 2) : 1;
  // the wide halo is baked into the backdrop (LIGHTS); this is the flicker close to the fire
  glow(ctx, x, y - size * 0.6, size * 2.6 * f, FLAME_HALO, 0.3);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const [k, col, a] of [[1, hex('#e0782b'), 0.9], [0.62, hex('#ffc46b'), 0.95], [0.32, hex('#fff2c8'), 1]]) {
    const hh = size * 2.2 * k * f;
    const ww = size * 0.9 * k;
    const sway = motion ? Math.sin(t * 7 + seed) * ww * 0.25 : 0;
    ctx.fillStyle = rgba(col, a);
    ctx.beginPath();
    ctx.moveTo(x - ww, y);
    ctx.quadraticCurveTo(x - ww * 0.9, y - hh * 0.55, x + sway, y - hh);
    ctx.quadraticCurveTo(x + ww * 0.9, y - hh * 0.55, x + ww, y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function brazierStand(ctx, L, x, y) {
  const { s } = L;
  ctx.fillStyle = rgba(hex('#15110d'));
  ctx.fillRect(x - 3 * s, y, 6 * s, 70 * s);
  ctx.beginPath();
  ctx.moveTo(x - 20 * s, y - 4 * s);
  ctx.lineTo(x + 20 * s, y - 4 * s);
  ctx.lineTo(x + 12 * s, y + 10 * s);
  ctx.lineTo(x - 12 * s, y + 10 * s);
  ctx.fill();
  ctx.fillStyle = rgba(hex('#7d6114'));
  ctx.fillRect(x - 21 * s, y - 6 * s, 42 * s, 3 * s);
}

/** The wide halo of a fire (baked: it barely changes and it is the costly part). */
function halo(ctx, x, y, size) {
  glow(ctx, x, y - size * 0.6, size * 7, FLAME_HALO, 0.3);
}

const SIEGE_FIRES = [[0.08, 16, 1], [0.92, 18, 2], [0.32, 9, 3], [0.68, 10, 4], [0.5, 7, 5]];
const fireY = (L, x) => L.horizon - (x === 0.08 || x === 0.92 ? 150 : 120) * L.s;

// ── static light, baked into the backdrop on resize ──────────────────────────────────────────
// Big soft glows cost the most to draw and barely move, so they live in the backdrop; the
// animated pass only adds what flickers.

const LIGHTS = {
  circle(ctx, L) {
    for (const sx of [-1, 1]) {
      brazierStand(ctx, L, L.cx + sx * L.w * 0.4, L.horizon - 30 * L.s);
      halo(ctx, L.cx + sx * L.w * 0.4, L.horizon - 34 * L.s, 12 * L.s);
    }
    glow(ctx, L.cx, L.horizon - 60 * L.s, 120 * L.s, hex('#ffb070'), 0.09);
  },
  yard(ctx, L) {
    // shafts of morning light
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i += 1) {
      const x0 = L.w * (0.55 + i * 0.12);
      const g = ctx.createLinearGradient(x0, 0, x0 - L.w * 0.4, L.h);
      g.addColorStop(0, rgba(hex('#ffe9c0'), 0.055));
      g.addColorStop(1, rgba(hex('#ffe9c0'), 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x0, 0);
      ctx.lineTo(x0 + 30 * L.s, 0);
      ctx.lineTo(x0 - L.w * 0.35, L.h);
      ctx.lineTo(x0 - L.w * 0.45, L.h);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  },
  checkpoint(ctx, L) {
    for (const sx of [-1, 1]) halo(ctx, L.cx + sx * 64 * L.s, L.horizon - 4 * L.s, 5 * L.s);
  },
  wilds(ctx, L) {
    glow(ctx, L.cx, L.floorY - 120 * L.s, 220 * L.s, hex('#a9c2e0'), 0.05);
  },
  ruin(ctx, L, opts) {
    if (!opts?.noSymbol) glow(ctx, L.cx, L.horizon - 120 * L.s, 110 * L.s, hex('#ffd98a'), 0.16);
  },
  ford(ctx, L) {
    const { s, w, horizon } = L;
    halo(ctx, w * 0.72, horizon - 30 * s, 9 * s);
    glow(ctx, w * 0.72, horizon - 30 * s, 160 * s, hex('#ff8a40'), 0.16);
    for (const sx of [-1, 1]) glow(ctx, L.cx + sx * L.w * 0.42, rowY(L, 0.55) - 120 * s, 40 * s, hex('#ffd98a'), 0.45);
  },
  ford_winter(ctx, L) {
    LIGHTS.ford(ctx, L);
  },
  siege(ctx, L) {
    for (const [x, sz] of SIEGE_FIRES) halo(ctx, L.w * x, fireY(L, x), sz * L.s);
    glow(ctx, L.cx, L.horizon, L.w * 0.7, hex('#ff6a2a'), 0.13);
  },
};

const ANIMATE = {
  circle(ctx, L, t, motion) {
    for (const sx of [-1, 1]) flame(ctx, L.cx + sx * L.w * 0.4, L.horizon - 34 * L.s, 12 * L.s, t, sx + 3, motion);
  },
  yard() {},
  checkpoint(ctx, L, t, motion) {
    const { s, cx, horizon } = L;
    for (const sx of [-1, 1]) flame(ctx, cx + sx * 64 * s, horizon - 4 * s, 5 * s, t, sx, motion);
    // smoke from the camp fires
    if (motion) {
      ctx.save();
      for (let i = 0; i < 2; i += 1) {
        const x0 = L.w * (0.3 + i * 0.42);
        for (let k = 0; k < 4; k += 1) {
          const p = ((t * 0.08 + k / 4 + i * 0.3) % 1);
          glow(ctx, x0 + Math.sin(p * 6 + i) * 14 * s + p * 30 * s, horizon - p * 140 * s, (10 + p * 34) * s, hex('#4a3038'), 0.25 * (1 - p), false);
        }
      }
      ctx.restore();
    }
  },
  wilds() {},
  ruin(ctx, L, t, motion, opts) {
    if (opts?.noSymbol) return;
    const { s, cx, horizon } = L;
    const pulse = motion ? 0.6 + 0.4 * Math.sin(t * 1.6) : 0.8;
    const y = horizon - 120 * s;
    glow(ctx, cx, y, 56 * s * (0.8 + 0.2 * pulse), hex('#ffd98a'), 0.3 * pulse);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(hex('#ffe9ae'), 0.55 + 0.45 * pulse);
    ctx.lineWidth = 4 * s;
    ctx.beginPath();
    ctx.arc(cx, y, 22 * s, -0.75, TAU - 1.45);
    ctx.stroke();
    ctx.fillStyle = rgba(hex('#fff4d6'), 0.6 + 0.4 * pulse);
    ctx.beginPath();
    ctx.moveTo(cx, y - 9 * s);
    ctx.lineTo(cx + 3 * s, y);
    ctx.lineTo(cx, y + 9 * s);
    ctx.lineTo(cx - 3 * s, y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  },
  ford(ctx, L, t, motion) {
    const { s, w, horizon } = L;
    // walker lamps and a sweeping searchlight
    const wx = w * 0.3 + 22 * s;
    const wy = horizon - 74 * s;
    const blink = motion ? 0.7 + 0.3 * Math.sin(t * 3) : 1;
    glow(ctx, wx + 12 * s, wy, 26 * s, hex('#ffb347'), 0.6 * blink);
    ctx.fillStyle = rgba(hex('#ffd59a'), 0.9 * blink);
    ctx.fillRect(wx + 4 * s, wy - 1.5 * s, 10 * s, 3 * s);
    if (motion) {
      const ang = 0.5 + Math.sin(t * 0.35) * 0.45;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createLinearGradient(wx, wy, wx + Math.cos(ang) * 400 * s, wy + Math.sin(ang) * 400 * s);
      g.addColorStop(0, rgba(hex('#ffd59a'), 0.18));
      g.addColorStop(1, rgba(hex('#ffd59a'), 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(wx + 12 * s, wy);
      ctx.lineTo(wx + Math.cos(ang - 0.08) * 420 * s, wy + Math.sin(ang - 0.08) * 420 * s);
      ctx.lineTo(wx + Math.cos(ang + 0.08) * 420 * s, wy + Math.sin(ang + 0.08) * 420 * s);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    // the burning depot (its glow and the Aegis pylon lights are baked)
    flame(ctx, w * 0.72, horizon - 30 * s, 9 * s, t, 5, motion);
    // ripples
    if (motion) {
      ctx.strokeStyle = rgba(hex('#c9d4e6'), 0.12);
      ctx.lineWidth = Math.max(1, s);
      for (let i = 0; i < 8; i += 1) {
        const z = ((t * 0.05 + i / 8) % 1);
        const y = lerp(horizon + 4 * s, rowY(L, 0.42), z);
        ctx.beginPath();
        ctx.moveTo(0, y);
        for (let x = 0; x <= w; x += 20 * s) ctx.lineTo(x, y + Math.sin(x * 0.03 + t * 2 + i) * 1.5 * s * (0.3 + z));
        ctx.stroke();
      }
    }
  },
  ford_winter(ctx, L, t, motion) {
    ANIMATE.ford(ctx, L, t, motion);
  },
  siege(ctx, L, t, motion) {
    for (const [x, sz, seed] of SIEGE_FIRES) flame(ctx, L.w * x, fireY(L, x), sz * L.s, t, seed, motion);
  },
};

// ── the stages ──────────────────────────────────────────────────────────────────────────────

// light: what falls on the foe. key = main light colour and side (+1 right), rim = edge light,
// shadow = the colour shadows fall toward, back = the glow behind the foe so it reads at night.
export const STAGES = {
  circle: {
    label: 'The torch-lit circle',
    paint: paintCircle,
    light: { key: hex('#ffc890'), side: -1, rim: hex('#ffd29a'), shadow: hex('#0a0d16'), back: hex('#ffb070') },
    particles: [{ kind: 'embers', count: 26 }, { kind: 'motes', count: 30 }],
  },
  yard: {
    label: 'The training yard',
    paint: paintYard,
    light: { key: hex('#ffe2b0'), side: 1, rim: hex('#fff1d0'), shadow: hex('#3a3040'), back: hex('#ffe6b8') },
    particles: [{ kind: 'dust', count: 46 }],
  },
  checkpoint: {
    label: 'The Greywater checkpoint at dusk',
    paint: paintCheckpoint,
    light: { key: hex('#ffb070'), side: -1, rim: hex('#ffc98a'), shadow: hex('#24162a'), back: hex('#f4a35e') },
    particles: [{ kind: 'dust', count: 30 }, { kind: 'embers', count: 10 }],
  },
  wilds: {
    label: 'The frontier wilds',
    paint: paintWilds,
    light: { key: hex('#c8d6ec'), side: 1, rim: hex('#eef4ff'), shadow: hex('#141c30'), back: hex('#9db2d2') },
    particles: [{ kind: 'snow', count: 90 }],
  },
  ruin: {
    label: 'The broken circle',
    paint: paintRuin,
    light: { key: hex('#b8b0e0'), side: 1, rim: hex('#ffe9ae'), shadow: hex('#0c0a18'), back: hex('#ffd98a') },
    particles: [{ kind: 'lattice', count: 40 }, { kind: 'mist', count: 6 }],
  },
  ford: {
    label: 'Greywater Ford',
    paint: (ctx, L) => paintFord(ctx, L, false),
    light: { key: hex('#aebfd8'), side: -1, rim: hex('#ffc98a'), shadow: hex('#070b14'), back: hex('#8ea2c4') },
    particles: [{ kind: 'mist', count: 7 }, { kind: 'embers', count: 12 }],
  },
  ford_winter: {
    label: 'Greywater Ford in winter',
    paint: (ctx, L) => paintFord(ctx, L, true),
    light: { key: hex('#ffd2b0'), side: 1, rim: hex('#fff0e0'), shadow: hex('#2a2838'), back: hex('#e8c0a8') },
    particles: [{ kind: 'snow', count: 80 }, { kind: 'mist', count: 4 }],
  },
  siege: {
    label: 'The Siege of the Marches',
    paint: paintSiege,
    light: { key: hex('#ff9a5a'), side: 1, rim: hex('#ffc070'), shadow: hex('#140606'), back: hex('#ff7a3a') },
    particles: [{ kind: 'embers', count: 70 }, { kind: 'ash', count: 30 }],
  },
};

/** Paint a stage's static backdrop with its baked lights (opts.noSymbol: no glow for the ruin's symbol). */
export function paintStage(ctx, L, stageId, opts = {}) {
  const id = STAGES[stageId] ? stageId : 'circle';
  STAGES[id].paint(ctx, L);
  LIGHTS[id]?.(ctx, L, opts);
}

/** opts.noSymbol: leave the ruin's glowing symbol out (the title screen draws its own). */
export function animateStage(ctx, L, stageId, t, motion, opts) {
  ANIMATE[stageId]?.(ctx, L, t, motion, opts);
}

// ── atmosphere ──────────────────────────────────────────────────────────────────────────────

const PARTICLE = {
  snow: (r, L) => ({ x: r() * L.w, y: r() * L.h, z: 0.3 + r() * 0.7, vx: (r() - 0.5) * 12, vy: 20 + r() * 40, c: hex('#f2f6fc'), a: 0.75 }),
  embers: (r, L) => ({ x: r() * L.w, y: L.h * (0.4 + r() * 0.6), z: 0.3 + r() * 0.7, vx: (r() - 0.5) * 16, vy: -(18 + r() * 40), c: r() < 0.5 ? hex('#ffb347') : hex('#ff7a2a'), a: 0.9, add: true }),
  ash: (r, L) => ({ x: r() * L.w, y: r() * L.h, z: 0.4 + r() * 0.6, vx: 10 + r() * 14, vy: 8 + r() * 14, c: hex('#5a4a48'), a: 0.55 }),
  motes: (r, L) => ({ x: r() * L.w, y: L.h * (0.2 + r() * 0.6), z: 0.2 + r() * 0.5, vx: (r() - 0.5) * 6, vy: -(2 + r() * 6), c: hex('#ffe2b0'), a: 0.6, add: true }),
  dust: (r, L) => ({ x: r() * L.w, y: L.h * (0.15 + r() * 0.75), z: 0.2 + r() * 0.6, vx: 4 + r() * 8, vy: (r() - 0.5) * 4, c: hex('#fff0d0'), a: 0.45, add: true }),
  lattice: (r, L) => ({ x: L.cx + (r() - 0.5) * L.w * 0.8, y: L.h * (0.3 + r() * 0.5), z: 0.3 + r() * 0.6, vx: (r() - 0.5) * 4, vy: -(6 + r() * 10), c: hex('#ffe9ae'), a: 0.8, add: true }),
  mist: (r, L) => ({ x: r() * L.w, y: lerp(L.horizon, L.h * 0.8, r()), z: 1, vx: 6 + r() * 10, vy: 0, c: hex('#8e9ab4'), a: 0.12, big: true }),
};

/** `density` (0..1) thins the particles on slow devices (the renderer's quality tier). */
export function createAtmosphere(stageId, L, density = 1) {
  const stage = STAGES[stageId] ?? STAGES.circle;
  const r = rng(97);
  const list = [];
  for (const spec of stage.particles) {
    const n = spec.kind === 'mist' ? spec.count : Math.max(1, Math.round(spec.count * density));
    for (let i = 0; i < n; i += 1) {
      const p = { kind: spec.kind, ...PARTICLE[spec.kind](r, L), ph: r() * TAU };
      p.fill = rgba(p.c);
      list.push(p);
    }
  }
  // mist first, then plain specks, then the additive ones in a single pass
  const order = (p) => (p.big ? 0 : p.add ? 2 : 1);
  list.sort((a, b) => order(a) - order(b));
  return list;
}

const MIST = new Map();
/** A soft horizontal bank of mist, pre-rendered once per colour (a fraction of a glow's cost). */
function mistSprite(c) {
  const key = c.join(',');
  if (MIST.has(key)) return MIST.get(key);
  const cv = document.createElement('canvas');
  cv.width = 128;
  cv.height = 48;
  const m = cv.getContext('2d');
  m.translate(64, 24);
  m.scale(1, 0.375);
  const g = m.createRadialGradient(0, 0, 0, 0, 0, 64);
  g.addColorStop(0, rgba(c, 1));
  g.addColorStop(0.45, rgba(c, 0.45));
  g.addColorStop(1, rgba(c, 0));
  m.fillStyle = g;
  m.fillRect(-64, -64, 128, 128);
  MIST.set(key, cv);
  return cv;
}

export function drawAtmosphere(ctx, L, list, dtMs, t, motion) {
  const dt = Math.min(0.05, dtMs / 1000);
  const { s, w, h } = L;
  ctx.save();
  let add = false;
  for (const p of list) {
    if (motion) {
      p.x += (p.vx + (p.kind === 'snow' ? Math.sin(t * 1.3 + p.ph) * 14 : 0)) * dt * p.z * s;
      p.y += p.vy * dt * p.z * s;
      if (p.y > h + 10) p.y = -10;
      if (p.y < -10) p.y = h + 10;
      if (p.x > w + 60) p.x = -60;
      if (p.x < -60) p.x = w + 60;
    }
    if (p.big) {
      // a low bank of mist drifting across the ground
      ctx.globalAlpha = p.a * 1.5;
      ctx.drawImage(mistSprite(p.c), p.x - 170 * s, p.y - 46 * s, 340 * s, 92 * s);
      continue;
    }
    if (p.add && !add) {
      add = true;
      ctx.globalCompositeOperation = 'lighter';
    }
    const flick = p.kind === 'embers' || p.kind === 'lattice' ? 0.5 + 0.5 * Math.sin(t * 6 + p.ph) : 1;
    ctx.globalAlpha = p.a * flick * clamp01(p.z + 0.2);
    const rad = (p.kind === 'snow' ? 1.6 : p.kind === 'ash' ? 1.4 : 1.1) * (0.6 + p.z) * s;
    ctx.fillStyle = p.fill;
    ctx.beginPath();
    ctx.arc(p.x, p.y, rad, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

export { rowY };
