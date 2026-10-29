// The foes, drawn facing you: duelists, officers, a scout in a grey coat, a sword-master, a
// warlord, the spectral echo of a crowned sovereign, and the Frost Wargs. Everything is in
// "s-units" around the foe's feet (y up is negative), lit by the stage's key and rim light.
// Poses come straight from the engine's state, so what you see is what the engine will do.

import { TAU, clamp01, easeInOut, easeOut, glow, hashStr, hex, lerp, mix, rgba, rng } from './util.js';

// ── looks ───────────────────────────────────────────────────────────────────────────────────

const LOOKS = {
  duelist: {
    kind: 'human', coat: hex('#2b2e36'), armor: hex('#626976'), trim: hex('#c09048'), accent: hex('#8a2f25'),
    head: 'visor', glowC: hex('#ffb347'), weapon: 'sabre', offhand: 'dagger', pauldrons: true, skirt: 0.85, trousers: hex('#23252c'),
  },
  pilot: {
    kind: 'human', coat: hex('#4a3a2a'), armor: hex('#565b64'), trim: hex('#c9a227'), accent: hex('#8a2f25'),
    skin: hex('#c89878'), hair: hex('#2a1d16'), head: 'pilot', weapon: 'shock', pauldrons: false, skirt: 0.22, trousers: hex('#3a3f48'),
  },
  officer: {
    kind: 'human', coat: hex('#3c2626'), armor: hex('#5d5f68'), trim: hex('#d6a94a'), accent: hex('#8a2f25'),
    skin: hex('#d0a283'), hair: hex('#1e1612'), head: 'officer', weapon: 'sabre', offhand: 'dagger', pauldrons: true, cape: hex('#2a1515'), skirt: 0.7, trousers: hex('#22191a'),
    hemTrim: true, glove: hex('#1c1614'),
  },
  scout: {
    kind: 'human', coat: hex('#5b5d63'), armor: hex('#3d4048'), trim: hex('#7d7f86'), accent: hex('#3a3c42'),
    head: 'hood', glowC: hex('#ffcf8a'), weapon: 'short', offhand: 'dagger', pauldrons: false, scarf: hex('#6b4a3a'), skirt: 0.95, trousers: hex('#2e2a28'),
  },
  master: {
    kind: 'human', coat: hex('#24304a'), armor: hex('#4a5266'), trim: hex('#d6b47a'), accent: hex('#d6b47a'),
    skin: hex('#d2a688'), hair: hex('#cfcac2'), head: 'master', weapon: 'rapier', pauldrons: false, skirt: 1.42, tails: true, hemTrim: true, trousers: hex('#1d2232'),
    glove: hex('#e8dfc8'),
  },
  warlord: {
    kind: 'human', coat: hex('#2e1513'), armor: hex('#565052'), trim: hex('#c08a3a'), accent: hex('#8a2f25'),
    head: 'greathelm', glowC: hex('#ff8a3a'), weapon: 'greatsword', pauldrons: true, cape: hex('#3b1210'), build: 1.08, skirt: 0.75, trousers: hex('#2a2224'),
  },
  // the echo: pale, desaturated gold and moon-violet, drawn translucent; the warm gold is kept
  // for its crown, its eyes and the edge of its blade (the focal pass)
  echo: {
    kind: 'human', coat: hex('#4d4868'), armor: hex('#a9a28c'), trim: hex('#d8cba8'), accent: hex('#8f88b0'),
    skin: hex('#d6d0c2'), head: 'crown', glowC: hex('#fffaf0'), weapon: 'spectral', pauldrons: true, cape: hex('#5c5680'), spectral: true, skirt: 1.05,
    trousers: hex('#38344e'), glove: hex('#6e6888'), boots: hex('#3a3650'),
  },
  frost: { kind: 'warg', fur: hex('#56657a'), dark: hex('#2a3342'), light: hex('#cfdbe6'), eye: hex('#e6f0fa'), size: 1 },
  greymane: { kind: 'warg', fur: hex('#6d6862'), dark: hex('#36322e'), light: hex('#e2ddd4'), eye: hex('#ffcf7a'), size: 0.94, old: true },
  rime: { kind: 'warg', fur: hex('#3c4554'), dark: hex('#1b212b'), light: hex('#b8c6d6'), eye: hex('#eef4ff'), size: 1.06 },
};

/** Pick a look from the duel config: who this is, not just what archetype it fights like. */
export function lookFor(config, archetypeId) {
  const name = `${config?.title ?? ''} ${config?.modifiers?.champion?.name ?? ''}`;
  if (archetypeId === 'warg_alpha') {
    if (/greymane/i.test(name)) return LOOKS.greymane;
    if (/old rime/i.test(name)) return LOOKS.rime;
    return LOOKS.frost;
  }
  if (archetypeId === 'fallen_champion') return LOOKS.echo;
  if (/nyra/i.test(name)) return LOOKS.pilot;
  if (/ostrava/i.test(name)) return LOOKS.officer;
  if (/grey coat/i.test(name)) return LOOKS.scout;
  if (/ilvane/i.test(name)) return LOOKS.master;
  if (/drae/i.test(name)) return LOOKS.warlord;
  return LOOKS.duelist;
}

// ── lighting ────────────────────────────────────────────────────────────────────────────────

// Gradients are cached per context and light: most parts span the same x range every frame, and
// building a gradient costs more than filling with one (the cache is dropped when it grows, as
// pose-dependent parts add a few new keys each frame).
const SHADES = new WeakMap();

