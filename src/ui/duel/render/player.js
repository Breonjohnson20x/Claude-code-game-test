// The Sovereign's side of the frame: the blade in a gauntleted hand, the Shield Ward, the guard.
// The blade swings along the strike you made and leaves a crescent of light behind it.

import { TAU, clamp01, easeOut, glow, hex, lerp, mix, rgba } from './util.js';

const STEEL = hex('#d8dde4');
const GOLD = hex('#c9a227');

function bladeAngle(p, guarding) {
  if (p.swingMs > 0 && p.swingDurMs > 0) {
    const k = easeOut(1 - p.swingMs / p.swingDurMs);
    const d = p.swingDir;
    if (d === 'left') return { a: lerp(0.7, -1.9, k), k, d };
    if (d === 'right') return { a: lerp(-1.5, 1.0, k), k, d };
    if (d === 'down') return { a: lerp(-1.4, 0.4, k), k, d };
    return { a: lerp(0.2, -1.4, k), k, d };
  }
  if (guarding) return { a: -1.32, k: 0, d: null };
  return { a: -0.2, k: 0, d: null };
}

/** Draw the blade. `hist` is the renderer's short history of blade angles, for the swing trail. */
export function drawPlayer(ctx, L, duel, t, guarding, hist, motion) {
  const { w, h, cx, s, bladeY } = L;
  const p = duel.player;

  // Shield Ward: a dome of lattice light rising from below
  if (p.wardHeld && p.wardBrokenMs <= 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const r = Math.min(w * 0.66, h * 0.58);
    const g = ctx.createRadialGradient(cx, h * 1.04, r * 0.6, cx, h * 1.04, r);
    g.addColorStop(0, 'rgba(255,233,174,0)');
    g.addColorStop(0.9, 'rgba(255,217,122,0.2)');
    g.addColorStop(1, 'rgba(255,217,122,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,224,150,0.6)';
    ctx.lineWidth = 2.4 * s;
    ctx.beginPath();
    ctx.arc(cx, h * 1.04, r, Math.PI * 1.04, Math.PI * 1.96);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,224,150,0.18)';
    for (let i = 1; i < 6; i += 1) {
      const a = Math.PI * (1.04 + (0.92 * i) / 6);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r * 0.55, h * 1.04 + Math.sin(a) * r * 0.55);
      ctx.lineTo(cx + Math.cos(a) * r, h * 1.04 + Math.sin(a) * r);
      ctx.stroke();
    }
    ctx.restore();
  }

  const { a: angle, k: swingK, d: swingDir } = bladeAngle(p, guarding);
  let ox = 0;
  let oy = 0;
  if (guarding) {
    ox = -58 * s;
    oy = -70 * s;
  }
  if (swingDir) oy = -50 * s * Math.sin(swingK * Math.PI);
  if (p.dodge.active) ox += (p.dodge.side === 'left' ? -1 : 1) * 30 * s;
  if (p.stunMs > 0 && motion) {
    ox += Math.sin(t * 50) * 4 * s;
    oy += 18 * s;
  }
  const idle = motion ? Math.sin(t * 1.8) * 4 * s : 0;
  const bx = cx + 108 * s + ox;
  const by = bladeY + oy + idle;
  const len = Math.min(h * (L.phone ? 0.27 : 0.34), 250 * s);

  // swing trail: a crescent of light along the recent arc
  hist.push({ a: angle, x: bx, y: by, at: t });
  while (hist.length && t - hist[0].at > 0.16) hist.shift();
  if (swingDir && hist.length > 2 && motion) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 1; i < hist.length; i += 1) {
      const h0 = hist[i - 1];
      const h1 = hist[i];
      const fade = i / hist.length;
      ctx.fillStyle = rgba(hex('#fff2d0'), 0.32 * fade);
      ctx.beginPath();
      ctx.moveTo(h0.x + Math.sin(h0.a) * len * 0.3, h0.y - Math.cos(h0.a) * len * 0.3);
      ctx.lineTo(h0.x + Math.sin(h0.a) * len, h0.y - Math.cos(h0.a) * len);
      ctx.lineTo(h1.x + Math.sin(h1.a) * len, h1.y - Math.cos(h1.a) * len);
      ctx.lineTo(h1.x + Math.sin(h1.a) * len * 0.3, h1.y - Math.cos(h1.a) * len * 0.3);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  ctx.save();
  ctx.translate(bx, by);
  ctx.rotate(angle);
  if (guarding) glow(ctx, 0, -len * 0.5, len * 0.75, hex('#ffe9ae'), 0.22);
  // gauntlet
  const gg = ctx.createLinearGradient(-26 * s, 0, 26 * s, 0);
  gg.addColorStop(0, rgba(hex('#1c1f26')));
  gg.addColorStop(0.55, rgba(hex('#4a505c')));
  gg.addColorStop(0.9, rgba(hex('#a8adb6')));
  gg.addColorStop(1, rgba(hex('#4a505c')));
  ctx.fillStyle = gg;
  ctx.beginPath();
  ctx.moveTo(-22 * s, 20 * s);
  ctx.quadraticCurveTo(-26 * s, 70 * s, -12 * s, 150 * s);
  ctx.lineTo(28 * s, 150 * s);
  ctx.quadraticCurveTo(30 * s, 70 * s, 22 * s, 20 * s);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = rgba(GOLD, 0.8);
  ctx.lineWidth = 2 * s;
  for (const yy of [46, 70, 94]) {
    ctx.beginPath();
    ctx.moveTo(-22 * s, yy * s);
    ctx.quadraticCurveTo(2 * s, (yy + 6) * s, 24 * s, yy * s);
    ctx.stroke();
  }
  // knuckles over the grip
  ctx.fillStyle = rgba(hex('#2a2e36'));
  ctx.beginPath();
  ctx.ellipse(0, 26 * s, 22 * s, 16 * s, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = rgba(hex('#8f949e'), 0.6);
  ctx.beginPath();
  ctx.ellipse(6 * s, 20 * s, 12 * s, 6 * s, 0, 0, TAU);
  ctx.fill();
  // crossguard with a gem
  const cg = ctx.createLinearGradient(0, -12 * s, 0, 4 * s);
  cg.addColorStop(0, rgba(hex('#f6e9bd')));
  cg.addColorStop(1, rgba(hex('#7d6114')));
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.moveTo(-40 * s, -4 * s);
  ctx.quadraticCurveTo(-46 * s, -14 * s, -36 * s, -12 * s);
  ctx.lineTo(36 * s, -12 * s);
  ctx.quadraticCurveTo(46 * s, -14 * s, 40 * s, -4 * s);
  ctx.lineTo(0, 2 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = rgba(hex('#b4532a'));
  ctx.beginPath();
  ctx.arc(0, -6 * s, 5 * s, 0, TAU);
  ctx.fill();
  glow(ctx, 0, -6 * s, 10 * s, hex('#f4a35e'), 0.4);
  // blade: bevelled steel with a fuller and a running glint
  const bg = ctx.createLinearGradient(-12 * s, 0, 12 * s, 0);
  bg.addColorStop(0, rgba(mix(STEEL, hex('#30343c'), 0.6)));
  bg.addColorStop(0.48, rgba(STEEL));
  bg.addColorStop(0.52, rgba(hex('#ffffff')));
  bg.addColorStop(1, rgba(mix(STEEL, hex('#30343c'), 0.45)));
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.moveTo(-11 * s, -12 * s);
  ctx.lineTo(-8 * s, -len + 30 * s);
  ctx.lineTo(0, -len);
  ctx.lineTo(8 * s, -len + 30 * s);
  ctx.lineTo(11 * s, -12 * s);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = rgba(GOLD, 0.75);
  ctx.lineWidth = 2.2 * s;
  ctx.beginPath();
  ctx.moveTo(0, -16 * s);
  ctx.lineTo(0, -len + 48 * s);
  ctx.stroke();
  const glintK = motion ? clamp01((Math.sin(t * 0.9) + 1) / 2) : 0.5;
  glow(ctx, 0, lerp(-30 * s, -len + 30 * s, glintK), 26 * s, hex('#ffffff'), swingDir ? 0.6 : 0.22);
  ctx.restore();
}
