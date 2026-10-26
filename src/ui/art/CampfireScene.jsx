// <CampfireScene intensity={0..1} className />
// The night camp on <canvas>: a fire with layered flames and rising embers, warm light spilling
// over the ground, tents and seated figures in silhouette, Sparky curled by the logs, stars.
// devicePixelRatio aware (capped at 2), resize-aware, paused offscreen or in a hidden tab, and a
// single still frame under reduced motion. Fills its positioned parent. Decorative (aria-hidden).

import { memo, useEffect, useRef } from 'react';
import { clamp, mulberry32, useReducedMotion, watchVisibility } from './util.js';

const EMBERS = 46;

function makeStars(seed, n) {
  const rnd = mulberry32(seed);
  return Array.from({ length: n }, () => ({ x: rnd(), y: rnd() * 0.55, r: 0.4 + rnd() * 1.1, tw: rnd() * Math.PI * 2, a: 0.25 + rnd() * 0.6 }));
}

function makeEmbers(seed) {
  const rnd = mulberry32(seed);
  return Array.from({ length: EMBERS }, () => ({ t: rnd(), x: rnd() - 0.5, speed: 0.07 + rnd() * 0.12, drift: (rnd() - 0.5) * 0.6, size: 0.6 + rnd() * 1.6, phase: rnd() * 6.28 }));
}

/** Fire anchor and scale for a w×h canvas: low and centred, smaller on wide screens. */
function layout(w, h) {
  const s = clamp(Math.min(w, h * 0.9) / 520, 0.55, 1.35);
  return { fx: w * 0.5, fy: h * 0.84, s };
}