/** A horizontal gradient across a part: shadow side, base, key-lit, a rim of edge light. */
function shade(ctx, x0, x1, base, light, rimK = 0.7) {
  let byLight = SHADES.get(ctx);
  if (!byLight) SHADES.set(ctx, (byLight = new WeakMap()));
  let cache = byLight.get(light);
  if (!cache || cache.size > 600) byLight.set(light, (cache = new Map()));
  const key = `${Math.round(x0 * 4)}|${Math.round(x1 * 4)}|${base[0]},${base[1]},${base[2]}|${rimK}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const g = shadeGradient(ctx, x0, x1, base, light, rimK);
  cache.set(key, g);
  return g;
}

function shadeGradient(ctx, x0, x1, base, light, rimK) {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  const dark = mix(base, light.shadow, 0.55);
  const keyLit = mix(base, light.key, 0.28);
  // the edge light is the stage's key and rim mixed, and kept soft: a warm lift, not an outline
  const rim = mix(base, mix(light.key, light.rim, 0.5), rimK * 0.6);
  const stops = [
    [0, dark],
    [0.5, base],
    [0.84, keyLit],
    [0.96, rim],
    [1, keyLit],
  ];
  for (const [t, c] of stops) g.addColorStop(light.side > 0 ? t : 1 - t, rgba(c));
  return g;
}

// ── geometry helpers ────────────────────────────────────────────────────────────────────────

/** A tapered limb through points with matching widths (quad strip with round joints). */
function limb(ctx, pts, widths, fill) {
  ctx.fillStyle = fill;
  const left = [];
  const right = [];
  for (let i = 0; i < pts.length; i += 1) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const hw = widths[i] / 2;
    left.push([pts[i][0] + nx * hw, pts[i][1] + ny * hw]);
    right.push([pts[i][0] - nx * hw, pts[i][1] - ny * hw]);
  }
  ctx.beginPath();
  ctx.moveTo(left[0][0], left[0][1]);
  for (const p of left.slice(1)) ctx.lineTo(p[0], p[1]);
  for (const p of right.reverse()) ctx.lineTo(p[0], p[1]);
  ctx.closePath();
  ctx.fill();
  for (let i = 0; i < pts.length; i += 1) {
    ctx.beginPath();
    ctx.arc(pts[i][0], pts[i][1], widths[i] / 2, 0, TAU);
    ctx.fill();
  }
}

/**
 * Two-bone IK: the elbow between a shoulder and a hand. Of the two solutions it picks the one that
 * keeps the elbow out to the arm's own side (`out` = +1 right arm, -1 left arm) and low, like a
 * real arm, so a guard across the body never folds the upper arm through the chest.
 */
function elbow(sh, hand, upper, fore, out) {
  const dx = hand[0] - sh[0];
  const dy = hand[1] - sh[1];
  const d = Math.max(1, Math.min(Math.hypot(dx, dy), upper + fore - 0.01));
  const a = Math.atan2(dy, dx);
  const cos = Math.max(-1, Math.min(1, (upper * upper + d * d - fore * fore) / (2 * upper * d)));
  const b = Math.acos(cos);
  const cands = [a + b, a - b].map((ang) => [sh[0] + Math.cos(ang) * upper, sh[1] + Math.sin(ang) * upper]);
  const score = (e) => (e[0] - sh[0]) * out + (e[1] - sh[1]) * 0.6;
  return score(cands[0]) >= score(cands[1]) ? cands[0] : cands[1];
}

// ── poses ───────────────────────────────────────────────────────────────────────────────────

const SIDE = { left: -1, right: 1 };

/** Where the weapon hand and tip are, and how the body leans, from the engine's state. */
function humanPose(duel, t) {
  const e = duel.enemy;
  const tg = duel.telegraph;
  const breathe = Math.sin(t * 2.1);
  const p = {
    hand: [44, -158],
    tip: [84, -266],
    off: [-40, -150],
    lean: 0,
    crouch: 0.08 + breathe * 0.02,
    lunge: 0,
    bob: breathe * 1.6,
    point: false,
    swing: 0,
    tele: null,
  };
  if (e.state === 'idle' || e.state === 'hesitate') {
    const g = SIDE[e.guardSide] ?? 0;
    // en garde on the guarded side: the blade covers that flank and points up and out
    p.hand = g < 0 ? [-14, -168] : g > 0 ? [62, -162] : [44, -158];
    p.tip = g < 0 ? [-78, -262] : g > 0 ? [110, -258] : [84, -266];
    p.off = [g < 0 ? -58 : -44, -142];
    if (e.state === 'hesitate') {
      p.hand = [30, -120];
      p.tip = [70, -40];
      p.crouch = 0.02;
    }
  } else if (e.state === 'windup' && tg) {
    const k = easeInOut(tg.progress);
    p.tele = tg;
    p.crouch = 0.1 + 0.18 * k;
    const sx = SIDE[tg.dir] ?? 0;
    if (tg.dir === 'overhead') {
      p.hand = [lerp(44, 6, k), lerp(-158, -292, k)];
      p.tip = [lerp(84, -26, k), lerp(-266, -392, k)];
      p.lean = -0.06 * k;
    } else if (tg.dir === 'thrust') {
      p.hand = [lerp(44, 46, k), lerp(-158, -176, k)];
      p.tip = [lerp(84, 30, k), lerp(-266, -178, k)];
      p.point = k > 0.55;
      p.lean = -0.08 * k;
      p.lunge = -0.04 * k;
    } else {
      p.hand = [lerp(44, sx * 92, k), lerp(-158, -214, k)];
      p.tip = [lerp(84, sx * 180, k), lerp(-266, -288, k)];
      p.lean = sx * 0.1 * k;
      p.off = [lerp(-40, -sx * 46, k), -164];
    }
  } else if (e.state === 'active') {
    const dir = e.step?.dir;
    const k = easeOut(clamp01(e.stateMs / Math.max(1, e.stateDurMs)));
    const sx = SIDE[dir] ?? 0;
    p.swing = 1 - k * 0.6;
    p.crouch = 0.3;
    if (dir === 'overhead') {
      p.hand = [lerp(6, 0, k), lerp(-292, -130, k)];
      p.tip = [lerp(-26, 0, k), lerp(-392, -10, k)];
      p.lean = 0.12 * k;
      p.lunge = 0.1 * k;
    } else if (dir === 'thrust') {
      p.hand = [lerp(46, 6, k), lerp(-176, -168, k)];
      p.tip = [lerp(30, 2, k), lerp(-178, -170, k)];
      p.point = true;
      p.lunge = 0.28 * k;
      p.lean = 0.1 * k;
    } else {
      p.hand = [lerp(sx * 92, -sx * 66, k), lerp(-214, -130, k)];
      p.tip = [lerp(sx * 180, -sx * 190, k), lerp(-288, -70, k)];
      p.lean = -sx * 0.12 * k;
      p.lunge = 0.12 * k;
    }
  } else if (e.state === 'recovery') {
    p.hand = [40, -112];
    p.tip = [96, -26];
    p.crouch = 0.24 + breathe * 0.03;
    p.lean = 0.05;
    p.bob = breathe * 2.6;
  } else if (e.state === 'open') {
    p.hand = [86, -150];
    p.tip = [176, -210];
    p.off = [-80, -150];
    p.lean = 0.14;
    p.crouch = 0.06;
  } else if (e.state === 'staggered') {
    const wob = Math.sin(t * 7) * 0.05;
    p.hand = [64, -96];
    p.tip = [126, -8];
    p.off = [-60, -110];
    p.lean = -0.16 + wob;
    p.crouch = 0.2;
  }
  return p;
}

// ── weapons ─────────────────────────────────────────────────────────────────────────────────

function drawWeapon(ctx, look, light, hand, tip, pose, t, focal = false) {
  const [hx, hy] = hand;
  const [tx, ty] = tip;
  const dx = tx - hx;
  const dy = ty - hy;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;
  const tc = pose.tele ? TELE[pose.tele.telegraphColor] : null;
  const ta = pose.tele ? teleAlpha(pose.tele, t) : 0;
  const kind = look.weapon;
  const steel = look.spectral ? hex('#d8d4e6') : hex('#c9ced6');
  const bladeLen = kind === 'short' ? Math.min(len, 82) : kind === 'greatsword' ? Math.max(len, 120) : len;
  const ex = hx + ux * bladeLen;
  const ey = hy + uy * bladeLen;

  if (pose.point) {
    // A point coming straight at you: a foreshortened stub and a hard glint.
    const r = (tc ? 11 + 14 * (pose.tele?.progress ?? 1) : 9);
    if (focal) {
      glow(ctx, tx, ty, r * 1.8, hex('#ffd97a'), 0.5);
      return;
    }
    if (tc) glow(ctx, tx, ty, r * 3.2, hex(tc.glowHex), 0.42 * ta);
    ctx.fillStyle = rgba(steel);
    ctx.beginPath();
    ctx.moveTo(tx, ty - r);
    ctx.lineTo(tx + r * 0.6, ty);
    ctx.lineTo(tx, ty + r);
    ctx.lineTo(tx - r * 0.6, ty);
    ctx.closePath();
    ctx.fill();
    glow(ctx, tx, ty, r * 1.4, hex('#fff4d6'), 0.45);
    return;
  }

  const width = kind === 'greatsword' ? 14 : kind === 'rapier' ? 3.6 : kind === 'short' ? 7 : 8;
  const curve = kind === 'sabre' || kind === 'shock' ? 0.12 : 0;
  const cx1 = hx + ux * bladeLen * 0.55 + nx * bladeLen * curve;
  const cy1 = hy + uy * bladeLen * 0.55 + ny * bladeLen * curve;
  if (focal) {
    // the echo's blade edge: the one warm line on its pale steel
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = rgba(hex('#f0dc95'), 0.9);
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(hx + nx * width * 0.45 + ux * 14, hy + ny * width * 0.45 + uy * 14);
    ctx.quadraticCurveTo(cx1 + nx * width * 0.5, cy1 + ny * width * 0.5, ex, ey);
    ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(hex('#ffd97a'), 0.22);
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (tc) {
    // the telegraph colour runs along the blade: a painted band with a dark edge, never neon
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(7,13,24,${0.5 * ta})`;
    ctx.lineWidth = 17;
    ctx.beginPath();
    ctx.moveTo(hx + ux * 16, hy + uy * 16);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.strokeStyle = rgba(hex(tc.glowHex), 0.75 * ta);
    ctx.lineWidth = 12;
    ctx.stroke();
    ctx.restore();
  }

  // blade: a slightly curved, tapering shape with a bright edge
  const g = ctx.createLinearGradient(hx + nx * width, hy + ny * width, hx - nx * width, hy - ny * width);
  g.addColorStop(0, rgba(mix(steel, light.shadow, 0.45)));
  g.addColorStop(0.45, rgba(mix(steel, light.key, 0.25)));
  g.addColorStop(0.55, rgba(mix(steel, [255, 250, 240], 0.7)));
  g.addColorStop(1, rgba(mix(steel, light.shadow, 0.3)));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(hx + nx * width * 0.5, hy + ny * width * 0.5);
  ctx.quadraticCurveTo(cx1 + nx * width * 0.5, cy1 + ny * width * 0.5, ex, ey);
  ctx.quadraticCurveTo(cx1 - nx * width * 0.5, cy1 - ny * width * 0.5, hx - nx * width * 0.5, hy - ny * width * 0.5);
  ctx.closePath();
  ctx.fill();
  if (kind === 'shock') {
    const f = 0.6 + 0.4 * Math.sin(t * 23) * Math.sin(t * 7);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(hex('#ffcf7a'), 0.75 * f);
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(hx + nx * width * 0.5, hy + ny * width * 0.5);
    ctx.quadraticCurveTo(cx1 + nx * width * 0.5, cy1 + ny * width * 0.5, ex, ey);
    ctx.stroke();
    ctx.strokeStyle = rgba(hex('#ffb347'), 0.25 * f);
    ctx.lineWidth = 9;
    ctx.stroke();
    ctx.restore();
  }
  // hilt
  ctx.strokeStyle = rgba(look.trim);
  ctx.lineWidth = kind === 'greatsword' ? 6 : 4.5;
  ctx.lineCap = 'round';
  const guard = kind === 'greatsword' ? 30 : kind === 'rapier' ? 12 : 20;
  ctx.beginPath();
  ctx.moveTo(hx + nx * guard, hy + ny * guard);
  ctx.lineTo(hx - nx * guard, hy - ny * guard);
  ctx.stroke();
  if (kind === 'rapier') {
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(hx + ux * 6, hy + uy * 6, 11, 0, TAU);
    ctx.stroke();
  }
  ctx.strokeStyle = rgba(hex('#2a1f17'));
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(hx, hy);
  ctx.lineTo(hx - ux * 18, hy - uy * 18);
  ctx.stroke();
  ctx.fillStyle = rgba(look.trim);
  ctx.beginPath();
  ctx.arc(hx - ux * 21, hy - uy * 21, 4.5, 0, TAU);
  ctx.fill();
}

function drawDagger(ctx, look, light, hand) {
  const [x, y] = hand;
  ctx.fillStyle = shade(ctx, x - 4, x + 4, hex('#b9bec6'), light);
  ctx.beginPath();
  ctx.moveTo(x - 3.5, y - 4);
  ctx.lineTo(x, y - 52);
  ctx.lineTo(x + 3.5, y - 4);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = rgba(look.trim);
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(x - 10, y - 4);
  ctx.lineTo(x + 10, y - 4);
  ctx.stroke();
}

// ── the human figure ────────────────────────────────────────────────────────────────────────
//
// Built like a painted figure, not a mannequin: tapered limbs with a muscle belly, bent knees and
// elbows, gloved fists and booted feet with soles, a torso with a cinched waist, a coat skirt that
// flares in two-tone folds, and a face with a jaw, a brow shadow and a nose. Each named foe has
// one silhouette feature you can read from across the field: Corvin's crest, Sable's high collar,
// Nyra's goggles, Ilvane's long coat-tails, the Grey Coat's deep hood.

const BLACK = [0, 0, 0];
const LEATHER = hex('#2c211a');

/** A tapered, slightly muscled segment from a to b with rounded ends (thigh, calf, arm). */
function seg(ctx, a, b, wa, wb, fill, bulge = 0.12) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;
  const ha = wa / 2;
  const hb = wb / 2;
  const hm = Math.max(ha, hb) * (1 + bulge);
  // the belly of the muscle sits a little toward the root
  const px = a[0] + dx * 0.38;
  const py = a[1] + dy * 0.38;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(a[0] + nx * ha, a[1] + ny * ha);
  ctx.quadraticCurveTo(px + nx * hm, py + ny * hm, b[0] + nx * hb, b[1] + ny * hb);
  ctx.quadraticCurveTo(b[0] + (ux + nx) * hb, b[1] + (uy + ny) * hb, b[0] + ux * hb, b[1] + uy * hb);
  ctx.quadraticCurveTo(b[0] + (ux - nx) * hb, b[1] + (uy - ny) * hb, b[0] - nx * hb, b[1] - ny * hb);
  ctx.quadraticCurveTo(px - nx * hm, py - ny * hm, a[0] - nx * ha, a[1] - ny * ha);
  ctx.quadraticCurveTo(a[0] - (ux + nx) * ha, a[1] - (uy + ny) * ha, a[0] - ux * ha, a[1] - uy * ha);
  ctx.quadraticCurveTo(a[0] - (ux - nx) * ha, a[1] - (uy - ny) * ha, a[0] + nx * ha, a[1] + ny * ha);
  ctx.closePath();
  ctx.fill();
}

