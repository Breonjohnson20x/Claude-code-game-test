// Ornate presentation pieces shared by the War Room, the Resolution report, the Passing and the
// title: engraved letter medallions, category accents, filigree rules, light rays and a dust-mote
// canvas. Decorative only (aria-hidden); no game logic lives here.

import { memo, useEffect, useRef } from 'react';
import { mulberry32, useReducedMotion, useUid, watchVisibility } from '../../art/util.js';
import { cx } from '../../kit/kit.jsx';

// ------------------------------------------------------------------ category accents
// Every accent is a theme token (theme.css), never a new hue.
export const CATEGORY_TONE = {
  diplomacy: { accent: '#f0dc95', deep: '#7d6114', glow: '227 196 99', text: 'text-gold-300', name: 'gold' },
  military: { accent: '#d9726b', deep: '#7a1f1a', glow: '194 65 58', text: 'text-crimson-300', name: 'crimson' },
  clandestine: { accent: '#c3c7cc', deep: '#33373d', glow: '154 160 168', text: 'text-iron-200', name: 'iron' },
  research: { accent: '#ffe9ae', deep: '#7d6114', glow: '255 233 174', text: 'text-lattice-300', name: 'lattice' },
  economic: { accent: '#f4a35e', deep: '#8a3a1c', glow: '224 120 43', text: 'text-ember-300', name: 'ember' },
};

export function categoryTone(category) {
  const first = String(category ?? '').split('+')[0];
  return CATEGORY_TONE[first] ?? CATEGORY_TONE.diplomacy;
}

// ------------------------------------------------------------------ medallion
const KNURL = (() => {
  let d = '';
  for (let i = 0; i < 48; i += 1) {
    const a = (i / 48) * Math.PI * 2;
    const r0 = 45.2;
    const r1 = i % 4 === 0 ? 41.6 : 43.4;
    d += `M${(50 + Math.cos(a) * r0).toFixed(2)},${(50 + Math.sin(a) * r0).toFixed(2)}L${(50 + Math.cos(a) * r1).toFixed(2)},${(50 + Math.sin(a) * r1).toFixed(2)}`;
  }
  return d;
})();

/**
 * A struck brass medallion with an engraved letter (order keys A–E, step numerals).
 * `tone` is a CATEGORY_TONE entry (accent ring); `lit` brightens it for the selected state.
 */
