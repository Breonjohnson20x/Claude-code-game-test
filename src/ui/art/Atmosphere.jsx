// Atmosphere shared by the title and the War Room: soft shafts of light falling from above and
// dust motes drifting in warm light. Decorative only (aria-hidden).
//
// Performance contract (these sit over animated scenes on phones): the light shafts are a static
// SVG (rasterised once, never animated, no blend modes), and the motes are one small canvas at
// device-pixel-ratio 1, stepped at most 30 times a second, paused offscreen or hidden, a single
// still frame under reduced motion, and a 0×0 layout never steps the loop.

import { memo, useEffect, useRef } from 'react';
import { mulberry32, useReducedMotion, useUid, watchVisibility } from './util.js';

const cx = (...a) => a.filter(Boolean).join(' ');

// ------------------------------------------------------------------ light shafts
/**
 * A few soft, feathered shafts of light falling in a narrow cone from a point above the box
 * (the top centre, nudged by `originX`), fading to nothing before the bottom edge. Static.
 * `strength` is the peak opacity of the brightest shaft.
 */
export const LightRays = memo(function LightRays({ className, style, rays = 5, color = '255 233 174', strength = 0.22, originX = 0.56, spread = 26, seed = 7 }) {
  const id = useUid('lr');
  const rnd = mulberry32(seed * 31 + rays);
  const ox = 200 * originX;
  const oy = -40;
  const shafts = [];
  for (let i = 0; i < rays; i += 1) {
    // uneven spacing and widths: a cone, not a sunburst
    const f = rays === 1 ? 0 : i / (rays - 1) - 0.5;
    const ang = ((f * spread * 2 + (rnd() - 0.5) * spread * 0.35) * Math.PI) / 180;
    const half = ((2.2 + rnd() * 4.2) * Math.PI) / 180;
    const len = 250;
    const p = (a) => [ox + Math.sin(a) * len, oy + Math.cos(a) * len];
    const [x1, y1] = p(ang - half);
    const [x2, y2] = p(ang + half);
    shafts.push({ d: `M${ox.toFixed(1)},${oy}L${x1.toFixed(1)},${y1.toFixed(1)}L${x2.toFixed(1)},${y2.toFixed(1)}Z`, o: 0.45 + rnd() * 0.55 });
  }
  return (
    <div className={cx('pointer-events-none', className)} style={style} aria-hidden="true">
      <svg viewBox="0 0 200 200" width="100%" height="100%" preserveAspectRatio="none" style={{ display: 'block', overflow: 'visible' }} focusable="false">
        <defs>
          <linearGradient id={`${id}-fall`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={`rgb(${color})`} stopOpacity={strength} />
            <stop offset="0.4" stopColor={`rgb(${color})`} stopOpacity={strength * 0.55} />
            <stop offset="0.78" stopColor={`rgb(${color})`} stopOpacity={strength * 0.12} />
            <stop offset="1" stopColor={`rgb(${color})`} stopOpacity="0" />
          </linearGradient>
          <filter id={`${id}-soft`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3.2" />
          </filter>
        </defs>
        <g fill={`url(#${id}-fall)`} filter={`url(#${id}-soft)`}>
          {shafts.map((s, i) => (
            <path key={i} d={s.d} opacity={s.o} />
          ))}
        </g>
      </svg>
    </div>
  );
});

// ------------------------------------------------------------------ dust motes
function moteSprite(rgb) {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 32;
  const g = c.getContext('2d');
  if (!g) return null;
  const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grd.addColorStop(0, `rgba(${rgb},1)`);
  grd.addColorStop(0.25, `rgba(${rgb},0.55)`);
  grd.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = grd;
  g.fillRect(0, 0, 32, 32);
  return c;
}

const STEP_MS = 1000 / 30; // motes drift slowly; 30 steps a second is indistinguishable

/**
 * Dust motes drifting in warm light, on a small canvas that fills its positioned parent.
 * `shaft` confines them to a diagonal band: { top, bottom, width } as fractions of the width
 * (centre x at the top and bottom edges). Keep the parent as small as the effect needs.
 */
export const Motes = memo(function Motes({ count = 18, color = '255,233,174', shaft = null, seed = 11, className, opacity = 1, rise = 1 }) {
  const ref = useRef(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    const cv = ref.current;
    if (!cv || typeof window === 'undefined') return undefined;
    const ctx = cv.getContext('2d');
    if (!ctx) return undefined;
    const sprite = moteSprite(color);
    if (!sprite) return undefined;
    const rnd = mulberry32(seed);
    const ps = Array.from({ length: count }, () => ({
      x: rnd(),
      y: rnd(),
      z: 0.35 + rnd() * 0.65, // depth: size, speed, brightness
      ph: rnd() * Math.PI * 2,
      tw: 0.6 + rnd() * 1.6,
    }));
    let w = 0;
    let h = 0;
    let raf = 0;
    let last = 0;
    let acc = 0;
    let running = false;
    let t = 0;

    const measure = () => {
      const nw = Math.round(cv.clientWidth);
      const nh = Math.round(cv.clientHeight);
      if (nw < 2 || nh < 2) return false;
      if (nw !== w || nh !== h) {
        w = nw;
        h = nh;
        cv.width = w; // DPR 1: soft blobs gain nothing from more pixels
        cv.height = h;
      }
      return true;
    };

    const inShaft = (x, y) => {
      if (!shaft) return 1;
      const cxs = shaft.top + (shaft.bottom - shaft.top) * y;
      const d = Math.abs(x - cxs) / (shaft.width * 0.5);
      return d >= 1 ? 0 : (1 - d * d) * (0.35 + 0.65 * (1 - y));
    };

    const draw = () => {
      if (!w || !h) return;
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      const base = Math.min(1.5, Math.max(1, Math.min(w, h) / 520));
      for (const p of ps) {
        const a = inShaft(p.x, p.y) * (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * p.tw + p.ph))) * p.z * opacity;
        if (a < 0.02) continue;
        const s = base * (1.3 + p.z * 2.6);
        ctx.globalAlpha = Math.min(1, a);
        ctx.drawImage(sprite, p.x * w - s, p.y * h - s, s * 2, s * 2);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    };

    const advance = (dt) => {
      t += dt;
      for (const p of ps) {
        p.y -= dt * 0.012 * rise * (0.4 + p.z);
        p.x += dt * 0.006 * Math.sin(t * 0.4 + p.ph) * p.z;
        if (p.y < -0.03) {
          p.y = 1.03;
          p.x = rnd();
        }
        if (p.x < -0.03) p.x = 1.03;
        if (p.x > 1.03) p.x = -0.03;
      }
    };

    const step = (now) => {
      raf = 0;
      if (!running) return;
      raf = requestAnimationFrame(step);
      const ms = last ? now - last : STEP_MS;
      last = now;
      acc += Math.min(100, ms);
      if (acc < STEP_MS - 1) return;
      const dt = Math.min(0.1, acc / 1000);
      acc = 0;
      if (!measure()) return;
      advance(dt);
      draw();
    };

    const start = () => {
      if (running || reduced) return;
      running = true;
      last = 0;
      acc = 0;
      raf = requestAnimationFrame(step);
    };
    const stop = () => {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };

    const still = () => {
      if (measure()) draw();
    };
    still();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => (running ? null : still())) : null;
    ro?.observe(cv);
    const unwatch = reduced ? () => {} : watchVisibility(cv, (v) => (v ? start() : stop()));
    return () => {
      stop();
      unwatch();
      ro?.disconnect();
    };
  }, [count, color, shaft, seed, reduced, opacity, rise]);
  return <canvas ref={ref} aria-hidden="true" className={cx('pointer-events-none absolute inset-0 h-full w-full', className)} />;
});