/** The point `k` of the way from a to b. */
const at = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];

/** A gloved fist at `p`, the forearm arriving along `dir` (unit vector from the elbow). */
function fist(ctx, p, dir, base, light, size = 1) {
  const ang = Math.atan2(dir[1], dir[0]);
  ctx.save();
  ctx.translate(p[0], p[1]);
  ctx.rotate(ang);
  ctx.scale(size, size);
  // the glove's cuff, flaring back over the wrist
  ctx.fillStyle = rgba(mix(base, BLACK, 0.25));
  ctx.beginPath();
  ctx.moveTo(-16, -10);
  ctx.lineTo(-5, -8);
  ctx.lineTo(-5, 8);
  ctx.lineTo(-16, 10);
  ctx.closePath();
  ctx.fill();
  // the fist: a rounded block, the knuckles leading
  const g = ctx.createLinearGradient(0, -9, 0, 9);
  const litUp = Math.sin(ang) * light.side >= 0; // which local edge faces the key
  g.addColorStop(0, rgba(litUp ? mix(base, light.key, 0.32) : mix(base, light.shadow, 0.5)));
  g.addColorStop(0.5, rgba(base));
  g.addColorStop(1, rgba(litUp ? mix(base, light.shadow, 0.5) : mix(base, light.key, 0.32)));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-6, -8.5);
  ctx.quadraticCurveTo(8, -10.5, 11, -6);
  ctx.quadraticCurveTo(13.5, 0, 11, 6);
  ctx.quadraticCurveTo(8, 10.5, -6, 8.5);
  ctx.closePath();
  ctx.fill();
  // knuckle seams and the thumb across the front
  ctx.strokeStyle = rgba(mix(base, BLACK, 0.5), 0.8);
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  for (const k of [-4.2, 0, 4.2]) {
    ctx.moveTo(5, k);
    ctx.lineTo(11.5, k * 1.05);
  }
  ctx.stroke();
  ctx.fillStyle = rgba(mix(base, light.key, 0.18));
  ctx.beginPath();
  ctx.ellipse(1, -6.5, 6.5, 3, 0.2, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** A tall riding boot from below the knee to the ankle, a turned cuff, the foot and its sole. */
function boot(ctx, knee, ankle, sx, look, light) {
  const leather = look.boots ?? LEATHER;
  const top = at(knee, ankle, 0.12);
  seg(ctx, top, ankle, 22, 16, shade(ctx, ankle[0] - 13, ankle[0] + 13, leather, light, 0.55), 0.06);
  // the turned-down cuff
  ctx.fillStyle = shade(ctx, top[0] - 13, top[0] + 13, mix(leather, hex('#6b4a32'), 0.45), light, 0.5);
  ctx.beginPath();
  ctx.moveTo(top[0] - 13, top[1] - 3);
  ctx.quadraticCurveTo(top[0], top[1] - 6, top[0] + 13, top[1] - 3);
  ctx.lineTo(top[0] + 12, top[1] + 7);
  ctx.quadraticCurveTo(top[0], top[1] + 4, top[0] - 12, top[1] + 7);
  ctx.closePath();
  ctx.fill();
  // a crease at the ankle
  ctx.strokeStyle = rgba(mix(leather, BLACK, 0.55), 0.8);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(ankle[0] - 7, ankle[1] - 8);
  ctx.quadraticCurveTo(ankle[0], ankle[1] - 5, ankle[0] + 7, ankle[1] - 8);
  ctx.stroke();
  // the foot, toward you: a rounded toe cap wider than the ankle
  const fx = ankle[0] + sx * 3;
  ctx.fillStyle = shade(ctx, fx - 15, fx + 15, leather, light, 0.5);
  ctx.beginPath();
  ctx.moveTo(ankle[0] - 8, ankle[1] - 2);
  ctx.quadraticCurveTo(fx - 16, -6, fx - 15, 0);
  ctx.lineTo(fx + 15, 0);
  ctx.quadraticCurveTo(fx + 16, -6, ankle[0] + 8, ankle[1] - 2);
  ctx.closePath();
  ctx.fill();
  // toe-cap shine on the lit side
  ctx.fillStyle = rgba(mix(leather, light.key, 0.45), 0.55);
  ctx.beginPath();
  ctx.ellipse(fx + light.side * 6, -5, 4.5, 2, 0, 0, TAU);
  ctx.fill();
  // the sole and its welt
  ctx.fillStyle = rgba(hex('#0c0907'));
  ctx.beginPath();
  ctx.moveTo(fx - 16, -1);
  ctx.lineTo(fx + 16, -1);
  ctx.quadraticCurveTo(fx + 17, 4, fx + 13, 5);
  ctx.lineTo(fx - 13, 5);
  ctx.quadraticCurveTo(fx - 17, 4, fx - 16, -1);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = rgba(mix(leather, hex('#8a6a48'), 0.5), 0.7);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(fx - 15, -0.5);
  ctx.lineTo(fx + 15, -0.5);
  ctx.stroke();
}

/** The face: a jaw, cheekbones, a brow that shades the eyes, a nose, a mouth, ears. */
function face(ctx, look, light, hy, { brows = true } = {}) {
  const skin = look.skin;
  const dark = mix(skin, light.shadow, 0.5);
  // neck, shaded under the jaw
  ctx.fillStyle = shade(ctx, -10, 10, mix(skin, light.shadow, 0.25), light, 0.3);
  ctx.fillRect(-8, hy + 14, 16, 22);
  ctx.fillStyle = rgba(dark, 0.6);
  ctx.fillRect(-8, hy + 14, 16, 7);
  // ears
  ctx.fillStyle = rgba(mix(skin, light.shadow, 0.2));
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(sx * 16.5, hy - 1, 3.6, 6.5, sx * 0.15, 0, TAU);
    ctx.fill();
  }
  // the head
  ctx.fillStyle = shade(ctx, -17, 17, skin, light, 0.4);
  ctx.beginPath();
  ctx.moveTo(-16, hy - 10);
  ctx.quadraticCurveTo(-17, hy + 3, -14, hy + 9);
  ctx.quadraticCurveTo(-10, hy + 21, 0, hy + 23);
  ctx.quadraticCurveTo(10, hy + 21, 14, hy + 9);
  ctx.quadraticCurveTo(17, hy + 3, 16, hy - 10);
  ctx.quadraticCurveTo(15, hy - 26, 0, hy - 26);
  ctx.quadraticCurveTo(-15, hy - 26, -16, hy - 10);
  ctx.closePath();
  ctx.fill();
  // the shadow side of the face, under the cheekbone and along the jaw
  const ss = -light.side;
  ctx.fillStyle = rgba(dark, 0.45);
  ctx.beginPath();
  ctx.moveTo(ss * 15.5, hy - 8);
  ctx.quadraticCurveTo(ss * 16, hy + 4, ss * 13, hy + 10);
  ctx.quadraticCurveTo(ss * 9, hy + 20, ss * 1, hy + 22.5);
  ctx.quadraticCurveTo(ss * 8, hy + 12, ss * 9, hy + 2);
  ctx.quadraticCurveTo(ss * 10, hy - 6, ss * 15.5, hy - 8);
  ctx.closePath();
  ctx.fill();
  // the brow's shadow over the eyes
  ctx.fillStyle = rgba(dark, 0.42);
  ctx.beginPath();
  ctx.ellipse(0, hy - 3, 14.5, 4.6, 0, 0, TAU);
  ctx.fill();
  // eyes: dark almonds with a catchlight
  for (const sx of [-1, 1]) {
    ctx.fillStyle = rgba(hex('#14100e'));
    ctx.beginPath();
    ctx.ellipse(sx * 6.5, hy - 2, 3.4, 1.5, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = rgba(hex('#f3eee1'), 0.7);
    ctx.fillRect(sx * 6.5 + light.side * 1, hy - 2.8, 1.1, 1.1);
  }
  if (brows) {
    ctx.strokeStyle = rgba(mix(look.hair ?? hex('#2a1d16'), BLACK, 0.2));
    ctx.lineWidth = 2.3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-11, hy - 6.5);
    ctx.quadraticCurveTo(-7, hy - 9, -3, hy - 7);
    ctx.moveTo(11, hy - 6.5);
    ctx.quadraticCurveTo(7, hy - 9, 3, hy - 7);
    ctx.stroke();
  }
  // the nose: a shadow down the dark side and under the tip, a light on the bridge
  ctx.strokeStyle = rgba(dark, 0.8);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(ss * 1.5, hy - 2);
  ctx.quadraticCurveTo(ss * 3, hy + 5, ss * 2.5, hy + 8);
  ctx.moveTo(-3, hy + 9.5);
  ctx.quadraticCurveTo(0, hy + 11, 3, hy + 9.5);
  ctx.stroke();
  ctx.fillStyle = rgba(mix(skin, light.key, 0.45), 0.6);
  ctx.beginPath();
  ctx.ellipse(-ss * 1, hy + 3, 1.2, 4, 0, 0, TAU);
  ctx.fill();
  // mouth and the lower lip's light
  ctx.strokeStyle = rgba(mix(skin, hex('#3a1a14'), 0.6));
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-5, hy + 14.5);
  ctx.quadraticCurveTo(0, hy + 15.5, 5, hy + 14.5);
  ctx.stroke();
  ctx.fillStyle = rgba(mix(skin, light.key, 0.3), 0.5);
  ctx.fillRect(-3, hy + 16.2, 6, 1.4);
}

