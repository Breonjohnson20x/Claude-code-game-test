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
  },
  scout: {
    kind: 'human', coat: hex('#5b5d63'), armor: hex('#3d4048'), trim: hex('#7d7f86'), accent: hex('#3a3c42'),
    head: 'hood', glowC: hex('#ffcf8a'), weapon: 'short', offhand: 'dagger', pauldrons: false, scarf: hex('#6b4a3a'), skirt: 0.95, trousers: hex('#2e2a28'),
  },
  master: {
    kind: 'human', coat: hex('#24304a'), armor: hex('#4a5266'), trim: hex('#d6b47a'), accent: hex('#d6b47a'),
    skin: hex('#d2a688'), hair: hex('#cfcac2'), head: 'master', weapon: 'rapier', pauldrons: false, skirt: 1, trousers: hex('#1d2232'),
  },
  warlord: {
    kind: 'human', coat: hex('#2e1513'), armor: hex('#565052'), trim: hex('#c08a3a'), accent: hex('#8a2f25'),
    head: 'greathelm', glowC: hex('#ff8a3a'), weapon: 'greatsword', pauldrons: true, cape: hex('#3b1210'), build: 1.08, skirt: 0.75, trousers: hex('#2a2224'),
  },
  echo: {
    kind: 'human', coat: hex('#7d6114'), armor: hex('#c9a227'), trim: hex('#fff4d6'), accent: hex('#e3c463'),
    skin: hex('#f0dc95'), head: 'crown', glowC: hex('#fffaf0'), weapon: 'spectral', pauldrons: true, cape: hex('#a8841b'), spectral: true, skirt: 1.05, trousers: hex('#6b5214'),
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

/** A horizontal gradient across a part: shadow side, base, key-lit, a rim of edge light. */
function shade(ctx, x0, x1, base, light, rimK = 0.7) {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  const dark = mix(base, light.shadow, 0.55);
  const keyLit = mix(base, light.key, 0.28);
  const rim = mix(base, light.rim, rimK);
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

function drawWeapon(ctx, look, light, hand, tip, pose, t) {
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
  const steel = look.spectral ? hex('#fff4d6') : hex('#c9ced6');
  const bladeLen = kind === 'short' ? Math.min(len, 82) : kind === 'greatsword' ? Math.max(len, 120) : len;
  const ex = hx + ux * bladeLen;
  const ey = hy + uy * bladeLen;

  if (pose.point) {
    // A point coming straight at you: a foreshortened stub and a hard glint.
    const r = (tc ? 11 + 14 * (pose.tele?.progress ?? 1) : 9);
    if (tc) glow(ctx, tx, ty, r * 4.5, hex(tc.glowHex), 0.6 * ta);
    ctx.fillStyle = rgba(steel);
    ctx.beginPath();
    ctx.moveTo(tx, ty - r);
    ctx.lineTo(tx + r * 0.6, ty);
    ctx.lineTo(tx, ty + r);
    ctx.lineTo(tx - r * 0.6, ty);
    ctx.closePath();
    ctx.fill();
    glow(ctx, tx, ty, r * 1.6, hex('#ffffff'), 0.7);
    return;
  }

  if (tc) {
    // the telegraph colour runs along the blade
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.strokeStyle = rgba(hex(tc.glowHex), 0.32 * ta);
    ctx.lineWidth = 30;
    ctx.beginPath();
    ctx.moveTo(hx + ux * 16, hy + uy * 16);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.strokeStyle = rgba(hex(tc.glowHex), 0.6 * ta);
    ctx.lineWidth = 12;
    ctx.stroke();
    ctx.restore();
  }

  const width = kind === 'greatsword' ? 14 : kind === 'rapier' ? 3.6 : kind === 'short' ? 7 : 8;
  const curve = kind === 'sabre' || kind === 'shock' ? 0.12 : 0;
  // blade: a slightly curved, tapering shape with a bright edge
  const cx1 = hx + ux * bladeLen * 0.55 + nx * bladeLen * curve;
  const cy1 = hy + uy * bladeLen * 0.55 + ny * bladeLen * curve;
  const g = ctx.createLinearGradient(hx + nx * width, hy + ny * width, hx - nx * width, hy - ny * width);
  g.addColorStop(0, rgba(mix(steel, light.shadow, 0.45)));
  g.addColorStop(0.45, rgba(mix(steel, light.key, 0.25)));
  g.addColorStop(0.55, rgba([255, 255, 255]));
  g.addColorStop(1, rgba(mix(steel, light.shadow, 0.3)));
  ctx.fillStyle = g;
  ctx.globalAlpha = look.spectral ? 0.85 : 1;
  ctx.beginPath();
  ctx.moveTo(hx + nx * width * 0.5, hy + ny * width * 0.5);
  ctx.quadraticCurveTo(cx1 + nx * width * 0.5, cy1 + ny * width * 0.5, ex, ey);
  ctx.quadraticCurveTo(cx1 - nx * width * 0.5, cy1 - ny * width * 0.5, hx - nx * width * 0.5, hy - ny * width * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
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
  if (look.spectral) glow(ctx, (hx + ex) / 2, (hy + ey) / 2, bladeLen * 0.7, hex('#ffe9ae'), 0.18);
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

function drawHead(ctx, look, light, t, telegraphing) {
  const hy = -262;
  ctx.fillStyle = shade(ctx, -10, 10, mix(look.coat, hex('#000000'), 0.3), light);
  ctx.fillRect(-9, -244, 18, 16);
  const helm = (base) => {
    ctx.fillStyle = shade(ctx, -22, 22, base, light);
    ctx.beginPath();
    ctx.ellipse(0, hy, 21, 26, 0, 0, TAU);
    ctx.fill();
  };
  const face = () => {
    ctx.fillStyle = shade(ctx, -18, 18, look.skin, light, 0.45);
    ctx.beginPath();
    ctx.ellipse(0, hy + 2, 17, 22, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = rgba(mix(look.skin, hex('#000000'), 0.55));
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(sx * 7, hy, 4.2, 1.8, 0, 0, TAU);
      ctx.fill();
    }
    ctx.strokeStyle = rgba(mix(look.skin, hex('#000000'), 0.4));
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-9, hy - 6);
    ctx.lineTo(-3, hy - 5);
    ctx.moveTo(9, hy - 6);
    ctx.lineTo(3, hy - 5);
    ctx.moveTo(0, hy + 1);
    ctx.lineTo(1.5, hy + 8);
    ctx.moveTo(-5, hy + 13);
    ctx.lineTo(5, hy + 13);
    ctx.stroke();
  };
  switch (look.head) {
    case 'visor': {
      helm(look.armor);
      ctx.fillStyle = rgba(hex('#0b0d12'));
      ctx.fillRect(-17, hy - 4, 34, 9);
      const pulse = telegraphing ? 1 : 0.7 + 0.3 * Math.sin(t * 2.4);
      ctx.fillStyle = rgba(look.glowC, 0.95 * pulse);
      ctx.fillRect(-14, hy - 1, 28, 3);
      glow(ctx, 0, hy, 26, look.glowC, 0.35 * pulse);
      ctx.strokeStyle = rgba(look.trim);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, hy - 26);
      ctx.lineTo(0, hy - 6);
      ctx.stroke();
      break;
    }
    case 'hood': {
      ctx.fillStyle = shade(ctx, -28, 28, look.coat, light);
      ctx.beginPath();
      ctx.moveTo(-30, hy + 26);
      ctx.quadraticCurveTo(-32, hy - 30, 0, hy - 34);
      ctx.quadraticCurveTo(32, hy - 30, 30, hy + 26);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = rgba(hex('#07080b'));
      ctx.beginPath();
      ctx.ellipse(0, hy + 2, 14, 19, 0, 0, TAU);
      ctx.fill();
      const pulse = telegraphing ? 1 : 0.55 + 0.25 * Math.sin(t * 1.7);
      for (const sx of [-1, 1]) {
        ctx.fillStyle = rgba(look.glowC, 0.85 * pulse);
        ctx.beginPath();
        ctx.ellipse(sx * 6, hy - 1, 2.6, 1.2, 0, 0, TAU);
        ctx.fill();
      }
      if (look.scarf) {
        ctx.fillStyle = shade(ctx, -20, 20, look.scarf, light);
        ctx.beginPath();
        ctx.ellipse(0, hy + 22, 22, 9, 0, 0, TAU);
        ctx.fill();
      }
      break;
    }
    case 'pilot': {
      face();
      ctx.fillStyle = shade(ctx, -20, 20, look.hair, light, 0.4);
      ctx.beginPath();
      ctx.ellipse(0, hy - 12, 19, 15, 0, Math.PI, TAU);
      ctx.fill();
      ctx.fillRect(-19, hy - 13, 6, 14);
      ctx.fillRect(13, hy - 13, 6, 12);
      // goggles pushed up on the brow
      ctx.fillStyle = rgba(hex('#2a2420'));
      ctx.fillRect(-20, hy - 17, 40, 5);
      for (const sx of [-1, 1]) {
        ctx.fillStyle = rgba(look.trim);
        ctx.beginPath();
        ctx.arc(sx * 8, hy - 15, 5.5, 0, TAU);
        ctx.fill();
        ctx.fillStyle = rgba(hex('#ffcf7a'), 0.75);
        ctx.beginPath();
        ctx.arc(sx * 8, hy - 15, 3.4, 0, TAU);
        ctx.fill();
      }
      break;
    }
    case 'officer': {
      face();
      ctx.fillStyle = shade(ctx, -22, 22, look.coat, light);
      ctx.fillRect(-19, hy - 32, 38, 16);
      ctx.fillStyle = rgba(hex('#14100e'));
      ctx.beginPath();
      ctx.ellipse(0, hy - 15, 24, 5, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = rgba(look.trim);
      ctx.beginPath();
      ctx.arc(0, hy - 25, 4, 0, TAU);
      ctx.fill();
      break;
    }
    case 'master': {
      face();
      ctx.fillStyle = shade(ctx, -20, 20, look.hair, light, 0.5);
      ctx.beginPath();
      ctx.ellipse(0, hy - 13, 18.5, 13, 0, Math.PI, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-12, hy + 10);
      ctx.quadraticCurveTo(0, hy + 32, 12, hy + 10);
      ctx.quadraticCurveTo(0, hy + 18, -12, hy + 10);
      ctx.fill();
      break;
    }
    case 'greathelm': {
      ctx.fillStyle = shade(ctx, -24, 24, look.armor, light);
      ctx.beginPath();
      ctx.moveTo(-22, hy + 24);
      ctx.lineTo(-23, hy - 18);
      ctx.quadraticCurveTo(0, hy - 34, 23, hy - 18);
      ctx.lineTo(22, hy + 24);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = rgba(hex('#0a0606'));
      ctx.fillRect(-16, hy - 6, 32, 6);
      ctx.fillRect(-3, hy - 6, 6, 22);
      const pulse = telegraphing ? 1 : 0.6 + 0.3 * Math.sin(t * 2);
      ctx.fillStyle = rgba(look.glowC, 0.8 * pulse);
      ctx.fillRect(-13, hy - 4, 26, 2);
      glow(ctx, 0, hy - 3, 24, look.glowC, 0.3 * pulse);
      // plume
      ctx.fillStyle = shade(ctx, -6, 30, look.accent, light);
      ctx.beginPath();
      ctx.moveTo(-4, hy - 30);
      ctx.quadraticCurveTo(26, hy - 52 + Math.sin(t * 2) * 3, 34, hy - 10);
      ctx.quadraticCurveTo(16, hy - 30, 4, hy - 26);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'crown': {
      ctx.globalAlpha = 0.9;
      face();
      ctx.globalAlpha = 1;
      for (const sx of [-1, 1]) {
        ctx.fillStyle = rgba(look.glowC);
        ctx.beginPath();
        ctx.ellipse(sx * 7, hy, 4, 1.6, 0, 0, TAU);
        ctx.fill();
        glow(ctx, sx * 7, hy, 10, look.glowC, 0.6);
      }
      ctx.fillStyle = rgba(look.armor);
      ctx.beginPath();
      ctx.moveTo(-20, hy - 18);
      for (let i = 0; i <= 4; i += 1) ctx.lineTo(-20 + i * 10, i % 2 ? hy - 28 : hy - 44);
      ctx.lineTo(20, hy - 18);
      ctx.closePath();
      ctx.fill();
      glow(ctx, 0, hy - 32, 30, hex('#ffe9ae'), 0.35);
      break;
    }
    default:
      helm(look.armor);
  }
}

function drawHuman(ctx, duel, t, look, light, react) {
  const pose = humanPose(duel, t);
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

  // cape behind everything
  if (look.cape) {
    const sway = Math.sin(t * 1.6) * 8;
    ctx.fillStyle = shade(ctx, -80, 80, look.cape, light, 0.4);
    ctx.beginPath();
    ctx.moveTo(-50, -218 + pose.bob);
    ctx.quadraticCurveTo(-90 + sway, -100, -78 + sway, -16);
    ctx.quadraticCurveTo(0, -4 + sway * 0.4, 78 + sway, -16);
    ctx.quadraticCurveTo(90 + sway, -100, 50, -218 + pose.bob);
    ctx.closePath();
    ctx.fill();
  }

  // legs
  const legBase = look.trousers ?? mix(look.coat, hex('#000000'), 0.25);
  for (const sx of [-1, 1]) {
    const hip = [sx * 18, hipY];
    const knee = [sx * (28 + crouch * 14), lerp(-72, -58, crouch)];
    const ankle = [sx * 36, -12];
    limb(ctx, [hip, knee, ankle], [26, 19, 15], shade(ctx, sx * 40 - 16, sx * 40 + 16, legBase, light));
    // boots
    limb(ctx, [[knee[0], knee[1] + 12], ankle], [20, 16], shade(ctx, sx * 36 - 12, sx * 36 + 12, hex('#1a1512'), light, 0.5));
    ctx.fillStyle = rgba(hex('#120e0b'));
    ctx.beginPath();
    ctx.ellipse(sx * 40, -4, 17, 7, 0, 0, TAU);
    ctx.fill();
  }

  ctx.save();
  ctx.translate(0, hipY);
  ctx.rotate(pose.lean);
  ctx.translate(0, -hipY + pose.bob);
  const y0 = hipY;

  // coat skirt (a short jacket for the pilot, a long coat for the sword-master)
  const hemSway = Math.sin(t * 1.9) * 3;
  const skirt = (look.skirt ?? 0.85) * (84 - crouch * 22);
  ctx.fillStyle = shade(ctx, -60, 60, look.coat, light);
  ctx.beginPath();
  ctx.moveTo(-38, y0 - 6);
  ctx.lineTo(38, y0 - 6);
  ctx.lineTo(44 + skirt * 0.16 + hemSway, y0 + skirt);
  ctx.lineTo(8, y0 + skirt * 0.93);
  ctx.lineTo(0, y0 + skirt * 0.4);
  ctx.lineTo(-8, y0 + skirt * 0.93);
  ctx.lineTo(-44 - skirt * 0.16 + hemSway, y0 + skirt);
  ctx.closePath();
  ctx.fill();
  if (skirt > 30) {
    ctx.strokeStyle = rgba(mix(look.coat, hex('#000000'), 0.4), 0.6);
    ctx.lineWidth = 1.6;
    for (const fx of [-28, -14, 16, 30]) {
      ctx.beginPath();
      ctx.moveTo(fx * 0.8, y0 + 4);
      ctx.lineTo(fx * 1.2 + hemSway * 0.5, y0 + skirt * 0.88);
      ctx.stroke();
    }
  }

  // torso
  const torsoBase = look.pauldrons ? look.armor : look.coat;
  ctx.fillStyle = shade(ctx, -54, 54, torsoBase, light);
  ctx.beginPath();
  ctx.moveTo(-34, y0 - 4);
  ctx.lineTo(-44, -182);
  ctx.quadraticCurveTo(-56, -214, -40, -228);
  ctx.lineTo(40, -228);
  ctx.quadraticCurveTo(56, -214, 44, -182);
  ctx.lineTo(34, y0 - 4);
  ctx.closePath();
  ctx.fill();
  if (look.pauldrons) {
    // breastplate ridge and plate lines
    ctx.strokeStyle = rgba(mix(look.armor, light.rim, 0.6), 0.8);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -222);
    ctx.lineTo(0, y0 - 14);
    ctx.stroke();
    ctx.strokeStyle = rgba(mix(look.armor, hex('#000000'), 0.5), 0.7);
    ctx.lineWidth = 1.6;
    for (const yy of [-196, -172]) {
      ctx.beginPath();
      ctx.moveTo(-40, yy);
      ctx.quadraticCurveTo(0, yy + 8, 40, yy);
      ctx.stroke();
    }
  } else {
    // lapels
    ctx.fillStyle = shade(ctx, -30, 30, mix(look.coat, hex('#000000'), 0.25), light);
    ctx.beginPath();
    ctx.moveTo(-20, -228);
    ctx.lineTo(0, -176);
    ctx.lineTo(20, -228);
    ctx.lineTo(10, -228);
    ctx.lineTo(0, -196);
    ctx.lineTo(-10, -228);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = rgba(look.trim, 0.7);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-20, -228);
    ctx.lineTo(0, -176);
    ctx.lineTo(20, -228);
    ctx.stroke();
  }
  // sash
  if (look.head === 'visor' || look.head === 'greathelm') {
    ctx.fillStyle = shade(ctx, -40, 40, look.accent, light);
    ctx.beginPath();
    ctx.moveTo(-42, -214);
    ctx.lineTo(-30, -222);
    ctx.lineTo(40, -150);
    ctx.lineTo(30, -142);
    ctx.closePath();
    ctx.fill();
  }
  // belt and buckle
  ctx.fillStyle = rgba(hex('#1e1712'));
  ctx.fillRect(-37, y0 - 12, 74, 11);
  ctx.fillStyle = rgba(look.trim);
  ctx.fillRect(-6, y0 - 13, 12, 13);

  // off-hand arm
  const shL = [-46, -214];
  const offElbow = elbow(shL, pose.off, 60, 56, -1);
  limb(ctx, [shL, offElbow, pose.off], [20, 16, 13], shade(ctx, -80, -10, mix(torsoBase, hex('#000000'), 0.1), light));
  ctx.fillStyle = shade(ctx, pose.off[0] - 8, pose.off[0] + 8, look.skin && !look.pauldrons ? look.skin : hex('#3a3430'), light, 0.4);
  ctx.beginPath();
  ctx.arc(pose.off[0], pose.off[1], 8, 0, TAU);
  ctx.fill();
  if (look.offhand === 'dagger') drawDagger(ctx, look, light, pose.off);

  // head
  drawHead(ctx, look, light, t, Boolean(pose.tele));

  // pauldrons over the shoulders
  if (look.pauldrons) {
    for (const sx of [-1, 1]) {
      for (let k = 2; k >= 0; k -= 1) {
        ctx.fillStyle = shade(ctx, sx * 52 - 24, sx * 52 + 24, mix(look.armor, hex('#ffffff'), k * 0.04), light);
        ctx.beginPath();
        ctx.ellipse(sx * (50 + k * 3), -214 + k * 9, 23 - k * 2, 14 - k, sx * 0.25, Math.PI, TAU);
        ctx.fill();
        ctx.strokeStyle = rgba(look.trim, 0.75);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(sx * (50 + k * 3), -214 + k * 9, 23 - k * 2, 14 - k, sx * 0.25, Math.PI, TAU);
        ctx.stroke();
      }
    }
  }

  // weapon arm and weapon (in front)
  const shR = [46, -214];
  const el = elbow(shR, pose.hand, 62, 58, 1);
  limb(ctx, [shR, el, pose.hand], [21, 17, 14], shade(ctx, 10, 90, mix(torsoBase, hex('#000000'), 0.05), light));
  drawWeapon(ctx, look, light, pose.hand, pose.tip, pose, t);
  ctx.fillStyle = shade(ctx, pose.hand[0] - 9, pose.hand[0] + 9, look.pauldrons ? look.armor : hex('#3a3430'), light, 0.5);
  ctx.beginPath();
  ctx.arc(pose.hand[0], pose.hand[1], 9, 0, TAU);
  ctx.fill();

  // dazed: stars around the head
  if (duel.enemy.state === 'staggered') {
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
  for (let i = 0; i < count; i += 1) {
    const a = jit[i * 3] * TAU;
    const rr = Math.sqrt(jit[i * 3 + 1]);
    const px = x + Math.cos(a) * rr * rx;
    const py = y + Math.sin(a) * rr * ry;
    const lightStrand = jit[i * 3 + 2] < 0.45;
    ctx.strokeStyle = rgba(lightStrand ? mix(look.fur, look.light, 0.4) : mix(look.fur, look.dark, 0.55), 0.5);
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.quadraticCurveTo(px + (px - x) * 0.06, py + 6, px + (px - x) * 0.1, py + 9 + jit[i * 3 + 2] * 8);
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
  steel: { coreHex: '#f3f6fa', glowHex: '#d6e2f0', label: 'Parry or dodge' },
  red_gold: { coreHex: '#ffb347', glowHex: '#ff7828', label: 'Dodge' },
  flicker: { coreHex: '#e9d9ff', glowHex: '#e6dcff', label: 'Feint: wait' },
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
export function drawFoe(ctx, L, duel, t, look, light, react) {
  const { cx, floorY, s } = L;
  // ground shadow and the light behind the foe
  ctx.save();
  const sh = ctx.createRadialGradient(cx, floorY, 0, cx, floorY, 120 * s);
  sh.addColorStop(0, 'rgba(0,0,0,0.55)');
  sh.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sh;
  ctx.translate(cx, floorY);
  ctx.scale(1, 0.2);
  ctx.beginPath();
  ctx.arc(0, 0, 120 * s, 0, TAU);
  ctx.fill();
  ctx.restore();
  glow(ctx, cx, floorY - 160 * s, 260 * s, light.back, look.spectral ? 0.32 : 0.2);

  ctx.save();
  ctx.translate(cx, floorY);
  ctx.scale(s, s);
  if (look.spectral) {
    ctx.globalAlpha = 0.86;
    glow(ctx, 0, -170, 210, hex('#ffe9ae'), 0.2);
  }
  const pose = look.kind === 'warg' ? drawWarg(ctx, duel, t, look, light, react) : drawHuman(ctx, duel, t, look, light, react);
  ctx.restore();
  if (look.kind === 'warg' || !pose) return null;
  const sc = (look.build ?? 1) * (1 + pose.lunge);
  return [cx + pose.tip[0] * s * sc, floorY + pose.tip[1] * s * sc];
}
