// The duel's lighting and post pass: what turns a painted frame into a lit, graded, cinematic one.
//
//   foeLight   rim light cut from the foe's own silhouette (lit from the stage's key side), ground
//              occlusion on the legs, and light thrown onto the body by live sparks and flashes
//   reflect    the foe mirrored in wet or frozen ground, rippled in horizontal slices
//   bloom      a cheap glow: the frame shrunk to 1/4, 1/8 and 1/16, squared (multiply) so only the
//              bright sources survive, then laid back over the frame with 'lighter'
//   grade      a per-stage tone curve (soft-light gradient map) and a film vignette
//
// Every buffer is an offscreen canvas sized on resize; no ctx.filter, nothing allocated per frame
// but a handful of gradients. All of it is cosmetic and costs the engine nothing.

import { clamp01, mix, rgba } from './util.js';

/**
 * Per-stage grade. hi / lo = soft-light tints for the top and bottom of the frame (mid grey is
 * neutral), bloom = glow strength, refl = reflection strength of the ground (0 = matte),
 * ripple = how much water breaks it up, vig = vignette darkness.
 */
export const GRADE = {
  circle: { hi: [150, 120, 92], lo: [86, 92, 120], bloom: 0.55, refl: 0.1, ripple: 0, vig: 0.7 },
  yard: { hi: [160, 134, 104], lo: [104, 100, 118], bloom: 0.42, refl: 0, ripple: 0, vig: 0.5 },
  checkpoint: { hi: [158, 118, 96], lo: [92, 84, 116], bloom: 0.55, refl: 0, ripple: 0, vig: 0.62 },
  wilds: { hi: [120, 128, 150], lo: [92, 104, 132], bloom: 0.45, refl: 0.2, ripple: 0, vig: 0.6 },
  ruin: { hi: [124, 116, 150], lo: [84, 82, 118], bloom: 0.42, refl: 0.14, ripple: 0, vig: 0.72 },
  ford: { hi: [118, 124, 146], lo: [84, 96, 126], bloom: 0.6, refl: 0.34, ripple: 1, vig: 0.7 },
  ford_winter: { hi: [158, 128, 116], lo: [104, 106, 132], bloom: 0.5, refl: 0.26, ripple: 0.25, vig: 0.58 },
  siege: { hi: [168, 112, 82], lo: [96, 72, 78], bloom: 0.7, refl: 0, ripple: 0, vig: 0.75 },
};