function drawHead(ctx, look, light, t, telegraphing, focal) {
  const hy = -262;
  if (focal) {
    // the spectral echo's focal points, drawn over its translucent body: the crown and the eyes
    if (look.head === 'crown') crown(ctx, look, hy, t);
    return;
  }
  const helm = (base) => {
    ctx.fillStyle = shade(ctx, -22, 22, base, light);
    ctx.beginPath();
    ctx.moveTo(-21, hy + 20);
    ctx.quadraticCurveTo(-24, hy - 26, 0, hy - 29);
    ctx.quadraticCurveTo(24, hy - 26, 21, hy + 20);
    ctx.quadraticCurveTo(0, hy + 28, -21, hy + 20);
    ctx.closePath();
    ctx.fill();
    // a lit crown on the dome and a dark rim at the gorget
    ctx.fillStyle = rgba(mix(base, light.key, 0.5), 0.45);
    ctx.beginPath();
    ctx.ellipse(light.side * 7, hy - 18, 7, 5, light.side * 0.5, 0, TAU);
    ctx.fill();
  };
  // the gorget / collar under every head
  ctx.fillStyle = shade(ctx, -14, 14, mix(look.coat, BLACK, 0.3), light);
  ctx.fillRect(-11, -246, 22, 18);
  switch (look.head) {
    case 'visor': {
      helm(look.armor);
      ctx.fillStyle = rgba(hex('#0b0d12'));
      ctx.fillRect(-17, hy - 4, 34, 9);
      const pulse = telegraphing ? 1 : 0.7 + 0.3 * Math.sin(t * 2.4);
      ctx.fillStyle = rgba(look.glowC, 0.9 * pulse);
      ctx.fillRect(-14, hy - 1, 28, 2.6);
      glow(ctx, 0, hy, 22, look.glowC, 0.28 * pulse);
      // the cheek plates and a brass comb
      ctx.strokeStyle = rgba(mix(look.armor, BLACK, 0.5), 0.8);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-17, hy + 6);
      ctx.lineTo(-10, hy + 20);
      ctx.moveTo(17, hy + 6);
      ctx.lineTo(10, hy + 20);
      ctx.stroke();
      ctx.strokeStyle = rgba(look.trim);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, hy - 29);
      ctx.lineTo(0, hy - 6);
      ctx.stroke();
      break;
    }
    case 'hood': {
      // the deep hood: a warm shadow inside, a faint lit chin, two points of light
      ctx.fillStyle = shade(ctx, -30, 30, look.coat, light);
      ctx.beginPath();
      ctx.moveTo(-34, hy + 30);
      ctx.quadraticCurveTo(-36, hy - 26, -4, hy - 40);
      ctx.quadraticCurveTo(10, hy - 44, 16, hy - 36);
      ctx.quadraticCurveTo(36, hy - 22, 34, hy + 30);
      ctx.closePath();
      ctx.fill();
      // fold lines in the cloth
      ctx.strokeStyle = rgba(mix(look.coat, light.shadow, 0.55), 0.7);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-26, hy + 24);
      ctx.quadraticCurveTo(-28, hy - 10, -12, hy - 30);
      ctx.moveTo(26, hy + 24);
      ctx.quadraticCurveTo(29, hy - 8, 14, hy - 30);
      ctx.stroke();
      const ig = ctx.createRadialGradient(0, hy + 6, 2, 0, hy + 2, 20);
      ig.addColorStop(0, rgba(hex('#3a2418')));
      ig.addColorStop(0.65, rgba(hex('#1d120c')));
      ig.addColorStop(1, rgba(hex('#0b0807')));
      ctx.fillStyle = ig;
      ctx.beginPath();
      ctx.moveTo(-15, hy + 22);
      ctx.quadraticCurveTo(-19, hy - 6, -2, hy - 20);
      ctx.quadraticCurveTo(18, hy - 8, 15, hy + 22);
      ctx.quadraticCurveTo(0, hy + 26, -15, hy + 22);
      ctx.closePath();
      ctx.fill();
      // the lip of the hood catches the key light
      ctx.strokeStyle = rgba(mix(look.coat, light.key, 0.5), 0.75);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(light.side * 15, hy + 20);
      ctx.quadraticCurveTo(light.side * 19, hy - 6, light.side * 2, hy - 20);
      ctx.stroke();
      // the jaw, barely lit by what reaches into the hood
      const cg = ctx.createRadialGradient(light.side * 4, hy + 14, 0, light.side * 4, hy + 14, 10);
      cg.addColorStop(0, rgba(mix(hex('#c89878'), light.key, 0.2), 0.42));
      cg.addColorStop(1, rgba(hex('#c89878'), 0));
      ctx.fillStyle = cg;
      ctx.fillRect(light.side * 4 - 10, hy + 4, 20, 20);
      const pulse = telegraphing ? 1 : 0.55 + 0.25 * Math.sin(t * 1.7);
      for (const sx of [-1, 1]) {
        ctx.fillStyle = rgba(look.glowC, 0.8 * pulse);
        ctx.beginPath();
        ctx.ellipse(sx * 6, hy + 1, 2.4, 1.1, 0, 0, TAU);
        ctx.fill();
      }
      if (look.scarf) {
        // a scarf wound high, its tail thrown over one shoulder
        ctx.fillStyle = shade(ctx, -24, 24, look.scarf, light);
        ctx.beginPath();
        ctx.moveTo(-24, hy + 16);
        ctx.quadraticCurveTo(0, hy + 26, 24, hy + 16);
        ctx.quadraticCurveTo(26, hy + 30, 20, hy + 36);
        ctx.quadraticCurveTo(0, hy + 42, -20, hy + 36);
        ctx.quadraticCurveTo(-26, hy + 30, -24, hy + 16);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(14, hy + 32);
        ctx.quadraticCurveTo(34, hy + 44 + Math.sin(t * 1.4) * 3, 30, hy + 74);
        ctx.lineTo(20, hy + 70);
        ctx.quadraticCurveTo(24, hy + 48, 6, hy + 38);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = rgba(mix(look.scarf, light.shadow, 0.5), 0.7);
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(-18, hy + 28);
        ctx.quadraticCurveTo(0, hy + 34, 18, hy + 28);
        ctx.stroke();
      }
      break;
    }
    case 'pilot': {
      face(ctx, look, light, hy);
      // cropped hair, swept back
      ctx.fillStyle = shade(ctx, -20, 20, look.hair, light, 0.4);
      ctx.beginPath();
      ctx.moveTo(-17, hy - 4);
      ctx.quadraticCurveTo(-20, hy - 30, 0, hy - 31);
      ctx.quadraticCurveTo(20, hy - 30, 17, hy - 4);
      ctx.quadraticCurveTo(14, hy - 20, 0, hy - 21);
      ctx.quadraticCurveTo(-14, hy - 20, -17, hy - 4);
      ctx.closePath();
      ctx.fill();
      // her flight goggles, pushed up on the brow: brass rims, amber glass, a leather strap
      ctx.fillStyle = rgba(hex('#2a2018'));
      ctx.fillRect(-21, hy - 21, 42, 6);
      for (const sx of [-1, 1]) {
        ctx.fillStyle = shade(ctx, sx * 9 - 9, sx * 9 + 9, look.trim, light, 0.6);
        ctx.beginPath();
        ctx.arc(sx * 9, hy - 19, 8.5, 0, TAU);
        ctx.fill();
        const lg = ctx.createRadialGradient(sx * 9 - 2, hy - 21, 0.5, sx * 9, hy - 19, 6);
        lg.addColorStop(0, rgba(hex('#ffe9ae')));
        lg.addColorStop(0.45, rgba(hex('#e0782b')));
        lg.addColorStop(1, rgba(hex('#4f2a12')));
        ctx.fillStyle = lg;
        ctx.beginPath();
        ctx.arc(sx * 9, hy - 19, 5.6, 0, TAU);
        ctx.fill();
      }
      break;
    }
    case 'officer': {
      face(ctx, look, light, hy);
      // her high collar: two stiff panels standing up to the jaw, edged in gold
      for (const sx of [-1, 1]) {
        ctx.fillStyle = shade(ctx, sx * 26 - 10, sx * 26 + 10, look.coat, light);
        ctx.beginPath();
        ctx.moveTo(sx * 6, -230);
        ctx.lineTo(sx * 30, -232);
        ctx.quadraticCurveTo(sx * 34, hy + 12, sx * 28, hy - 2);
        ctx.lineTo(sx * 15, hy + 14);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = rgba(look.trim, 0.9);
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(sx * 15, hy + 14);
        ctx.lineTo(sx * 28, hy - 2);
        ctx.quadraticCurveTo(sx * 34, hy + 12, sx * 30, -232);
        ctx.stroke();
      }
      // a peaked cap with a brass badge
      ctx.fillStyle = shade(ctx, -22, 22, look.coat, light);
      ctx.beginPath();
      ctx.moveTo(-19, hy - 15);
      ctx.quadraticCurveTo(-22, hy - 34, 0, hy - 36);
      ctx.quadraticCurveTo(22, hy - 34, 19, hy - 15);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = rgba(hex('#14100e'));
      ctx.beginPath();
      ctx.ellipse(0, hy - 14, 24, 5, 0, 0, Math.PI);
      ctx.fill();
      ctx.fillStyle = rgba(look.trim);
      ctx.fillRect(-19, hy - 19, 38, 2.4);
      ctx.beginPath();
      ctx.arc(0, hy - 25, 4, 0, TAU);
      ctx.fill();
      break;
    }
    case 'master': {
      face(ctx, look, light, hy);
      // silver hair swept back into a long queue over one shoulder
      ctx.fillStyle = shade(ctx, -20, 20, look.hair, light, 0.5);
      ctx.beginPath();
      ctx.moveTo(-17, hy - 2);
      ctx.quadraticCurveTo(-21, hy - 31, 0, hy - 30);
      ctx.quadraticCurveTo(21, hy - 31, 17, hy - 2);
      ctx.quadraticCurveTo(13, hy - 19, 0, hy - 20);
      ctx.quadraticCurveTo(-13, hy - 19, -17, hy - 2);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-15, hy + 2);
      ctx.quadraticCurveTo(-28, hy + 30, -24, hy + 64);
      ctx.lineTo(-17, hy + 62);
      ctx.quadraticCurveTo(-20, hy + 30, -11, hy + 6);
      ctx.closePath();
      ctx.fill();
      // a trimmed beard on the jaw
      ctx.beginPath();
      ctx.moveTo(-12, hy + 10);
      ctx.quadraticCurveTo(0, hy + 32, 12, hy + 10);
      ctx.quadraticCurveTo(0, hy + 19, -12, hy + 10);
      ctx.fill();
      break;
    }
    case 'greathelm': {
      // Corvin's crest: a tall comb of crimson horsehair over a barrel helm
      const sway = Math.sin(t * 2) * 2.5;
      ctx.fillStyle = shade(ctx, -14, 14, look.accent, light, 0.35);
      ctx.beginPath();
      ctx.moveTo(-6, hy - 26);
      ctx.quadraticCurveTo(-8 + sway, hy - 82, 4 + sway, hy - 86);
      ctx.quadraticCurveTo(24 + sway, hy - 84, 36 + sway, hy - 46);
      ctx.quadraticCurveTo(28, hy - 38, 8, hy - 28);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = rgba(mix(look.accent, light.key, 0.35), 0.6);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let i = 0; i < 5; i += 1) {
        ctx.moveTo(-2 + i * 3, hy - 30);
        ctx.quadraticCurveTo(2 + i * 4 + sway, hy - 76 + i * 4, 10 + i * 6 + sway, hy - 74 + i * 7);
      }
      ctx.stroke();
      ctx.fillStyle = shade(ctx, -24, 24, look.armor, light);
      ctx.beginPath();
      ctx.moveTo(-22, hy + 24);
      ctx.lineTo(-23, hy - 18);
      ctx.quadraticCurveTo(0, hy - 34, 23, hy - 18);
      ctx.lineTo(22, hy + 24);
      ctx.quadraticCurveTo(0, hy + 30, -22, hy + 24);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = rgba(mix(look.armor, light.key, 0.45), 0.4);
      ctx.fillRect(light.side > 0 ? 10 : -16, hy - 18, 6, 38);
      ctx.fillStyle = rgba(hex('#0a0606'));
      ctx.fillRect(-16, hy - 6, 32, 6);
      ctx.fillRect(-3, hy - 6, 6, 22);
      const pulse = telegraphing ? 1 : 0.6 + 0.3 * Math.sin(t * 2);
      ctx.fillStyle = rgba(look.glowC, 0.8 * pulse);
      ctx.fillRect(-13, hy - 4, 26, 2);
      glow(ctx, 0, hy - 3, 20, look.glowC, 0.26 * pulse);
      ctx.strokeStyle = rgba(look.trim, 0.85);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-22, hy + 12);
      ctx.quadraticCurveTo(0, hy + 18, 22, hy + 12);
      ctx.stroke();
      break;
    }
    case 'crown': {
      // the echo: a pale, translucent face (its crown and eyes are drawn in the focal pass)
      face(ctx, look, light, hy, { brows: false });
      break;
    }
    default:
      helm(look.armor);
  }
}

