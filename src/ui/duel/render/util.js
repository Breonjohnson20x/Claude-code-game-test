// Small drawing helpers shared by the duel renderer. Colours are [r, g, b] arrays so they can be
// mixed and lit; `rgba(c, a)` turns one into a CSS colour.

export const TAU = Math.PI * 2;
export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const easeOut = (t) => 1 - (1 - t) * (1 - t);
export const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2);
export const smooth = (t) => t * t * (3 - 2 * t);

export function hex(h) {
  const n = h.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
}

export function mix(a, b, t) {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

export function rgba(c, a = 1) {
  return `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;
}

/** Light a base colour: shade toward `shadow` (t<0) or `light` (t>0). */
export function lit(base, light, shadow, t) {
  return t >= 0 ? mix(base, light, t) : mix(base, shadow, -t);
}

/** Seeded PRNG (mulberry32); art placement only, never game logic. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashStr(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A soft radial glow (additive when `add`). */
export function glow(ctx, x, y, r, color, a, add = true) {
  if (r <= 0 || a <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, a));
  g.addColorStop(0.4, rgba(color, a * 0.45));
  g.addColorStop(1, rgba(color, 0));
  const prev = ctx.globalCompositeOperation;
  if (add) ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.globalCompositeOperation = prev;
}

/** Vertical gradient fill of a rect. stops: [[t, color, alpha?], ...] */
export function vgrad(ctx, x, y, w, h, stops) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  for (const [t, c, a = 1] of stops) g.addColorStop(t, rgba(c, a));
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}

/** A jagged ridge (mountains, treelines) filled to the bottom of the canvas. */
export function ridge(ctx, w, h, { base, amp, step, seed, color, alpha = 1, rough = 0.5, peaks = 0 }) {
  const r = rng(seed);
  ctx.fillStyle = rgba(color, alpha);
  ctx.beginPath();
  ctx.moveTo(-10, h + 10);
  let y = base - r() * amp;
  for (let x = -10; x <= w + step; x += step) {
    const target = base - amp * (0.35 + 0.65 * r());
    y = lerp(y, target, rough);
    const spike = peaks && r() < peaks ? amp * 0.6 * r() : 0;
    ctx.lineTo(x, y - spike);
  }
  ctx.lineTo(w + 10, h + 10);
  ctx.closePath();
  ctx.fill();
}

/** A conifer silhouette, optionally snow-laden. */
export function pine(ctx, x, base, hgt, color, snow = null) {
  const tiers = 5;
  const wid = hgt * 0.42;
  ctx.fillStyle = rgba(color);
  ctx.fillRect(x - hgt * 0.02, base - hgt * 0.12, hgt * 0.04, hgt * 0.12);
  for (let i = 0; i < tiers; i += 1) {
    const top = base - hgt + (i * hgt) / (tiers + 0.6);
    const bottom = top + hgt / 2.6;
    const ww = wid * (0.35 + (0.65 * (i + 1)) / tiers);
    ctx.fillStyle = rgba(color);
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x + ww / 2, bottom);
    ctx.lineTo(x - ww / 2, bottom);
    ctx.closePath();
    ctx.fill();
    if (snow) {
      ctx.fillStyle = rgba(snow[0], snow[1]);
      ctx.beginPath();
      ctx.moveTo(x, top + 1);
      ctx.lineTo(x + ww * 0.32, bottom - (bottom - top) * 0.32);
      ctx.lineTo(x + ww * 0.08, bottom - (bottom - top) * 0.42);
      ctx.lineTo(x - ww * 0.3, bottom - (bottom - top) * 0.3);
      ctx.closePath();
      ctx.fill();
    }
  }
}

/** Rounded rectangle path. */
export function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