export const Medallion = memo(function Medallion({ letter, size = 60, tone = CATEGORY_TONE.diplomacy, lit = false, dim = false, className }) {
  const id = useUid('md');
  const fs = String(letter).length > 2 ? 26 : String(letter).length > 1 ? 32 : 40;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
      className={cx('shrink-0 overflow-visible', className)}
      style={{ filter: dim ? 'saturate(0.35) brightness(0.75)' : undefined }}
    >
      <defs>
        <linearGradient id={`${id}-rim`} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0" stopColor="#fbefc2" />
          <stop offset="0.28" stopColor="#e3c463" />
          <stop offset="0.6" stopColor="#a8841b" />
          <stop offset="1" stopColor="#4f3d0d" />
        </linearGradient>
        <linearGradient id={`${id}-rim2`} x1="0.85" y1="1" x2="0.15" y2="0">
          <stop offset="0" stopColor="#f6e9bd" />
          <stop offset="0.45" stopColor="#a8841b" />
          <stop offset="1" stopColor="#4f3d0d" />
        </linearGradient>
        <radialGradient id={`${id}-field`} cx="38%" cy="30%" r="80%">
          <stop offset="0" stopColor={lit ? '#2b4268' : '#1f3150'} />
          <stop offset="0.6" stopColor="#0f1b2d" />
          <stop offset="1" stopColor="#070d18" />
        </radialGradient>
        <linearGradient id={`${id}-letter`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fffaf0" />
          <stop offset="0.42" stopColor="#f0dc95" />
          <stop offset="1" stopColor="#a8841b" />
        </linearGradient>
        <radialGradient id={`${id}-glow`} cx="50%" cy="50%" r="50%">
          <stop offset="0.55" stopColor={`rgb(${tone.glow})`} stopOpacity="0.55" />
          <stop offset="1" stopColor={`rgb(${tone.glow})`} stopOpacity="0" />
        </radialGradient>
      </defs>
      {lit ? <circle cx="50" cy="50" r="62" fill={`url(#${id}-glow)`} /> : null}
      {/* cast shadow */}
      <circle cx="51.5" cy="54" r="47" fill="#000" opacity="0.5" />
      {/* rim, knurled edge, bevel */}
      <circle cx="50" cy="50" r="47" fill={`url(#${id}-rim)`} />
      <path d={KNURL} stroke="#4f3d0d" strokeWidth="1.1" opacity="0.55" />
      <circle cx="50" cy="50" r="40.5" fill={`url(#${id}-rim2)`} />
      {/* category accent ring */}
      <circle cx="50" cy="50" r="38.2" fill="none" stroke={tone.accent} strokeWidth="2.2" opacity={lit ? 1 : 0.75} />
      {/* enamel field */}
      <circle cx="50" cy="50" r="36" fill={`url(#${id}-field)`} />
      <circle cx="50" cy="50" r="36" fill="none" stroke="#000" strokeOpacity="0.6" strokeWidth="1.4" />
      <circle cx="50" cy="50" r="31" fill="none" stroke="#c9a227" strokeOpacity="0.35" strokeWidth="0.6" strokeDasharray="1 2.6" />
      {/* engraved letter: shadow, then a gilt face, then a top highlight */}
      <text x="50" y="51" dy="0.35em" textAnchor="middle" fontFamily="Cinzel, Georgia, serif" fontWeight="700" fontSize={fs} fill="#000" opacity="0.75" transform="translate(0.8 1.6)">
        {letter}
      </text>
      <text x="50" y="51" dy="0.35em" textAnchor="middle" fontFamily="Cinzel, Georgia, serif" fontWeight="700" fontSize={fs} fill={`url(#${id}-letter)`} stroke="#4f3d0d" strokeWidth="0.6">
        {letter}
      </text>
      {/* specular sweep on the rim (key light upper right) */}
      <path d="M62 8.5a42 42 0 0 1 29 30" fill="none" stroke="#fffaf0" strokeOpacity="0.75" strokeWidth="2" strokeLinecap="round" />
      <path d="M14 70a42 42 0 0 0 12 14" fill="none" stroke="#fffaf0" strokeOpacity="0.2" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
});

// ------------------------------------------------------------------ filigree rule
/** A gilt hairline with a lozenge and scroll curls. Decorative, stretches to its box. */
export function Filigree({ className, color = '#c9a227', center = true }) {
  return (
    <div className={cx('flex items-center gap-2', className)} aria-hidden="true">
      <span className="h-px flex-1" style={{ background: `linear-gradient(90deg, transparent, ${color}aa)` }} />
      {center ? (
        <svg width="74" height="14" viewBox="0 0 74 14" fill="none" stroke={color} strokeWidth="1" strokeLinecap="round">
          <path d="M2 7h14c4 0 5-4 8-4s3 3 1 4-3 0-3-1" opacity="0.8" />
          <path d="M72 7H58c-4 0-5-4-8-4s-3 3-1 4 3 0 3-1" opacity="0.8" />
          <path d="M37 1.5 42.5 7 37 12.5 31.5 7Z" fill={color} fillOpacity="0.85" stroke="#fbefc2" strokeOpacity="0.6" strokeWidth="0.6" />
          <circle cx="27.5" cy="7" r="1.1" fill={color} stroke="none" />
          <circle cx="46.5" cy="7" r="1.1" fill={color} stroke="none" />
        </svg>
      ) : null}
      <span className="h-px flex-1" style={{ background: `linear-gradient(270deg, transparent, ${color}aa)` }} />
    </div>
  );
}

// ------------------------------------------------------------------ light rays
/** Soft god-rays fanning from a point (SVG, cheap). Rotates very slowly unless reduced motion. */
export const LightRays = memo(function LightRays({ className, style, rays = 18, color = '255 233 174', strength = 0.16, spin = true }) {
  const id = useUid('lr');
  const reduced = useReducedMotion();
  const rnd = mulberry32(rays * 13 + 5);
  const wedges = [];
  for (let i = 0; i < rays; i += 1) {
    const a = (i / rays) * Math.PI * 2 + rnd() * 0.12;
    const w = 0.02 + rnd() * 0.05;
    const r = 100;
    const x1 = 100 + Math.cos(a - w) * r;
    const y1 = 100 + Math.sin(a - w) * r;
    const x2 = 100 + Math.cos(a + w) * r;
    const y2 = 100 + Math.sin(a + w) * r;
    wedges.push({ d: `M100,100L${x1.toFixed(1)},${y1.toFixed(1)}L${x2.toFixed(1)},${y2.toFixed(1)}Z`, o: 0.45 + rnd() * 0.55 });
  }
  return (
    <div className={cx('pointer-events-none', className)} style={style} aria-hidden="true">
      <svg
        viewBox="0 0 200 200"
        width="100%"
        height="100%"
        style={{ display: 'block', animation: spin && !reduced ? 'orn-spin 140s linear infinite' : 'none' }}
        focusable="false"
      >
        <defs>
          <radialGradient id={`${id}-fade`} cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor={`rgb(${color})`} stopOpacity={strength * 2.2} />
            <stop offset="0.2" stopColor={`rgb(${color})`} stopOpacity={strength * 1.2} />
            <stop offset="0.55" stopColor={`rgb(${color})`} stopOpacity={strength * 0.35} />
            <stop offset="1" stopColor={`rgb(${color})`} stopOpacity="0" />
          </radialGradient>
        </defs>
        <g fill={`url(#${id}-fade)`}>
          {wedges.map((w, i) => (
            <path key={i} d={w.d} opacity={w.o} />
          ))}
        </g>
      </svg>
      <style>{'@keyframes orn-spin{to{transform:rotate(360deg)}}'}</style>
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

/**
 * Dust motes drifting in warm light, on a small canvas that fills its positioned parent.
 * `shaft` confines them to a diagonal band: { top, bottom, width } as fractions of the width
 * (centre x at the top and bottom edges). DPR capped at 2, paused offscreen or hidden,
 * one still frame under reduced motion, and a 0×0 layout never steps the loop.
 */
export const Motes = memo(function Motes({ count = 36, color = '255,233,174', shaft = null, seed = 11, className, opacity = 1, rise = 1 }) {
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
    let dpr = 1;
    let raf = 0;
    let last = 0;
    let running = false;
    let t = 0;

    const measure = () => {
      const r = cv.getBoundingClientRect();
      const nw = Math.round(r.width);
      const nh = Math.round(r.height);
      if (nw < 2 || nh < 2) return false;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      if (nw !== w || nh !== h) {
        w = nw;
        h = nh;
        cv.width = Math.round(w * dpr);
        cv.height = Math.round(h * dpr);
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
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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

    const step = (now) => {
      raf = 0;
      if (!running) return;
      const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
      last = now;
      if (!measure()) {
        raf = requestAnimationFrame(step);
        return;
      }
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
      draw();
      raf = requestAnimationFrame(step);
    };

    const start = () => {
      if (running || reduced) return;
      running = true;
      last = 0;
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