/** The echo's crown and eyes: the warm gold the eye goes to, over the pale translucent body. */
function crown(ctx, look, hy, t) {
  const pulse = 0.85 + 0.15 * Math.sin(t * 1.7);
  for (const sx of [-1, 1]) {
    ctx.fillStyle = rgba(hex('#fff4d6'), 0.95);
    ctx.beginPath();
    ctx.ellipse(sx * 6.5, hy - 2, 3.4, 1.4, 0, 0, TAU);
    ctx.fill();
    glow(ctx, sx * 6.5, hy - 2, 9, hex('#ffd97a'), 0.42 * pulse);
  }
  const g = ctx.createLinearGradient(0, hy - 48, 0, hy - 16);
  g.addColorStop(0, rgba(hex('#fff4d6')));
  g.addColorStop(0.4, rgba(hex('#e3c463')));
  g.addColorStop(1, rgba(hex('#a8841b')));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-19, hy - 17);
  for (let i = 0; i <= 4; i += 1) ctx.lineTo(-19 + i * 9.5, i % 2 ? hy - 30 : hy - 46);
  ctx.lineTo(19, hy - 17);
  ctx.quadraticCurveTo(0, hy - 13, -19, hy - 17);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = rgba(hex('#7d6114'));
  ctx.fillRect(-19, hy - 21, 38, 3);
  for (const x of [-19, 0, 19]) {
    ctx.fillStyle = rgba(hex('#fffaf0'));
    ctx.beginPath();
    ctx.arc(x, hy - 46, 2.2, 0, TAU);
    ctx.fill();
  }
  glow(ctx, 0, hy - 32, 26, hex('#ffd97a'), 0.22 * pulse);
}

/** The coat's skirt: flaring from the waist, split at the front, folds in two tones. */
function skirtPath(ctx, y0, skirt, sway, tails) {
  const hem = y0 + skirt;
  const flare = 10 + skirt * 0.2;
  ctx.beginPath();
  ctx.moveTo(-34, y0 - 6);
  ctx.lineTo(34, y0 - 6);
  ctx.quadraticCurveTo(40 + flare * 0.4, y0 + skirt * 0.45, 36 + flare + sway, hem);
  if (tails) {
    // long coat-tails: two panels split wide at the front
    ctx.quadraticCurveTo(26 + sway, hem + 6, 14 + sway * 0.5, hem - 4);
    ctx.lineTo(4, y0 + skirt * 0.3);
    ctx.lineTo(-4, y0 + skirt * 0.3);
    ctx.lineTo(-14 + sway * 0.5, hem - 4);
    ctx.quadraticCurveTo(-26 + sway, hem + 6, -36 - flare + sway, hem);
  } else {
    ctx.quadraticCurveTo(24 + sway, hem + 5, 9, hem - 2);
    ctx.lineTo(0, y0 + skirt * 0.42);
    ctx.lineTo(-9, hem - 2);
    ctx.quadraticCurveTo(-24 + sway, hem + 5, -36 - flare + sway, hem);
  }
  ctx.quadraticCurveTo(-40 - flare * 0.4, y0 + skirt * 0.45, -34, y0 - 6);
  ctx.closePath();
}

function drawSkirt(ctx, look, light, y0, skirt, sway) {
  const tails = Boolean(look.tails);
  ctx.fillStyle = shade(ctx, -64, 64, look.coat, light);
  skirtPath(ctx, y0, skirt, sway, tails);
  ctx.fill();
  if (skirt < 24) return;
  // folds: a shadowed valley and a lit ridge beside it, flaring toward the hem
  const hem = y0 + skirt;
  const valley = rgba(mix(look.coat, light.shadow, 0.6), 0.55);
  const ridgeC = rgba(mix(look.coat, light.key, 0.3), 0.32);
  for (const f of [-0.78, -0.42, 0.42, 0.78]) {
    const xTop = f * 30;
    const xBot = f * (46 + skirt * 0.2) + sway * 0.8;
    ctx.fillStyle = valley;
    ctx.beginPath();
    ctx.moveTo(xTop, y0 + 2);
    ctx.quadraticCurveTo(xBot * 0.9, y0 + skirt * 0.6, xBot - 4, hem - 1);
    ctx.lineTo(xBot + 4, hem + 1);
    ctx.quadraticCurveTo(xBot * 0.92 + 1, y0 + skirt * 0.6, xTop + 1.5, y0 + 2);
    ctx.closePath();
    ctx.fill();
    const rx = xBot + light.side * 7;
    ctx.fillStyle = ridgeC;
    ctx.beginPath();
    ctx.moveTo(xTop + light.side * 4, y0 + 6);
    ctx.quadraticCurveTo(rx * 0.9, y0 + skirt * 0.6, rx - 2.5, hem - 2);
    ctx.lineTo(rx + 2.5, hem - 1);
    ctx.quadraticCurveTo(rx * 0.92 + 1, y0 + skirt * 0.6, xTop + light.side * 5.5, y0 + 6);
    ctx.closePath();
    ctx.fill();
  }
  // the hem: a trim line for the officers, a darker turned edge for the rest
  ctx.strokeStyle = look.hemTrim ? rgba(look.trim, 0.8) : rgba(mix(look.coat, BLACK, 0.4), 0.7);
  ctx.lineWidth = look.hemTrim ? 2 : 2.4;
  skirtPath(ctx, y0, skirt, sway, tails);
  ctx.stroke();
}

