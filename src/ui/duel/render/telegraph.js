// The telegraph overlay: what the foe is about to do, readable at a glance and in the corner of
// your eye. Red-gold = dodge, steel = parry or dodge, a flicker = a feint (wait). The colour is the
// answer; the shape is the direction the blow comes from.
//
// Telegraphs are painted, not lit: a tapered brush stroke in the warning colour over a dark navy
// under-stroke, so they keep their contrast on a sunset yard and on snow alike and never turn into
// a glowing tube.

import { TAU, hex, lerp, mix, rgba } from './util.js';
import { TELE, teleAlpha } from './foes.js';

const NAVY = [7, 13, 24];

/** A brush stroke along an arc: thin at both ends, full in the middle. */
function brushArc(ctx, x, y, r, a0, a1, width) {
  const n = 28;
  ctx.beginPath();
  for (let i = 0; i <= n; i += 1) {
    const k = i / n;
    const ang = lerp(a0, a1, k);
    const wd = width * 0.5 * (0.12 + 0.88 * Math.sin(Math.PI * k) ** 0.7);
    const px = x + Math.cos(ang) * (r + wd);
    const py = y + Math.sin(ang) * (r + wd);
    if (i) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
  }
  for (let i = n; i >= 0; i -= 1) {
    const k = i / n;
    const ang = lerp(a0, a1, k);
    const wd = width * 0.5 * (0.12 + 0.88 * Math.sin(Math.PI * k) ** 0.7);
    ctx.lineTo(x + Math.cos(ang) * (r - wd), y + Math.sin(ang) * (r - wd));
  }
  ctx.closePath();
}

function crescent(ctx, x, y, r, a0, a1, width, color, core, alpha, dashed) {
  ctx.save();
  ctx.lineJoin = 'round';
  if (dashed) {
    // the feint: a broken stroke
    ctx.lineCap = 'round';
    ctx.setLineDash([width * 1.8, width * 1.6]);
    ctx.beginPath();
    ctx.arc(x, y, r, a0, a1);
    ctx.strokeStyle = rgba(NAVY, 0.55 * alpha);
    ctx.lineWidth = width * 1.15 + 3;
    ctx.stroke();
    ctx.strokeStyle = rgba(color, 0.9 * alpha);
    ctx.lineWidth = width * 0.8;
    ctx.stroke();
    ctx.restore();
    return;
  }
  // the dark under-stroke, then the colour, then a fine bright core along the middle
  brushArc(ctx, x, y, r, a0, a1, width * 1.25 + 4);
  ctx.fillStyle = rgba(NAVY, 0.55 * alpha);
  ctx.fill();
  brushArc(ctx, x, y, r, a0, a1, width);
  ctx.fillStyle = rgba(color, 0.92 * alpha);
  ctx.fill();
  brushArc(ctx, x, y, r - width * 0.08, a0 + 0.05, a1 - 0.05, width * 0.28);
  ctx.fillStyle = rgba(mix(core, [255, 250, 240], 0.3), 0.85 * alpha);
  ctx.fill();
  ctx.restore();
}

function chevron(ctx, x, y, size, dirX, dirY, color, alpha) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const px = -dirY;
  const py = dirX;
  ctx.beginPath();
  ctx.moveTo(x - dirX * size + px * size, y - dirY * size + py * size);
  ctx.lineTo(x, y);
  ctx.lineTo(x - dirX * size - px * size, y - dirY * size - py * size);
  ctx.strokeStyle = rgba(NAVY, 0.5 * alpha);
  ctx.lineWidth = size * 0.28 + 3;
  ctx.stroke();
  ctx.strokeStyle = rgba(color, alpha);
  ctx.lineWidth = size * 0.28;
  ctx.stroke();
  ctx.restore();
}

export function drawTelegraph(ctx, L, duel, t, motion) {
  const tg = duel.telegraph;
  if (!tg) return;
  const { w, h, cx, s } = L;
  const spec = TELE[tg.telegraphColor];
  const color = hex(spec.glowHex);
  const core = hex(spec.coreHex);
  const a = teleAlpha(tg, t);
  const p = tg.progress;
  const width = (5 + 7 * p + (tg.isHeavy ? 4 : 0)) * s;
  const midY = L.floorY - 170 * s;
  if (tg.dir === 'left' || tg.dir === 'right') {
    const sx = tg.dir === 'left' ? -1 : 1;
    const r = Math.min(h * 0.2, w * 0.24);
    const x = cx + sx * Math.min(w * 0.34, w / 2 - r - 10 * s);
    const a0 = sx < 0 ? Math.PI * 0.6 : -Math.PI * 0.4;
    const a1 = sx < 0 ? Math.PI * 1.4 : Math.PI * 0.4;
    crescent(ctx, x, midY, r, a0, a1, width, color, core, a, tg.isFeint);
    // the blow's path: chevrons marching toward the centre
    const march = motion ? (t * 1.6) % 1 : 0.5;
    for (let i = 0; i < 3; i += 1) {
      const k = (i / 3 + march) % 1;
      const xx = lerp(x - sx * r * 0.2, cx + sx * 30 * s, k);
      chevron(ctx, xx, midY, (12 + 6 * p) * s, -sx, 0, core, a * (0.35 + 0.65 * (1 - k)));
    }
  } else if (tg.dir === 'overhead') {
    const r = w * 0.34;
    crescent(ctx, cx, midY + r * 0.35, r, Math.PI * 1.18, Math.PI * 1.82, width, color, core, a, tg.isFeint);
    const march = motion ? (t * 1.6) % 1 : 0.5;
    for (let i = 0; i < 3; i += 1) {
      const k = (i / 3 + march) % 1;
      chevron(ctx, cx, lerp(midY - r * 0.55, midY + 30 * s, k), (12 + 6 * p) * s, 0, 1, core, a * (0.35 + 0.65 * (1 - k)));
    }
  } else {
    // thrust: rings closing in on you, around the point
    const r = lerp(Math.min(w, h) * 0.42, 34 * s, p);
    ctx.save();
    if (tg.isFeint) ctx.setLineDash([width * 1.8, width * 1.6]);
    for (const [rr, al] of [[r, 0.9], [r * 1.35, 0.4], [r * 1.8, 0.18]]) {
      const lw = width * (al > 0.5 ? 0.8 : 0.55);
      ctx.beginPath();
      ctx.arc(cx, midY + 20 * s, rr, 0, TAU);
      ctx.strokeStyle = rgba(NAVY, 0.5 * al * a);
      ctx.lineWidth = lw + 3;
      ctx.stroke();
      ctx.strokeStyle = rgba(color, al * a);
      ctx.lineWidth = lw;
      ctx.stroke();
    }
    ctx.restore();
  }
  // heavy: the frame itself warms, a pulse you feel before you read it
  if (tg.isHeavy) {
    const g = ctx.createRadialGradient(cx, h * 0.5, Math.min(w, h) * 0.32, cx, h * 0.5, Math.max(w, h) * 0.78);
    g.addColorStop(0, 'rgba(255,120,40,0)');
    g.addColorStop(1, `rgba(255,110,30,${0.3 * p * a})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
}
