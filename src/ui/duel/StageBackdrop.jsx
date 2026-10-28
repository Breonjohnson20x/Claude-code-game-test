// A duel stage as a living backdrop for a page (the title screen, the training yard): the painted
// scenery, its animated lights and its particles, without a foe. Pauses when hidden; a single still
// frame under reduced motion.

import { useEffect, useRef } from 'react';
import { useReducedMotion, watchVisibility } from '../art/util.js';
import { layout, paintStage, animateStage, createAtmosphere, drawAtmosphere } from './render/stages.js';

export function StageBackdrop({ stage = 'ruin', className, noSymbol = false }) {
  const ref = useRef(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return undefined;
    const ctx = cv.getContext('2d');
    let L = layout(1, 1);
    let scenery = null;
    let atmos = [];
    let raf = 0;
    let last = 0;
    let visible = true;
    const size = () => {
      const r = cv.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return; // detached or collapsed: keep the last frame
      const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
      cv.width = Math.max(1, Math.round(r.width * dpr));
      cv.height = Math.max(1, Math.round(r.height * dpr));
      L = layout(r.width, r.height);
      scenery = document.createElement('canvas');
      scenery.width = cv.width;
      scenery.height = cv.height;
      const sctx = scenery.getContext('2d');
      sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paintStage(sctx, L, stage);
      atmos = createAtmosphere(stage, L);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(performance.now());
    };
    const draw = (ms) => {
      const dt = last ? ms - last : 16;
      last = ms;
      ctx.clearRect(0, 0, L.w, L.h);
      if (scenery) ctx.drawImage(scenery, 0, 0, L.w, L.h);
      animateStage(ctx, L, stage, ms / 1000, !reduced, { noSymbol });
      drawAtmosphere(ctx, L, atmos, dt, ms / 1000, !reduced);
    };
    const loop = (ms) => {
      raf = requestAnimationFrame(loop);
      if (visible && !document.hidden) draw(ms);
    };
    size();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(size) : null;
    ro?.observe(cv);
    const unwatch = watchVisibility(cv, (v) => {
      visible = v;
    });
    if (!reduced) raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      unwatch();
    };
  }, [stage, reduced, noSymbol]);
  return <canvas ref={ref} className={className} aria-hidden="true" />;
}