function drawHuman(ctx, duel, t, look, light, react) {
  const pose = humanPose(duel, t);
  const focal = Boolean(react.focal);
  const over = react.overK;
  if (over > 0 && react.outcome === 'victory') {
    // beaten: down on one knee, blade to the ground
    pose.crouch = lerp(pose.crouch, 0.9, over);
    pose.hand = [lerp(pose.hand[0], 50, over), lerp(pose.hand[1], -70, over)];
    pose.tip = [lerp(pose.tip[0], 120, over), lerp(pose.tip[1], 0, over)];
    pose.lean = lerp(pose.lean, 0.22, over);
    pose.tele = null;
    pose.point = false;
  }
  const crouch = pose.crouch;
  const hipY = -138 + crouch * 46;
  ctx.save();
  // recoil when struck
  const rk = react.hitK;
  if (rk > 0) {
    ctx.translate(react.hitDir * 10 * rk, -4 * rk);
    ctx.rotate(react.hitDir * 0.05 * rk);
  }
  const sc = (look.build ?? 1) * (1 + pose.lunge);
  ctx.scale(sc, sc);
  const torsoBase = look.pauldrons ? look.armor : look.coat;
  const sleeve = mix(look.armor, look.coat, 0.55);
  const glove = look.glove ?? hex('#2a2320');
  if (focal && look.spectral) {
    // motes rising off the dissolving hem, pale gold and moon-violet
    for (let i = 0; i < 16; i += 1) {
      const ph = (t * 0.28 + i * 0.137) % 1;
      const x = -78 + ((i * 53) % 156) + Math.sin(t * 1.3 + i) * 6;
      const y = -8 - ph * 130;
      ctx.fillStyle = rgba(i % 3 ? hex('#d9d2f0') : hex('#f0dc95'), 0.7 * (1 - ph) * Math.min(1, ph * 6));
      ctx.beginPath();
      ctx.arc(x, y, 1.4 + (i % 3) * 0.6, 0, TAU);
      ctx.fill();
    }
  }

  if (!focal) {
    // cape behind everything (the echo's dissolves into motes at the hem)
    if (look.cape) {
      const sway = Math.sin(t * 1.6) * 8;
      const cg = shade(ctx, -84, 84, look.cape, light, 0.35);
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.moveTo(-48, -224 + pose.bob);
      ctx.quadraticCurveTo(-92 + sway, -110, -82 + sway, -14);
      ctx.quadraticCurveTo(-40 + sway, -4, -20 + sway * 0.6, -12);
      ctx.quadraticCurveTo(0, -2 + sway * 0.4, 20 + sway * 0.6, -12);
      ctx.quadraticCurveTo(40 + sway, -4, 82 + sway, -14);
      ctx.quadraticCurveTo(92 + sway, -110, 48, -224 + pose.bob);
      ctx.closePath();
      ctx.fill();
      // the cape's inner folds
      ctx.strokeStyle = rgba(mix(look.cape, light.shadow, 0.6), 0.55);
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (const fx of [-60, -34, 34, 60]) {
        ctx.moveTo(fx * 0.6, -200);
        ctx.quadraticCurveTo(fx + sway * 0.5, -110, fx * 1.2 + sway, -20);
      }
      ctx.stroke();
      if (look.spectral) {
        // the hem dissolves: the cape fades out and breaks into rising motes
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        const fade = ctx.createLinearGradient(0, -110, 0, -4);
        fade.addColorStop(0, 'rgba(0,0,0,0)');
        fade.addColorStop(1, 'rgba(0,0,0,0.95)');
        ctx.fillStyle = fade;
        ctx.fillRect(-110, -110, 220, 112);
        ctx.restore();
      }
    }

    // legs: thigh and calf with a bend at the knee, then the boot
    const legBase = look.trousers ?? mix(look.coat, BLACK, 0.25);
    for (const sx of [-1, 1]) {
      const hip = [sx * 17, hipY];
      const knee = [sx * (31 + crouch * 16), lerp(-74, -60, crouch)];
      const ankle = [sx * 35, -14];
      seg(ctx, hip, knee, 31, 21, shade(ctx, sx * 30 - 17, sx * 30 + 17, legBase, light), 0.14);
      seg(ctx, knee, ankle, 21, 15, shade(ctx, sx * 34 - 13, sx * 34 + 13, legBase, light), 0.16);
      // the knee: a fold of cloth catching the light
      ctx.strokeStyle = rgba(mix(legBase, light.shadow, 0.6), 0.75);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(knee[0] - 7, knee[1] - 3);
      ctx.quadraticCurveTo(knee[0], knee[1] + 2, knee[0] + 7, knee[1] - 3);
      ctx.stroke();
      boot(ctx, knee, ankle, sx, look, light);
    }
  }

  ctx.save();
  ctx.translate(0, hipY);
  ctx.rotate(pose.lean);
  ctx.translate(0, -hipY + pose.bob);
  const y0 = hipY;

  if (!focal) {
    // coat skirt (a short jacket for the pilot, long tails for the sword-master)
    const hemSway = Math.sin(t * 1.9) * 3;
    drawSkirt(ctx, look, light, y0, (look.skirt ?? 0.85) * (84 - crouch * 22), hemSway);

    // torso: broad at the chest, cinched at the waist
    ctx.fillStyle = shade(ctx, -54, 54, torsoBase, light);
    ctx.beginPath();
    ctx.moveTo(-33, y0 - 2);
    ctx.quadraticCurveTo(-27, -160, -36, -182);
    ctx.quadraticCurveTo(-50, -200, -46, -216);
    ctx.quadraticCurveTo(-40, -230, -20, -232);
    ctx.lineTo(20, -232);
    ctx.quadraticCurveTo(40, -230, 46, -216);
    ctx.quadraticCurveTo(50, -200, 36, -182);
    ctx.quadraticCurveTo(27, -160, 33, y0 - 2);
    ctx.closePath();
    ctx.fill();
    // the shadow side of the body: a second, darker value down the far flank
    const ss = -light.side;
    ctx.fillStyle = rgba(mix(torsoBase, light.shadow, 0.6), 0.45);
    ctx.beginPath();
    ctx.moveTo(ss * 33, y0 - 2);
    ctx.quadraticCurveTo(ss * 27, -160, ss * 36, -182);
    ctx.quadraticCurveTo(ss * 50, -200, ss * 46, -216);
    ctx.lineTo(ss * 30, -214);
    ctx.quadraticCurveTo(ss * 34, -190, ss * 22, -172);
    ctx.quadraticCurveTo(ss * 18, -150, ss * 22, y0 - 2);
    ctx.closePath();
    ctx.fill();
    if (look.pauldrons) {
      // a breastplate: a domed plate with a lit crest and a dark lower edge
      const bp = ctx.createLinearGradient(0, -226, 0, -150);
      bp.addColorStop(0, rgba(mix(look.armor, light.key, 0.25)));
      bp.addColorStop(0.55, rgba(look.armor));
      bp.addColorStop(1, rgba(mix(look.armor, light.shadow, 0.45)));
      ctx.fillStyle = bp;
      ctx.beginPath();
      ctx.moveTo(-34, -222);
      ctx.quadraticCurveTo(-44, -186, -26, -156);
      ctx.quadraticCurveTo(0, -146, 26, -156);
      ctx.quadraticCurveTo(44, -186, 34, -222);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = rgba(mix(look.armor, light.key, 0.6), 0.7);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(light.side * 2, -220);
      ctx.quadraticCurveTo(light.side * 4, -188, light.side * 2, -152);
      ctx.stroke();
      ctx.strokeStyle = rgba(mix(look.armor, BLACK, 0.55), 0.75);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-26, -156);
      ctx.quadraticCurveTo(0, -146, 26, -156);
      ctx.moveTo(-36, -200);
      ctx.quadraticCurveTo(-22, -194, -14, -204);
      ctx.moveTo(36, -200);
      ctx.quadraticCurveTo(22, -194, 14, -204);
      ctx.stroke();
      ctx.strokeStyle = rgba(look.trim, 0.8);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-34, -222);
      ctx.quadraticCurveTo(0, -214, 34, -222);
      ctx.stroke();
    } else {
      // lapels over a waistcoat, a row of brass buttons
      ctx.fillStyle = shade(ctx, -30, 30, mix(look.coat, BLACK, 0.3), light);
      ctx.beginPath();
      ctx.moveTo(-22, -232);
      ctx.lineTo(0, -178);
      ctx.lineTo(22, -232);
      ctx.lineTo(11, -232);
      ctx.lineTo(0, -200);
      ctx.lineTo(-11, -232);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = rgba(look.trim, 0.75);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-22, -232);
      ctx.lineTo(0, -178);
      ctx.lineTo(22, -232);
      ctx.stroke();
      ctx.fillStyle = rgba(look.trim);
      for (const yy of [-168, -154]) {
        for (const sx of [-1, 1]) {
          ctx.beginPath();
          ctx.arc(sx * 9, yy, 2.2, 0, TAU);
          ctx.fill();
        }
      }
    }
    // sash
    if (look.head === 'visor' || look.head === 'greathelm') {
      ctx.fillStyle = shade(ctx, -40, 40, look.accent, light);
      ctx.beginPath();
      ctx.moveTo(-42, -214);
      ctx.lineTo(-30, -222);
      ctx.lineTo(38, -146);
      ctx.lineTo(28, -140);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = rgba(mix(look.accent, light.shadow, 0.5), 0.7);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-36, -214);
      ctx.lineTo(33, -143);
      ctx.stroke();
    }
    // belt and buckle
    ctx.fillStyle = rgba(hex('#1e1712'));
    ctx.fillRect(-35, y0 - 13, 70, 11);
    ctx.fillStyle = rgba(mix(hex('#1e1712'), light.key, 0.2));
    ctx.fillRect(-35, y0 - 13, 70, 2);
    ctx.fillStyle = rgba(look.trim);
    ctx.fillRect(-6, y0 - 14, 12, 13);
    ctx.fillStyle = rgba(hex('#1e1712'));
    ctx.fillRect(-3, y0 - 11, 6, 7);

    // off-hand arm: tapered upper arm and forearm, a cuff, a gloved fist
    const shL = [-44, -214];
    const offElbow = elbow(shL, pose.off, 60, 56, -1);
    const armFill = shade(ctx, -84, -8, mix(look.pauldrons ? sleeve : torsoBase, BLACK, 0.1), light);
    seg(ctx, shL, offElbow, 23, 16, armFill, 0.12);
    seg(ctx, offElbow, pose.off, 16, 12, armFill, 0.14);
    const offDir = [pose.off[0] - offElbow[0], pose.off[1] - offElbow[1]];
    const offLen = Math.hypot(offDir[0], offDir[1]) || 1;
    seg(ctx, at(offElbow, pose.off, 0.5), at(offElbow, pose.off, 0.9), 16, 14, shade(ctx, pose.off[0] - 12, pose.off[0] + 12, look.pauldrons ? look.armor : glove, light), 0.02);
    fist(ctx, pose.off, [offDir[0] / offLen, offDir[1] / offLen], glove, light, 0.95);
    if (look.offhand === 'dagger') drawDagger(ctx, look, light, pose.off);
  }

  // the weapon arm's upper arm, under the pauldron
  const shR = [44, -214];
  const el = elbow(shR, pose.hand, 62, 58, 1);
  const wArm = shade(ctx, 8, 94, look.pauldrons ? sleeve : torsoBase, light);
  if (!focal) seg(ctx, shR, el, 23, 16, wArm, 0.12);

  // head
  drawHead(ctx, look, light, t, Boolean(pose.tele), focal);

  if (!focal && look.pauldrons) {
    // pauldrons: three lames over each shoulder, the top one catching the light
    for (const sx of [-1, 1]) {
      for (let k = 2; k >= 0; k -= 1) {
        const ex = sx * (49 + k * 3);
        const ey = -214 + k * 9;
        ctx.fillStyle = shade(ctx, sx * 52 - 26, sx * 52 + 26, mix(look.armor, k ? light.shadow : light.key, k ? 0.12 * k : 0.1), light);
        ctx.beginPath();
        ctx.ellipse(ex, ey, 25 - k * 2, 15 - k, sx * 0.25, Math.PI, TAU);
        ctx.quadraticCurveTo(ex, ey + 6, ex - (25 - k * 2) * Math.cos(sx * 0.25), ey - (25 - k * 2) * Math.sin(sx * 0.25));
        ctx.fill();
        ctx.strokeStyle = rgba(look.trim, 0.8);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(ex, ey, 25 - k * 2, 15 - k, sx * 0.25, Math.PI, TAU);
        ctx.stroke();
      }
    }
  }

  // the forearm and the weapon (in front)
  if (!focal) {
    seg(ctx, el, pose.hand, 16, 12, wArm, 0.14);
    seg(ctx, at(el, pose.hand, 0.5), at(el, pose.hand, 0.9), 17, 14, shade(ctx, pose.hand[0] - 12, pose.hand[0] + 12, look.pauldrons ? look.armor : glove, light), 0.02);
  }
  drawWeapon(ctx, look, light, pose.hand, pose.tip, pose, t, focal);
  if (!focal) {
    const dir = [pose.hand[0] - el[0], pose.hand[1] - el[1]];
    const dl = Math.hypot(dir[0], dir[1]) || 1;
    fist(ctx, pose.hand, [dir[0] / dl, dir[1] / dl], glove, light, 1.05);
  }

  // dazed: stars around the head
  if (!focal && duel.enemy.state === 'staggered') {
    for (let i = 0; i < 5; i += 1) {
      const a = t * 3.2 + (i / 5) * TAU;
      const x = Math.cos(a) * 34;
      const y = -300 + Math.sin(a) * 8;
      glow(ctx, x, y, 9, hex('#ffe9ae'), 0.8);
    }
  }
  ctx.restore();
  ctx.restore();
  return pose;
}

