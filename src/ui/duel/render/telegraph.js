// The telegraph overlay: what the foe is about to do, readable at a glance and in the corner of
// your eye. Red-gold = dodge, steel = parry or dodge, a flicker = a feint (wait). The colour is the
// answer; the shape is the direction the blow comes from.

import { TAU, glow, hex, lerp, rgba } from './util.js';
import { TELE, teleAlpha } from './foes.js';

function crescent(ctx, x, y, r, a0, a1, width, color, alpha, dashed) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  if (dashed) ctx.setLineDash([width * 1.8, width * 1.6]);
  ctx.strokeStyle = rgba(color, 0.22 * alpha);
  ctx.lineWidth = width * 3.2;
  ctx.beginPath();
  ctx.arc(x, y, r, a0, a1);
  ctx.stroke();
  ctx.strokeStyle = rgba(color, 0.55 * alpha);
  ctx.lineWidth = width * 1.6;
  ctx.stroke();
  ctx.strokeStyle = rgba([255, 255, 255], 0.85 * alpha);
  ctx.lineWidth = width * 0.45;
  ctx.stroke();
  ctx.restore();
}

function chevron(ctx, x, y, size, dirX, dirY, color, alpha) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = rgba(color, alpha);
  ctx.lineWidth = size * 0.28;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const px = -dirY;
  const py = dirX;
  ctx.beginPath();
  ctx.moveTo(x - dirX * size + px * size, y - dirY * size + py * size);
  ctx.lineTo(x, y);
  ctx.lineTo(x - dirX * size - px * size, y - dirY * size - py * size);
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
  const width = (5 + 8 * p + (tg.isHeavy ? 5 : 0)) * s;
  const midY = L.floorY - 170 * s;
  if (tg.dir === 'left' || tg.dir === 'right') {
    const sx = tg.dir === 'left' ? -1 : 1;
    const r = Math.min(h * 0.2, w * 0.24);
    const x = cx + sx * Math.min(w * 0.34, w / 2 - r - 10 * s);
    const a0 = sx < 0 ? Math.PI * 0.6 : -Math.PI * 0.4;
    const a1 = sx < 0 ? Math.PI * 1.4 : Math.PI * 0.4;
    crescent(ctx, x, midY, r, a0, a1, width, color, a, tg.isFeint);
    // the blow's path: chevrons marching toward the centre
    const march = motion ? (t * 1.6) % 1 : 0.5;
    for (let i = 0; i < 3; i += 1) {
      const k = (i / 3 + march) % 1;
      const xx = lerp(x - sx * r * 0.2, cx + sx * 30 * s, k);
      chevron(ctx, xx, midY, (12 + 6 * p) * s, -sx, 0, core, a * (0.35 + 0.65 * (1 - k)));
    }
  } else if (tg.dir === 'overhead') {
    const r = w * 0.34;
    crescent(ctx, cx, midY + r * 0.35, r, Math.PI * 1.18, Math.PI * 1.82, width, color, a, tg.isFeint);
    const march = motion ? (t * 1.6) % 1 : 0.5;
    for (let i = 0; i < 3; i += 1) {
      const k = (i / 3 + march) % 1;
      chevron(ctx, cx, lerp(midY - r * 0.55, midY + 30 * s, k), (12 + 6 * p) * s, 0, 1, core, a * (0.35 + 0.65 * (1 - k)));
    }
  } else {
    // thrust: rings closing in on you, around the point
    const r = lerp(Math.min(w, h) * 0.42, 34 * s, p);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (tg.isFeint) ctx.setLineDash([width * 1.8, width * 1.6]);
    for (const [rr, al] of [[r, 0.9], [r * 1.35, 0.4], [r * 1.8, 0.18]]) {
      ctx.strokeStyle = rgba(color, al * a);
      ctx.lineWidth = width * (al > 0.5 ? 1 : 0.7);
      ctx.beginPath();
      ctx.arc(cx, midY + 20 * s, rr, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
    glow(ctx, cx, midY + 20 * s, 60 * s, color, 0.35 * a * p);
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
