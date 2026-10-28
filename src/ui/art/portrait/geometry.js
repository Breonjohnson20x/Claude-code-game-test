// Pure geometry for the portraits (no React): head and shoulder outlines, mood
// expressions and the seeded hair-strand generator. All coordinates live in the
// 100×100 portrait viewBox.
import { mulberry32, r1 } from '../util.js';

/** Egg-shaped head. jx/jy = jaw corner, cw = chin width (fractions of rx/ry). */
export function headPath(cx, cy, rx, ry, jx = 0.74, jy = 0.7, cw = 0.26) {
  const n = (v) => r1(v);
  return (
    `M${n(cx)},${n(cy - ry)}` +
    `C${n(cx + rx * 0.56)},${n(cy - ry)} ${n(cx + rx)},${n(cy - ry * 0.6)} ${n(cx + rx)},${n(cy - ry * 0.05)}` +
    `C${n(cx + rx)},${n(cy + ry * 0.32)} ${n(cx + rx * (jx + 0.12))},${n(cy + ry * (jy - 0.18))} ${n(cx + rx * jx)},${n(cy + ry * jy)}` +
    `C${n(cx + rx * (jx - 0.2))},${n(cy + ry * (jy + 0.18))} ${n(cx + rx * cw)},${n(cy + ry)} ${n(cx)},${n(cy + ry)}` +
    `C${n(cx - rx * cw)},${n(cy + ry)} ${n(cx - rx * (jx - 0.2))},${n(cy + ry * (jy + 0.18))} ${n(cx - rx * jx)},${n(cy + ry * jy)}` +
    `C${n(cx - rx * (jx + 0.12))},${n(cy + ry * (jy - 0.18))} ${n(cx - rx)},${n(cy + ry * 0.32)} ${n(cx - rx)},${n(cy - ry * 0.05)}` +
    `C${n(cx - rx)},${n(cy - ry * 0.6)} ${n(cx - rx * 0.56)},${n(cy - ry)} ${n(cx)},${n(cy - ry)}Z`
  );
}

/** Bust outline: shoulders sloping out from a collar line at `top`. */
export const shoulders = (top = 70, spread = 1, cx = 50) =>
  `M${cx - 46 * spread},104C${cx - 44 * spread},${top + 14} ${cx - 32 * spread},${top + 4} ${cx - 14},${top}L${cx + 14},${top}C${cx + 32 * spread},${top + 4} ${cx + 44 * spread},${top + 14} ${cx + 46 * spread},104Z`;

const EXPR = {
  neutral: { bi: 0, bo: 0, mouth: 0, open: 1, blush: 0 },
  grim: { bi: 1.3, bo: -0.3, mouth: -1, open: 0.72, blush: 0 },
  warm: { bi: -0.5, bo: -0.2, mouth: 1, open: 0.88, blush: 0.4 },
  alarmed: { bi: -1.9, bo: -1.1, mouth: 'open', open: 1.35, blush: 0 },
};

/** Mood → brow (inner/outer), mouth curve, eye opening and blush, offset by a character's resting face. */
export function exprFor(mood, base = {}) {
  const e = EXPR[mood] || EXPR.neutral;
  return {
    bi: e.bi + (base.bi || 0),
    bo: e.bo + (base.bo || 0),
    mouth: e.mouth === 'open' ? 'open' : e.mouth + (base.mouth || 0),
    open: e.open * (base.open || 1),
    blush: Math.max(e.blush, base.blush || 0),
  };
}

/**
 * Procedural strand groups: curves fanning out from an origin between angles a0..a1
 * (radians, 0 = right, PI/2 = down). Returns two path strings (shadow strands and lit strands).
 */
export function strands({ x, y, a0, a1, rIn = 0, rOut = 20, n = 18, seed = 1, curl = 2, jitter = 0.25 }) {
  const rnd = mulberry32(seed);
  let dark = '';
  let lite = '';
  for (let i = 0; i < n; i += 1) {
    const t = (i + 0.5 + (rnd() - 0.5) * 0.8) / n;
    const a = a0 + (a1 - a0) * t;
    const r0 = rIn * (0.85 + rnd() * 0.3);
    const r = rOut * (1 - jitter + rnd() * jitter * 2);
    const sx = x + Math.cos(a) * r0;
    const sy = y + Math.sin(a) * r0;
    const ex = x + Math.cos(a) * r;
    const ey = y + Math.sin(a) * r;
    const bend = curl * (0.6 + rnd() * 0.8);
    const mx = (sx + ex) / 2 - Math.sin(a) * bend;
    const my = (sy + ey) / 2 + Math.cos(a) * bend;
    const seg = `M${r1(sx)},${r1(sy)}Q${r1(mx)},${r1(my)} ${r1(ex)},${r1(ey)}`;
    // strands on the lit (right) half of the fan catch the light more often
    if (rnd() < 0.35 + 0.4 * t) lite += seg;
    else dark += seg;
  }
  return [dark, lite];
}