// ── the Frost Warg ──────────────────────────────────────────────────────────────────────────

const FUR_CACHE = new Map();
/** Seeded jitter for shaggy outlines, cached per look so the fur doesn't crawl between frames. */
function furJitter(look, n) {
  const key = `${look.fur.join(',')}:${n}`;
  if (FUR_CACHE.has(key)) return FUR_CACHE.get(key);
  const r = rng(hashStr(key));
  const list = Array.from({ length: n }, () => r());
  FUR_CACHE.set(key, list);
  return list;
}

/** A shaggy blob: an ellipse whose outline breaks into tufts of fur (only between a0 and a1). */
function furBlob(ctx, look, x, y, rx, ry, { tufts = 22, len = 0.22, a0 = 0, a1 = TAU, seed = 3 } = {}) {
  const jit = furJitter(look, tufts * 2 + seed);
  ctx.beginPath();
  const n = tufts * 2;
  for (let i = 0; i <= n; i += 1) {
    const a = (i / n) * TAU;
    const inArc = a0 <= a1 ? a >= a0 && a <= a1 : a >= a0 || a <= a1;
    const spike = inArc && i % 2 === 1 ? 1 + len * (0.55 + 0.45 * jit[(i + seed) % jit.length]) : 1;
    const xx = x + Math.cos(a) * rx * spike;
    const yy = y + Math.sin(a) * ry * spike;
    if (i === 0) ctx.moveTo(xx, yy);
    else ctx.lineTo(xx, yy);
  }
  ctx.closePath();
  ctx.fill();
}

/** Short strands of fur flowing down a region, light and dark, for texture. */
function furStrands(ctx, look, x, y, rx, ry, count, seed) {
  const jit = furJitter(look, count * 3 + seed);
  ctx.lineCap = 'round';
  ctx.lineWidth = 1.8;
  // two batched paths (light strands, dark strands): one stroke each, not one per strand
  for (const lightPass of [false, true]) {
    ctx.strokeStyle = rgba(lightPass ? mix(look.fur, look.light, 0.4) : mix(look.fur, look.dark, 0.55), 0.5);
    ctx.beginPath();
    for (let i = 0; i < count; i += 1) {
      if ((jit[i * 3 + 2] < 0.45) !== lightPass) continue;
      const a = jit[i * 3] * TAU;
      const rr = Math.sqrt(jit[i * 3 + 1]);
      const px = x + Math.cos(a) * rr * rx;
      const py = y + Math.sin(a) * rr * ry;
      ctx.moveTo(px, py);
      ctx.quadraticCurveTo(px + (px - x) * 0.06, py + 6, px + (px - x) * 0.1, py + 9 + jit[i * 3 + 2] * 8);
    }
    ctx.stroke();
  }
}

function wargPose(duel, t) {
  const e = duel.enemy;
  const tg = duel.telegraph;
  const p = { raise: { l: 0, r: 0 }, rear: 0, lunge: 0, snarl: 0.15, lean: 0, low: 0, tele: null, swipe: 0, swipeDir: 0 };
  if (e.state === 'windup' && tg) {
    const k = easeInOut(tg.progress);
    p.tele = tg;
    p.snarl = 0.4 + 0.6 * k;
    if (tg.dir === 'left' || tg.dir === 'right') {
      p.raise[tg.dir === 'left' ? 'l' : 'r'] = k;
      p.lean = SIDE[tg.dir] * 0.08 * k;
    } else if (tg.dir === 'overhead') {
      p.rear = k;
      p.raise.l = k * 0.8;
      p.raise.r = k * 0.8;
    } else {
      p.lunge = -0.06 * k;
      p.low = 0.5 * k;
    }
  } else if (e.state === 'active') {
    const dir = e.step?.dir;
    const k = easeOut(clamp01(e.stateMs / Math.max(1, e.stateDurMs)));
    p.snarl = 1;
    if (dir === 'left' || dir === 'right') {
      p.swipe = k;
      p.swipeDir = SIDE[dir];
      p.raise[dir === 'left' ? 'l' : 'r'] = 1 - k;
      p.lean = -SIDE[dir] * 0.1 * k;
    } else if (dir === 'overhead') {
      p.rear = 1 - k;
      p.lunge = 0.25 * k;
      p.raise.l = (1 - k) * 0.8;
      p.raise.r = (1 - k) * 0.8;
    } else {
      p.lunge = 0.35 * k;
      p.low = 0.2;
    }
  } else if (e.state === 'recovery') {
    p.low = 0.35;
    p.snarl = 0.3;
  } else if (e.state === 'staggered') {
    p.low = 0.5;
    p.lean = Math.sin(t * 6) * 0.06;
  } else if (e.state === 'hesitate') {
    p.snarl = 0;
    p.low = 0.15;
  }
  return p;
}