function buf(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

export function createPost() {
  let W = 1;
  let H = 1;
  let dpr = 1;
  let rim = null;
  let refl = null;
  let b1 = null;
  let b2 = null;
  let b3 = null;
  let vig = null;
  let vigKey = '';
  let pendingRim = null;

  /** The foe's box in device pixels (it never needs the whole screen). */
  function foeBox(L) {
    const x0 = Math.max(0, Math.floor((L.cx - 330 * L.s) * dpr));
    const x1 = Math.min(W, Math.ceil((L.cx + 330 * L.s) * dpr));
    const y0 = Math.max(0, Math.floor((L.floorY - 500 * L.s) * dpr));
    const y1 = Math.min(H, Math.ceil((L.floorY + 40 * L.s) * dpr));
    return { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };
  }

  return {
    resize(cssW, cssH, ratio) {
      dpr = ratio;
      W = Math.max(1, Math.round(cssW * ratio));
      H = Math.max(1, Math.round(cssH * ratio));
      rim = buf(W, H);
      refl = buf(W / 2, H / 2);
      b1 = buf(W / 4, H / 4);
      b2 = buf(W / 8, H / 8);
      b3 = buf(W / 16, H / 16);
      vig = null;
    },

    /**
     * Light the foe's layer in place: occlusion toward the feet, colour from nearby light sources
     * (`lights`: [{ x, y, r, color, a }] in css px), and a rim of the stage's key light on the lit
     * side. The rim goes to `ctx` (the frame) additively after the layer is drawn: call
     * `rimTo(ctx)` afterwards.
     */
    foeLight(layer, L, light, lights, { rimA = 0.5, spectral = false } = {}) {
      if (!layer || !rim) return;
      const lctx = layer.getContext('2d');
      const box = foeBox(L);
      lctx.save();
      lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      lctx.globalCompositeOperation = 'source-atop';
      // occlusion: the legs sit in the foe's own shadow, the head and shoulders catch the light
      const ao = lctx.createLinearGradient(0, L.floorY - 520 * L.s, 0, L.floorY);
      ao.addColorStop(0, rgba(light.key, spectral ? 0 : 0.1));
      ao.addColorStop(0.45, rgba(light.key, 0));
      ao.addColorStop(0.72, rgba(light.shadow, 0));
      ao.addColorStop(1, rgba(light.shadow, spectral ? 0.15 : 0.5));
      lctx.fillStyle = ao;
      lctx.fillRect(box.x / dpr, box.y / dpr, box.w / dpr, box.h / dpr);
      // a key light falling across the body from the lit side
      const side = light.side;
      const kg = lctx.createLinearGradient(L.cx - side * 160 * L.s, 0, L.cx + side * 160 * L.s, 0);
      kg.addColorStop(0, rgba(light.shadow, spectral ? 0 : 0.26));
      kg.addColorStop(0.5, rgba(light.shadow, 0));
      kg.addColorStop(1, rgba(light.key, spectral ? 0 : 0.1));
      lctx.fillStyle = kg;
      lctx.fillRect(box.x / dpr, box.y / dpr, box.w / dpr, box.h / dpr);
      // sparks and flashes throw their colour on the body
      for (const l of lights) {
        if (l.a <= 0.01 || l.r <= 0) continue;
        const g = lctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
        g.addColorStop(0, rgba(l.color, l.a));
        g.addColorStop(1, rgba(l.color, 0));
        lctx.fillStyle = g;
        lctx.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
      }
      lctx.restore();

      // the rim: the silhouette minus itself nudged away from the light leaves a lit edge
      const rctx = rim.getContext('2d');
      rctx.setTransform(1, 0, 0, 1, 0, 0);
      rctx.globalCompositeOperation = 'source-over';
      rctx.clearRect(box.x, box.y, box.w, box.h);
      rctx.drawImage(layer, box.x, box.y, box.w, box.h, box.x, box.y, box.w, box.h);
      rctx.globalCompositeOperation = 'source-in';
      rctx.fillStyle = rgba(mix(light.rim, [255, 255, 255], 0.2), 1);
      rctx.fillRect(box.x, box.y, box.w, box.h);
      rctx.globalCompositeOperation = 'destination-out';
      const d = Math.max(1.5, 3.2 * L.s * dpr);
      rctx.drawImage(layer, box.x, box.y, box.w, box.h, box.x - side * d, box.y + d * 0.8, box.w, box.h);
      rctx.globalCompositeOperation = 'source-over';
      pendingRim = { box, a: rimA };
    },

    /** Lay the rim from the last foeLight over the frame, in the same space the layer was drawn. */
    rimTo(ctx) {
      if (!pendingRim || !rim) return;
      const { box, a } = pendingRim;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = a;
      ctx.drawImage(rim, box.x, box.y, box.w, box.h, box.x / dpr, box.y / dpr, box.w / dpr, box.h / dpr);
      ctx.restore();
      pendingRim = null;
    },

    /** The foe mirrored in the ground under its feet. Draw before the foe, inside the camera. */
    reflect(ctx, layer, L, grade, t, motion) {
      if (!layer || !refl || !grade.refl) return;
      const rctx = refl.getContext('2d');
      const k = 0.5 * dpr; // refl is half resolution
      rctx.setTransform(1, 0, 0, 1, 0, 0);
      rctx.globalCompositeOperation = 'source-over';
      rctx.clearRect(0, 0, refl.width, refl.height);
      const depth = 300 * L.s; // how much of the foe (css px above the floor) shows in the reflection
      const squash = 0.62;
      const n = 22;
      const slice = depth / n;
      const fy = L.floorY + 2 * L.s;
      for (let i = 0; i < n; i += 1) {
        const srcY = (fy - (i + 1) * slice) * dpr;
        const dstY = (fy + i * slice * squash) * k;
        const wob = grade.ripple && motion ? Math.sin(t * 2.2 + i * 0.9) * grade.ripple * (1.5 + i * 0.35) * L.s : 0;
        rctx.save();
        rctx.translate(wob * k, dstY + slice * squash * k);
        rctx.scale(1, -1);
        rctx.drawImage(layer, 0, srcY, layer.width, slice * dpr, 0, 0, layer.width * (k / dpr), slice * squash * k + 0.6);
        rctx.restore();
      }
      // fade with distance from the feet
      rctx.globalCompositeOperation = 'destination-in';
      const g = rctx.createLinearGradient(0, fy * k, 0, (fy + depth * squash) * k);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      rctx.fillStyle = g;
      rctx.fillRect(0, fy * k, refl.width, depth * squash * k + 2);
      rctx.globalCompositeOperation = 'source-over';
      ctx.save();
      ctx.globalAlpha = grade.refl;
      ctx.drawImage(refl, 0, 0, L.w, L.h);
      ctx.restore();
    },

    /** Glow on the bright sources. `boost` adds to the stage's own strength (finishing blows). */
    bloom(ctx, L, grade, boost = 0) {
      if (!b1) return;
      const strength = clamp01(grade.bloom + boost);
      if (strength <= 0.01) return;
      const src = ctx.canvas;
      const c1 = b1.getContext('2d');
      const c2 = b2.getContext('2d');
      const c3 = b3.getContext('2d');
      c1.globalCompositeOperation = 'copy';
      c1.drawImage(src, 0, 0, b1.width, b1.height);
      // b2 = b1², b3 = b2²: only light that was already bright stays bright
      c2.globalCompositeOperation = 'copy';
      c2.drawImage(b1, 0, 0, b2.width, b2.height);
      c2.globalCompositeOperation = 'multiply';
      c2.drawImage(b1, 0, 0, b2.width, b2.height);
      c3.globalCompositeOperation = 'copy';
      c3.drawImage(b2, 0, 0, b3.width, b3.height);
      c3.globalCompositeOperation = 'multiply';
      c3.drawImage(b2, 0, 0, b3.width, b3.height);
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = strength * 0.42;
      ctx.drawImage(b2, 0, 0, W, H);
      ctx.globalAlpha = strength * 0.9;
      ctx.drawImage(b3, 0, 0, W, H);
      ctx.restore();
    },

    /** Tone the frame: the stage's gradient map, then the film vignette (cached). */
    grade(ctx, L, grade, { cold = 0 } = {}) {
      const { w, h, cx } = L;
      ctx.save();
      ctx.globalCompositeOperation = 'soft-light';
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, rgba(grade.hi, 0.9));
      g.addColorStop(0.5, rgba([128, 128, 128], 0.5));
      g.addColorStop(1, rgba(grade.lo, 0.9));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      if (cold > 0.01) {
        // defeat: the colour drains out of the world
        ctx.globalCompositeOperation = 'saturation';
        ctx.fillStyle = `rgba(128,128,128,${0.75 * clamp01(cold)})`;
        ctx.fillRect(0, 0, w, h);
      }
      ctx.restore();
      const key = `${w}x${h}:${grade.vig}`;
      if (!vig || vigKey !== key) {
        vig = buf(w, h);
        vigKey = key;
        const v = vig.getContext('2d');
        v.save();
        v.translate(cx, h * 0.47);
        v.scale(1, h / Math.max(1, w) > 1.4 ? 1.35 : 1);
        const r = Math.hypot(w, h) * 0.5;
        const rg = v.createRadialGradient(0, 0, r * 0.38, 0, 0, r * 1.02);
        rg.addColorStop(0, 'rgba(3,5,10,0)');
        rg.addColorStop(0.55, `rgba(3,5,10,${0.22 * grade.vig})`);
        rg.addColorStop(1, `rgba(3,5,10,${0.92 * grade.vig})`);
        v.fillStyle = rg;
        v.fillRect(-w, -h, w * 2, h * 2);
        v.restore();
      }
      ctx.drawImage(vig, 0, 0, w, h);
    },
  };
}