function drawSky(ctx, w, h, stars, time, moving) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#04070d');
  g.addColorStop(0.45, '#0b1424');
  g.addColorStop(0.75, '#16101a');
  g.addColorStop(1, '#0a0705');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  for (const st of stars) {
    const tw = moving ? 0.65 + 0.35 * Math.sin(time * 1.3 + st.tw) : 0.85;
    ctx.globalAlpha = st.a * tw;
    ctx.fillStyle = '#fff4d6';
    ctx.beginPath();
    ctx.arc(st.x * w, st.y * h, st.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawHills(ctx, w, h) {
  ctx.fillStyle = '#0a1120';
  ctx.beginPath();
  ctx.moveTo(0, h * 0.62);
  for (let i = 0; i <= 12; i += 1) {
    const x = (i / 12) * w;
    ctx.lineTo(x, h * (0.6 + 0.035 * Math.sin(i * 1.7) + 0.02 * Math.cos(i * 3.1)));
  }
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.fill();
  ctx.fillStyle = '#070b14';
  ctx.beginPath();
  ctx.moveTo(0, h * 0.7);
  for (let i = 0; i <= 10; i += 1) ctx.lineTo((i / 10) * w, h * (0.69 + 0.025 * Math.sin(i * 2.3 + 1)));
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.fill();
}

function drawGroundLight(ctx, w, h, { fx, fy, s }, glow) {
  const r = 360 * s * (0.85 + 0.25 * glow);
  const g = ctx.createRadialGradient(fx, fy, 10, fx, fy, r);
  g.addColorStop(0, `rgba(255,170,80,${0.55 * glow})`);
  g.addColorStop(0.35, `rgba(224,120,43,${0.26 * glow})`);
  g.addColorStop(1, 'rgba(224,120,43,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function tent(ctx, x, y, size, lit) {
  ctx.fillStyle = '#05070c';
  ctx.beginPath();
  ctx.moveTo(x - size, y);
  ctx.lineTo(x, y - size * 0.95);
  ctx.lineTo(x + size, y);
  ctx.closePath();
  ctx.fill();
  if (lit) {
    ctx.strokeStyle = 'rgba(244,163,94,0.35)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x, y - size * 0.95);
    ctx.lineTo(x + size, y);
    ctx.stroke();
  }
}

function seated(ctx, x, y, s, facing, rim) {
  // A cloaked figure sitting on a log, facing the fire. Rim light on the fire side.
  ctx.fillStyle = '#05070c';
  ctx.beginPath();
  ctx.ellipse(x, y - 30 * s, 9 * s, 10 * s, 0, 0, Math.PI * 2); // head
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - 17 * s, y);
  ctx.quadraticCurveTo(x - 19 * s, y - 22 * s, x - 6 * s, y - 24 * s);
  ctx.lineTo(x + 6 * s, y - 24 * s);
  ctx.quadraticCurveTo(x + 19 * s, y - 22 * s, x + 17 * s, y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = `rgba(255,180,92,${rim})`;
  ctx.lineWidth = 1.6 * s;
  ctx.beginPath();
  const side = facing; // +1 fire on the right
  ctx.arc(x + side * 2 * s, y - 30 * s, 9.5 * s, side > 0 ? -1.2 : Math.PI + 1.2, side > 0 ? 1.2 : Math.PI - 1.2, side < 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + side * 7 * s, y - 23 * s);
  ctx.quadraticCurveTo(x + side * 18 * s, y - 20 * s, x + side * 17 * s, y);
  ctx.stroke();
}

function sparky(ctx, x, y, s, rim, time, moving) {
  // A small curled drake: body, tucked head, folded wing, tail wrapped round.
  const breathe = moving ? 1 + 0.03 * Math.sin(time * 1.6) : 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s * breathe);
  ctx.fillStyle = '#06090f';
  ctx.beginPath();
  ctx.ellipse(0, -7, 16, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(13, -9, 7, 5, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-6, -13);
  ctx.quadraticCurveTo(2, -24, 9, -13);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#06090f';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(-15, -5);
  ctx.quadraticCurveTo(-24, 2, -10, 1);
  ctx.stroke();
  ctx.strokeStyle = `rgba(255,180,92,${rim})`;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(13, -9, 7, 5, -0.3, -1.4, 0.9);
  ctx.stroke();
  // a sleepy acid-green glint of an eye, barely open
  ctx.fillStyle = 'rgba(180,232,63,0.75)';
  ctx.fillRect(15, -10, 2.2, 0.9);
  ctx.restore();
}

function logs(ctx, { fx, fy, s }) {
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#1c120b';
  ctx.lineWidth = 9 * s;
  ctx.beginPath();
  ctx.moveTo(fx - 34 * s, fy + 6 * s);
  ctx.lineTo(fx + 30 * s, fy - 4 * s);
  ctx.moveTo(fx + 34 * s, fy + 6 * s);
  ctx.lineTo(fx - 30 * s, fy - 4 * s);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(244,163,94,0.5)';
  ctx.lineWidth = 1.5 * s;
  ctx.beginPath();
  ctx.moveTo(fx - 30 * s, fy - 4 * s);
  ctx.lineTo(fx + 26 * s, fy - 8 * s);
  ctx.stroke();
  // stone ring
  ctx.fillStyle = '#14100c';
  for (let i = 0; i < 9; i += 1) {
    const a = Math.PI * (0.05 + (i / 8) * 0.9);
    ctx.beginPath();
    ctx.ellipse(fx + Math.cos(a) * 46 * s, fy + 8 * s + Math.sin(a) * 6 * s, 9 * s, 5 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function flames(ctx, { fx, fy, s }, time, k) {
  // A soft halo first, so the tongues sit inside their own light.
  const halo = ctx.createRadialGradient(fx, fy - 40 * s * k, 0, fx, fy - 40 * s * k, 110 * s * k);
  halo.addColorStop(0, 'rgba(255,190,110,0.35)');
  halo.addColorStop(1, 'rgba(255,190,110,0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(fx, fy - 40 * s * k, 110 * s * k, 0, Math.PI * 2);
  ctx.fill();
  const layers = [
    { c: 'rgba(158,43,37,0.85)', w: 34, h: 96 },
    { c: 'rgba(224,120,43,0.9)', w: 27, h: 80 },
    { c: 'rgba(244,163,94,0.95)', w: 19, h: 60 },
    { c: 'rgba(255,233,174,0.95)', w: 11, h: 38 },
  ];
  ctx.globalCompositeOperation = 'lighter';
  layers.forEach((L, li) => {
    for (let tongue = -1; tongue <= 1; tongue += 1) {
      const ph = time * (2.4 + li * 0.5) + tongue * 1.9 + li;
      const height = L.h * s * k * (0.78 + 0.22 * Math.sin(ph) + 0.08 * Math.sin(ph * 2.7)) * (tongue === 0 ? 1 : 0.7);
      const sway = (Math.sin(ph * 0.8) * 7 + tongue * L.w * 0.55) * s;
      const width = L.w * s * (tongue === 0 ? 1 : 0.72);
      const bx = fx + tongue * L.w * 0.42 * s;
      ctx.fillStyle = L.c;
      ctx.beginPath();
      ctx.moveTo(bx - width, fy);
      ctx.bezierCurveTo(bx - width, fy - height * 0.45, bx + sway * 0.4 - width * 0.35, fy - height * 0.7, bx + sway, fy - height);
      ctx.bezierCurveTo(bx + sway * 0.4 + width * 0.35, fy - height * 0.7, bx + width, fy - height * 0.45, bx + width, fy);
      ctx.closePath();
      ctx.fill();
    }
  });
  ctx.globalCompositeOperation = 'source-over';
}

function embers(ctx, { fx, fy, s }, list, time, k) {
  ctx.globalCompositeOperation = 'lighter';
  for (const e of list) {
    const life = (e.t + time * e.speed) % 1;
    const y = fy - 20 * s - life * 260 * s * k;
    const x = fx + e.x * 50 * s + Math.sin(time * 1.4 + e.phase) * 14 * s * life + e.drift * life * 120 * s;
    const a = (1 - life) * 0.9;
    ctx.fillStyle = `rgba(255,${150 + Math.round(80 * (1 - life))},90,${a})`;
    ctx.beginPath();
    ctx.arc(x, y, e.size * s * (1 - life * 0.5), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
}

function drawFrame(ctx, w, h, stars, emberList, time, intensity, moving) {
  const L = layout(w, h);
  const k = 0.65 + 0.55 * intensity;
  const flicker = moving ? 0.88 + 0.12 * Math.sin(time * 7.3) * Math.sin(time * 3.1 + 1) : 1;
  drawSky(ctx, w, h, stars, time, moving);
  drawHills(ctx, w, h);
  drawGroundLight(ctx, w, h, L, k * flicker);
  // tents and the camp beyond the fire
  tent(ctx, L.fx - 230 * L.s, L.fy - 52 * L.s, 62 * L.s, true);
  tent(ctx, L.fx + 250 * L.s, L.fy - 60 * L.s, 70 * L.s, true);
  tent(ctx, L.fx - 360 * L.s, L.fy - 70 * L.s, 48 * L.s, false);
  tent(ctx, L.fx + 380 * L.s, L.fy - 78 * L.s, 52 * L.s, false);
  // a banner pole
  ctx.strokeStyle = '#05070c';
  ctx.lineWidth = 2.5 * L.s;
  ctx.beginPath();
  ctx.moveTo(L.fx + 160 * L.s, L.fy - 30 * L.s);
  ctx.lineTo(L.fx + 160 * L.s, L.fy - 150 * L.s);
  ctx.stroke();
  ctx.fillStyle = 'rgba(31,49,80,0.95)';
  ctx.beginPath();
  ctx.moveTo(L.fx + 160 * L.s, L.fy - 148 * L.s);
  ctx.lineTo(L.fx + 200 * L.s, L.fy - 140 * L.s + (moving ? Math.sin(time * 1.2) * 3 * L.s : 0));
  ctx.lineTo(L.fx + 160 * L.s, L.fy - 124 * L.s);
  ctx.fill();
  ctx.fillStyle = 'rgba(201,162,39,0.8)';
  ctx.fillRect(L.fx + 166 * L.s, L.fy - 140 * L.s, 6 * L.s, 6 * L.s);

  const rim = 0.45 + 0.35 * flicker * k;
  seated(ctx, L.fx - 92 * L.s, L.fy + 4 * L.s, L.s * 1.15, 1, rim); // Mara
  seated(ctx, L.fx + 96 * L.s, L.fy + 10 * L.s, L.s * 1.2, -1, rim); // the Sovereign
  sparky(ctx, L.fx + 44 * L.s, L.fy + 26 * L.s, L.s, rim, time, moving);
  logs(ctx, L);
  flames(ctx, L, moving ? time : 0.6, k);
  embers(ctx, L, emberList, moving ? time : 2.2, k);
  // the hot core
  const core = ctx.createRadialGradient(L.fx, L.fy - 8 * L.s, 0, L.fx, L.fy - 8 * L.s, 40 * L.s);
  core.addColorStop(0, `rgba(255,236,190,${0.4 * flicker})`);
  core.addColorStop(1, 'rgba(255,244,214,0)');
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(L.fx, L.fy - 8 * L.s, 40 * L.s, 0, Math.PI * 2);
  ctx.fill();
}

function CampfireSceneImpl({ intensity = 0.7, className = '', style }) {
  const wrap = useRef(null);
  const canvas = useRef(null);
  const reduced = useReducedMotion();
  const level = clamp(Number(intensity) || 0, 0, 1);

  useEffect(() => {
    const el = wrap.current;
    const cv = canvas.current;
    if (!el || !cv) return undefined;
    const ctx = cv.getContext('2d');
    if (!ctx) return undefined;
    const stars = makeStars(7, 90);
    const emberList = makeEmbers(11);
    let w = 0;
    let h = 0;
    let raf = 0;
    let visible = true;
    let start = 0;

    const size = () => {
      const r = el.getBoundingClientRect();
      const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
      w = Math.max(1, Math.round(r.width));
      h = Math.max(1, Math.round(r.height));
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const paint = (ms) => drawFrame(ctx, w, h, stars, emberList, ms / 1000, level, !reduced);
    const loop = (ms) => {
      if (!start) start = ms;
      paint(ms - start);
      raf = visible && !reduced ? requestAnimationFrame(loop) : 0;
    };

    size();
    paint(1200);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => {
      size();
      if (!raf) paint(1200);
    }) : null;
    ro?.observe(el);
    const stopWatch = watchVisibility(el, (v) => {
      visible = v;
      if (v && !reduced && !raf) raf = requestAnimationFrame(loop);
      if (!v && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    });
    return () => {
      ro?.disconnect();
      stopWatch();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [level, reduced]);

  return (
    <div ref={wrap} aria-hidden="true" className={`absolute inset-0 ${className}`} style={style}>
      <canvas ref={canvas} className="block h-full w-full" />
    </div>
  );
}

export const CampfireScene = memo(CampfireSceneImpl);
export default CampfireScene;