function drawWarg(ctx, duel, t, look, light, react) {
  const pose = wargPose(duel, t);
  if (react.overK > 0 && react.outcome === 'victory') {
    pose.low = lerp(pose.low, 1, react.overK);
    pose.snarl = lerp(pose.snarl, 0, react.overK);
    pose.raise = { l: 0, r: 0 };
    pose.rear = 0;
    pose.tele = null;
  }
  const tc = pose.tele ? TELE[pose.tele.telegraphColor] : null;
  const ta = pose.tele ? teleAlpha(pose.tele, t) : 0;
  const breathe = Math.sin(t * 2.3) * 3;
  const rear = pose.rear * 80;
  const low = pose.low * 30;
  ctx.save();
  const rk = react.hitK;
  if (rk > 0) ctx.translate(react.hitDir * 12 * rk, -6 * rk);
  const sc = 1.12 * look.size * (1 + pose.lunge);
  ctx.scale(sc, sc);
  ctx.rotate(pose.lean);

  // hind legs, planted wide behind
  for (const sx of [-1, 1]) {
    limb(ctx, [[sx * 92, -120 + low * 0.4], [sx * 112, -64], [sx * 104, -10]], [56, 40, 30], shade(ctx, sx * 104 - 30, sx * 104 + 30, mix(look.dark, hex('#000000'), 0.2), light, 0.3));
    ctx.fillStyle = rgba(mix(look.dark, hex('#000000'), 0.35));
    ctx.beginPath();
    ctx.ellipse(sx * 108, -6, 24, 11, 0, 0, TAU);
    ctx.fill();
  }

  // the hunched back rising behind the head, hackles up
  const chestY = -132 - rear + low + breathe * 0.3;
  const hackles = 0.22 + pose.snarl * 0.18;
  ctx.fillStyle = shade(ctx, -150, 150, look.dark, light, 0.4);
  furBlob(ctx, look, 0, -150 - rear * 0.7 + low * 0.6, 150, 74, { tufts: 26, len: hackles, a0: Math.PI * 1.02, a1: Math.PI * 1.98, seed: 1 });
  // shoulders: two heavy masses of muscle and fur
  for (const sx of [-1, 1]) {
    ctx.fillStyle = shade(ctx, sx * 74 - 60, sx * 74 + 60, look.fur, light);
    furBlob(ctx, look, sx * 70, chestY - 6, 64, 70, { tufts: 14, len: 0.16, a0: sx > 0 ? -Math.PI * 0.6 : Math.PI * 0.6, a1: sx > 0 ? Math.PI * 0.4 : Math.PI * 1.6, seed: sx > 0 ? 5 : 7 });
  }
  // chest between the forelegs, paler and deep
  ctx.fillStyle = shade(ctx, -70, 70, mix(look.fur, look.light, 0.25), light);
  ctx.beginPath();
  ctx.moveTo(-64, chestY - 40);
  ctx.quadraticCurveTo(-58, chestY + 70, 0, chestY + 96 + breathe);
  ctx.quadraticCurveTo(58, chestY + 70, 64, chestY - 40);
  ctx.closePath();
  ctx.fill();
  furStrands(ctx, look, 0, chestY + 20, 58, 60, 70, 11);
  for (const sx of [-1, 1]) furStrands(ctx, look, sx * 72, chestY - 10, 48, 54, 34, sx > 0 ? 13 : 17);

  // forelegs and paws (the striking paw rises, then sweeps)
  for (const sx of [-1, 1]) {
    const raised = sx < 0 ? pose.raise.l : pose.raise.r;
    const sweep = pose.swipe && pose.swipeDir === sx ? pose.swipe : 0;
    const shoulder = [sx * 62, chestY + 20];
    let paw = [sx * 64, -8];
    if (raised > 0) paw = [sx * lerp(64, 118, raised), lerp(-8, -230 - rear * 0.5, raised)];
    if (sweep > 0) paw = [lerp(sx * 118, -sx * 70, sweep), lerp(-230, -60, sweep)];
    const knee = [lerp(shoulder[0], paw[0], 0.5) + sx * 10, lerp(shoulder[1], paw[1], 0.5)];
    limb(ctx, [shoulder, knee, paw], [40, 30, 26], shade(ctx, sx * 64 - 24, sx * 64 + 24, look.dark, light, 0.4));
    ctx.fillStyle = rgba(mix(look.dark, hex('#000000'), 0.3));
    ctx.beginPath();
    ctx.ellipse(paw[0], paw[1], 22, 13, 0, 0, TAU);
    ctx.fill();
    const lift = raised > 0.05 || sweep > 0;
    if (tc && lift) glow(ctx, paw[0], paw[1] - 6, 52, hex(tc.glowHex), 0.6 * ta);
    ctx.strokeStyle = rgba(lift && tc ? hex(tc.coreHex) : mix(look.light, hex('#ffffff'), 0.3), 0.9);
    ctx.lineWidth = 3;
    for (let k = -1; k <= 1; k += 1) {
      ctx.beginPath();
      ctx.moveTo(paw[0] + k * 8, paw[1] + (lift ? -9 : 6));
      ctx.lineTo(paw[0] + k * 10, paw[1] + (lift ? -24 : 14));
      ctx.stroke();
    }
    if (sweep > 0.05 && sweep < 0.95) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = rgba(hex('#fff2dc'), 0.45 * (1 - sweep));
      ctx.lineWidth = 7;
      for (let k = -1; k <= 1; k += 1) {
        ctx.beginPath();
        ctx.moveTo(sx * 118 + k * 10, -230 + k * 6);
        ctx.quadraticCurveTo(0, -200 + k * 10, paw[0] + k * 10, paw[1] + k * 6);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // the ruff: a collar of frost-white fur
  const ruffY = chestY - 42;
  ctx.fillStyle = shade(ctx, -96, 96, look.light, light, 0.3);
  ctx.beginPath();
  const spikes = 26;
  for (let i = 0; i <= spikes; i += 1) {
    const a = Math.PI * 0.05 + (i / spikes) * Math.PI * 0.9;
    const rr = i % 2 ? 72 : 92;
    const x = Math.cos(a) * rr;
    const y = ruffY + Math.sin(a) * rr * 0.62;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.globalAlpha = 0.92;
  ctx.fill();
  ctx.globalAlpha = 1;

  // the head
  const headY = -208 - rear * 1.15 + low * 1.8;
  const hs = 1 + pose.lunge * 1.4 + pose.low * 0.08;
  ctx.save();
  ctx.translate(0, headY);
  ctx.scale(hs, hs);
  ctx.rotate(Math.sin(t * 0.9) * 0.03);
  // ears
  for (const sx of [-1, 1]) {
    ctx.fillStyle = shade(ctx, sx * 40 - 16, sx * 40 + 16, look.fur, light);
    ctx.beginPath();
    ctx.moveTo(sx * 22, -34);
    ctx.lineTo(sx * 52, -96 + pose.snarl * 10);
    ctx.lineTo(sx * 56, -28);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = rgba(mix(look.dark, hex('#5a3a3a'), 0.4));
    ctx.beginPath();
    ctx.moveTo(sx * 30, -38);
    ctx.lineTo(sx * 49, -82 + pose.snarl * 10);
    ctx.lineTo(sx * 50, -36);
    ctx.closePath();
    ctx.fill();
  }
  // skull
  ctx.fillStyle = shade(ctx, -54, 54, look.fur, light);
  ctx.beginPath();
  ctx.moveTo(-50, -18);
  ctx.quadraticCurveTo(-52, -52, 0, -56);
  ctx.quadraticCurveTo(52, -52, 50, -18);
  ctx.quadraticCurveTo(46, 14, 26, 24);
  ctx.lineTo(-26, 24);
  ctx.quadraticCurveTo(-46, 14, -50, -18);
  ctx.closePath();
  ctx.fill();
  // cheek tufts
  ctx.fillStyle = rgba(mix(look.fur, look.light, 0.5));
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(sx * 46, -10);
    ctx.lineTo(sx * 64, 6);
    ctx.lineTo(sx * 48, 8);
    ctx.lineTo(sx * 58, 22);
    ctx.lineTo(sx * 36, 20);
    ctx.closePath();
    ctx.fill();
  }
  // muzzle, foreshortened toward you
  ctx.fillStyle = shade(ctx, -28, 28, mix(look.fur, look.light, 0.3), light);
  ctx.beginPath();
  ctx.moveTo(-26, -4);
  ctx.lineTo(26, -4);
  ctx.lineTo(18, 46);
  ctx.quadraticCurveTo(0, 54, -18, 46);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = rgba(mix(look.light, hex('#ffffff'), 0.4), 0.5);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -12);
  ctx.lineTo(0, 38);
  ctx.stroke();
  // jaws: open with the snarl
  const open = 6 + pose.snarl * 16 + pose.lunge * 30;
  ctx.fillStyle = rgba(hex('#1a0b0d'));
  ctx.beginPath();
  ctx.ellipse(0, 52, 19, open * 0.5, 0, 0, TAU);
  ctx.fill();
  if (pose.snarl > 0.3) {
    ctx.fillStyle = rgba(hex('#f4efe4'));
    for (let i = -3; i <= 3; i += 1) {
      const fang = Math.abs(i) === 2;
      ctx.beginPath();
      ctx.moveTo(i * 5 - 2.5, 50 - open * 0.3);
      ctx.lineTo(i * 5, 50 - open * 0.3 + (fang ? 10 : 5));
      ctx.lineTo(i * 5 + 2.5, 50 - open * 0.3);
      ctx.closePath();
      ctx.fill();
    }
  }
  if (tc && (pose.tele?.dir === 'thrust' || pose.tele?.dir === 'overhead')) glow(ctx, 0, 40, 90, hex(tc.glowHex), 0.55 * ta);
  // nose
  ctx.fillStyle = rgba(hex('#0d0b0c'));
  ctx.beginPath();
  ctx.ellipse(0, 40, 13, 8.5, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = rgba(hex('#ffffff'), 0.35);
  ctx.beginPath();
  ctx.ellipse(-3, 37, 4, 2, 0, 0, TAU);
  ctx.fill();
  // brow and eyes
  ctx.fillStyle = rgba(mix(look.dark, hex('#000000'), 0.3), 0.8);
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(sx * 34, -18);
    ctx.lineTo(sx * 8, -12 + pose.snarl * 4);
    ctx.lineTo(sx * 10, -4);
    ctx.lineTo(sx * 32, -8);
    ctx.closePath();
    ctx.fill();
  }
  const eyeC = tc && (pose.tele?.dir === 'thrust' || pose.tele?.dir === 'overhead') ? hex(tc.coreHex) : look.eye;
  for (const sx of [-1, 1]) {
    ctx.fillStyle = rgba(eyeC);
    ctx.beginPath();
    ctx.ellipse(sx * 20, -4, 8, 3.4, sx * -0.25, 0, TAU);
    ctx.fill();
    ctx.fillStyle = rgba(hex('#0b0a0a'));
    ctx.fillRect(sx * 20 - 1, -7, 2, 6);
    glow(ctx, sx * 20, -4, 18, eyeC, duel.enemy.state === 'hesitate' ? 0.25 : 0.5);
  }
  // an old scar across one eye
  ctx.strokeStyle = rgba(mix(look.light, hex('#ffffff'), 0.2), 0.65);
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(-34, -26);
  ctx.lineTo(-12, 10);
  ctx.stroke();
  if (look.old) {
    ctx.fillStyle = rgba(hex('#f2efe8'), 0.6);
    ctx.beginPath();
    ctx.ellipse(0, 30, 20, 14, 0, 0, TAU);
    ctx.fill();
  }
  ctx.restore();

  // breath in the cold
  for (let i = 0; i < 3; i += 1) {
    const ph = ((t * 0.45 + i / 3) % 1);
    const by = headY + 60 * hs + ph * 40;
    glow(ctx, Math.sin(ph * 5 + i) * 10, by, (16 + ph * 40), hex('#e8eef6'), 0.16 * (1 - ph), false);
  }
  if (duel.enemy.state === 'staggered') {
    for (let i = 0; i < 5; i += 1) {
      const a = t * 3 + (i / 5) * TAU;
      glow(ctx, Math.cos(a) * 50, headY - 80 + Math.sin(a) * 10, 10, hex('#ffe9ae'), 0.8);
    }
  }
  ctx.restore();
  return pose;
}

// ── telegraph colours (shared with the overlay) ─────────────────────────────────────────────

export const TELE = {
  // painted, not glowing: drawn over a dark navy under-stroke so they read on any stage
  steel: { coreHex: '#eef2f5', glowHex: '#c3c7cc', label: 'Parry or dodge' },
  red_gold: { coreHex: '#f4a35e', glowHex: '#e0782b', label: 'Dodge' },
  flicker: { coreHex: '#e9d9ff', glowHex: '#c9b8ec', label: 'Feint: wait' },
};

export function teleAlpha(tg, t) {
  if (!tg) return 0;
  if (tg.isFeint) return 0.35 + 0.65 * Math.abs(Math.sin(t * 22));
  if (tg.isHeavy) return 0.7 + 0.3 * Math.sin(t * 10) * tg.progress;
  return 0.85;
}

// ── entry point ─────────────────────────────────────────────────────────────────────────────

/**
 * Draw the foe at the duel position. `react` = { hitK (0..1 recoil), hitDir, flashK, overK, outcome }.
 * Returns the weapon tip in screen space (for motion trails), or null.
 */
export function drawFoeShadow(ctx, L, look) {
  const { cx, floorY, s } = L;
  // the contact shadow under the feet (the glow behind the foe is baked into the backdrop)
  ctx.save();
  const r = (look.kind === 'warg' ? 150 : 110) * s;
  const sh = ctx.createRadialGradient(cx, floorY, 0, cx, floorY, r);
  sh.addColorStop(0, `rgba(0,0,0,${look.spectral ? 0.3 : 0.6})`);
  sh.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sh;
  ctx.translate(cx, floorY);
  ctx.scale(1, 0.2);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/**
 * The spectral echo's focal points (its crown, its eyes, the warm edge of its blade and the motes
 * off its hem), drawn at full strength over its translucent body. Same pose, same space as drawFoe.
 */
export function drawFoeFocal(ctx, L, duel, t, look, light, react) {
  if (!look.spectral || look.kind === 'warg') return;
  ctx.save();
  ctx.translate(L.cx, L.floorY);
  ctx.scale(L.s, L.s);
  drawHuman(ctx, duel, t, look, light, { ...react, focal: true });
  ctx.restore();
}

export function drawFoe(ctx, L, duel, t, look, light, react) {
  const { cx, floorY, s } = L;
  ctx.save();
  ctx.translate(cx, floorY);
  ctx.scale(s, s);
  const pose = look.kind === 'warg' ? drawWarg(ctx, duel, t, look, light, react) : drawHuman(ctx, duel, t, look, light, react);
  ctx.restore();
  if (look.kind === 'warg' || !pose) return null;
  // what the figure covers this frame (the renderer lights and composites only that)
  const sc = (look.build ?? 1) * (1 + pose.lunge);
  const xs = [-104, 104, pose.hand[0], pose.tip[0], pose.off[0]];
  const ys = [-352, 14, pose.hand[1], pose.tip[1]];
  const pad = 34 + Math.abs(pose.lean) * 160;
  return {
    x0: cx + (Math.min(...xs) - pad) * s * sc,
    x1: cx + (Math.max(...xs) + pad) * s * sc,
    y0: floorY + (Math.min(...ys) - pad) * s * sc,
    y1: floorY + (Math.max(...ys) + 12) * s * sc,
  };
}
