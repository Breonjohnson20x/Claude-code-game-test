// The duel's lighting and post pass, on a frame budget. Nothing here reads the frame back and
// nothing touches the full screen per frame:
//
//   bake       once per resize, into the backdrop: the stage's colour grade (a soft-light gradient
//              map), a film vignette and a pool of shade on the ground around the foe
//   foe layer  the foe is drawn into a small offscreen canvas that covers only its own box (at a
//              resolution set by the quality tier), lit there (occlusion, key, the colour of live
//              sparks, a short hit flash) and composited once
//   rim        a soft rim of the stage's key colour on the lit edges, cut from the silhouette at
//              half resolution (the silhouette minus itself nudged away from the light)
//   reflect    the foe mirrored in wet or frozen ground: one flipped, squashed copy of the bottom
//              of its layer in a few rippling bands, faded with distance from the feet
//   ghosts     for the spectral echo: lagging, violet-tinted afterimages of the layer
//
// Every buffer is sized on resize; the only per-frame allocations are the gradients for live
// lights. All of it is cosmetic and costs the engine nothing.

import { clamp01, mix, rgba } from './util.js';

/**
 * Per-stage grade. hi / lo = soft-light tints for the top and bottom of the frame (128 grey is
 * neutral), refl = reflection strength of the ground (0 = matte), ripple = how much water breaks
 * it up, vig = vignette darkness, pool = the shade on the ground around the foe.
 */
export const GRADE = {
  circle: { hi: [146, 120, 96], lo: [92, 94, 118], refl: 0.1, ripple: 0, vig: 0.72, pool: 0.3 },
  yard: { hi: [156, 132, 106], lo: [108, 102, 116], refl: 0, ripple: 0, vig: 0.5, pool: 0.22 },
  checkpoint: { hi: [152, 118, 98], lo: [96, 86, 112], refl: 0, ripple: 0, vig: 0.62, pool: 0.26 },
  wilds: { hi: [112, 112, 128], lo: [86, 90, 108], refl: 0.18, ripple: 0, vig: 0.66, pool: 0.42 },
  ruin: { hi: [122, 114, 146], lo: [86, 82, 116], refl: 0.14, ripple: 0, vig: 0.72, pool: 0.3 },
  ford: { hi: [118, 122, 142], lo: [86, 94, 122], refl: 0.32, ripple: 1, vig: 0.7, pool: 0.28 },
  ford_winter: { hi: [150, 126, 116], lo: [92, 94, 116], refl: 0.24, ripple: 0.25, vig: 0.62, pool: 0.4 },
  siege: { hi: [164, 112, 84], lo: [96, 72, 78], refl: 0, ripple: 0, vig: 0.75, pool: 0.3 },
};

/** Quality tiers, chosen by the renderer from measured frame times (never by the engine). */
export const TIERS = [
  // layer = the foe layer's resolution relative to the canvas (it is soft-lit cloth and fur: 3/4
  // resolution on a 2x screen is still sharper than the eye resolves at arm's length)
  { layer: 0.8, rim: true, refl: 4, ghosts: true, particles: 1, dprCap: 2 },
  { layer: 0.7, rim: true, refl: 2, ghosts: false, particles: 0.6, dprCap: 1.5 },
  { layer: 0.6, rim: false, refl: 1, ghosts: false, particles: 0.35, dprCap: 1.25 },
];

function buf(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/** Relative luminance-ish of an [r,g,b] (0..1). */
function lum(c) {
  return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
}

/** The rim's colour: the stage's key and rim light mixed, never brighter than ~70% luminance. */
export function rimColor(light) {
  const c = mix(light.key, light.rim, 0.5);
  const l = lum(c);
  return l > 0.7 ? c.map((v) => v * (0.7 / l)) : c;
}

/**
 * Bake the grade, the vignette and the ground pool into a painted backdrop (css-px transform
 * already set on `bctx`).
 */
export function bakeGrade(bctx, L, grade) {
  const { w, h, cx } = L;
  bctx.save();
  // the pool of shade the foe stands in: it keeps a dark figure reading against bright ground
  if (grade.pool) {
    bctx.translate(cx, L.floorY - 10 * L.s);
    bctx.scale(1, 0.34);
    const r = 300 * L.s;
    const pg = bctx.createRadialGradient(0, 0, 0, 0, 0, r);
    pg.addColorStop(0, `rgba(6,8,14,${grade.pool})`);
    pg.addColorStop(0.55, `rgba(6,8,14,${grade.pool * 0.55})`);
    pg.addColorStop(1, 'rgba(6,8,14,0)');
    bctx.fillStyle = pg;
    bctx.fillRect(-r, -r, r * 2, r * 2);
  }
  bctx.restore();
  bctx.save();
  bctx.globalCompositeOperation = 'soft-light';
  const g = bctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, rgba(grade.hi, 0.9));
  g.addColorStop(0.5, rgba([128, 128, 128], 0.5));
  g.addColorStop(1, rgba(grade.lo, 0.9));
  bctx.fillStyle = g;
  bctx.fillRect(0, 0, w, h);
  bctx.restore();
  // the film vignette (oval on tall screens)
  bctx.save();
  bctx.translate(cx, h * 0.47);
  bctx.scale(1, h / Math.max(1, w) > 1.4 ? 1.35 : 1);
  const r = Math.hypot(w, h) * 0.5;
  const rg = bctx.createRadialGradient(0, 0, r * 0.38, 0, 0, r * 1.02);
  rg.addColorStop(0, 'rgba(3,5,10,0)');
  rg.addColorStop(0.55, `rgba(3,5,10,${0.22 * grade.vig})`);
  rg.addColorStop(1, `rgba(3,5,10,${0.92 * grade.vig})`);
  bctx.fillStyle = rg;
  bctx.fillRect(-w, -h, w * 2, h * 2);
  bctx.restore();
}

export function createPost() {
  let dpr = 1;
  let q = 1; // layer px per css px
  let box = { x: 0, y: 0, w: 1, h: 1 };
  let layer = null;
  let rim = null;
  let refl = null;
  let ghosts = [];
  let ghostAt = -1e9;
  let ghostIdx = 0;
  let cache = null; // gradients that only depend on the layout
  let tier = TIERS[0];

  /** The foe's box in css px: the widest blow and the tallest rear, never the whole screen. */
  function foeBox(L) {
    const x0 = Math.max(0, Math.floor(L.cx - 270 * L.s));
    const x1 = Math.min(L.w, Math.ceil(L.cx + 270 * L.s));
    const y0 = Math.max(0, Math.floor(L.floorY - 500 * L.s));
    const y1 = Math.min(L.h, Math.ceil(L.floorY + 24 * L.s));
    return { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };
  }

  /** The part of the box `ext` (css px) covers, padded and snapped to whole layer pixels. */
  function clip(ext) {
    if (!ext) return box;
    const x0 = Math.max(box.x, Math.floor(ext.x0 - 6));
    const x1 = Math.min(box.x + box.w, Math.ceil(ext.x1 + 6));
    const y0 = Math.max(box.y, Math.floor(ext.y0 - 6));
    const y1 = Math.min(box.y + box.h, Math.ceil(ext.y1 + 6));
    if (x1 <= x0 || y1 <= y0) return box;
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  /**
   * The light that falls on the foe, pre-rendered small (it is smooth): occlusion toward the feet
   * and a key light across the body from the stage's lit side. Laid over the foe in one pass.
   */
  function lightMap(L, light, spectral) {
    const map = buf(Math.max(8, box.w / 6), Math.max(8, box.h / 6));
    const m = map.getContext('2d');
    m.scale(map.width / box.w, map.height / box.h);
    m.translate(-box.x, -box.y);
    const ao = m.createLinearGradient(0, L.floorY - 520 * L.s, 0, L.floorY);
    ao.addColorStop(0, rgba(light.key, spectral ? 0 : 0.08));
    ao.addColorStop(0.45, rgba(light.key, 0));
    ao.addColorStop(0.72, rgba(light.shadow, 0));
    ao.addColorStop(1, rgba(light.shadow, spectral ? 0.12 : 0.5));
    m.fillStyle = ao;
    m.fillRect(box.x, box.y, box.w, box.h);
    const side = light.side;
    const kg = m.createLinearGradient(L.cx - side * 160 * L.s, 0, L.cx + side * 160 * L.s, 0);
    kg.addColorStop(0, rgba(light.shadow, spectral ? 0 : 0.28));
    kg.addColorStop(0.5, rgba(light.shadow, 0));
    kg.addColorStop(1, rgba(light.key, spectral ? 0 : 0.08));
    m.fillStyle = kg;
    m.fillRect(box.x, box.y, box.w, box.h);
    return { light, map, rim: rgba(rimColor(light)) };
  }

  const api = {
    get box() {
      return box;
    },

    resize(L, ratio, t = TIERS[0]) {
      dpr = ratio;
      tier = t;
      q = Math.max(0.5, dpr * t.layer);
      box = foeBox(L);
      layer = buf(box.w * q, box.h * q);
      rim = buf(box.w * q * 0.5, box.h * q * 0.5);
      const depth = 300 * L.s * 0.62;
      refl = buf(box.w * q * 0.5, depth * q * 0.5);
      ghosts = t.ghosts ? [buf(box.w * q * 0.5, box.h * q * 0.5), buf(box.w * q * 0.5, box.h * q * 0.5), buf(box.w * q * 0.5, box.h * q * 0.5)] : [];
      ghostAt = -1e9;
      cache = null;
    },

    /** Clear the layer and return its context, transformed so css px land in the foe's box. */
    begin() {
      const lctx = layer.getContext('2d');
      lctx.setTransform(1, 0, 0, 1, 0, 0);
      lctx.globalCompositeOperation = 'source-over';
      lctx.globalAlpha = 1;
      lctx.clearRect(0, 0, layer.width, layer.height);
      lctx.setTransform(q, 0, 0, q, -box.x * q, -box.y * q);
      return lctx;
    },

    /**
     * Light the layer in place: occlusion toward the feet and a key light across the body (one
     * pre-rendered light map), colour from live sparks (`lights`: [{ x, y, r, color, a }] in css
     * px) and the hit flash. `ext` = the part of the box the foe covers this frame.
     */
    light(L, light, lights, { spectral = false, flash = 0, ext = null } = {}) {
      const lctx = layer.getContext('2d');
      if (!cache || cache.light !== light) cache = lightMap(L, light, spectral);
      const e = clip(ext);
      lctx.save();
      lctx.globalCompositeOperation = 'source-atop';
      const m = cache.map;
      const kx = m.width / box.w;
      const ky = m.height / box.h;
      lctx.drawImage(m, (e.x - box.x) * kx, (e.y - box.y) * ky, e.w * kx, e.h * ky, e.x, e.y, e.w, e.h);
      // live light from sparks and flashes, budgeted so the foe never washes out (the body keeps
      // its uniform, face and pose through the brightest clash)
      let budget = 0.42;
      for (const l of lights) {
        if (l.a <= 0.01 || l.r <= 0 || budget <= 0.01) continue;
        const la = Math.min(l.a, budget);
        budget -= la;
        const g = lctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
        g.addColorStop(0, rgba(l.color, la));
        g.addColorStop(1, rgba(l.color, 0));
        lctx.fillStyle = g;
        lctx.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
      }
      // the hit flash: a warm blink of the silhouette, gone in a couple of frames
      if (flash > 0.01) {
        lctx.fillStyle = `rgba(255,232,196,${flash})`;
        lctx.fillRect(e.x, e.y, e.w, e.h);
      }
      lctx.restore();
    },

    /** The foe mirrored in the ground under its feet. Draw before the foe, inside the camera. */
    reflect(ctx, L, grade, t, motion) {
      if (!grade.refl || !tier.refl) return;
      const rctx = refl.getContext('2d');
      const k = q * 0.5; // refl px per css px
      const depth = 300 * L.s;
      const squash = 0.62;
      const fy = L.floorY + 2 * L.s;
      rctx.setTransform(1, 0, 0, 1, 0, 0);
      rctx.globalCompositeOperation = 'source-over';
      rctx.clearRect(0, 0, refl.width, refl.height);
      const n = grade.ripple && motion ? tier.refl : 1;
      const band = depth / n;
      for (let i = 0; i < n; i += 1) {
        // source rows in the layer: the band i bands above the feet
        const sy = (fy - box.y - (i + 1) * band) * q;
        const sh = band * q;
        const dy = i * band * squash * k;
        const dh = band * squash * k + 0.75;
        const wob = n > 1 ? Math.sin(t * 2.2 + i * 1.3) * grade.ripple * (1.5 + i * 1.6) * L.s * k : 0;
        rctx.save();
        rctx.translate(wob, dy + dh);
        rctx.scale(1, -1);
        rctx.drawImage(layer, 0, Math.max(0, sy), layer.width, sh, 0, 0, refl.width, dh);
        rctx.restore();
      }
      rctx.globalCompositeOperation = 'destination-in';
      if (!cache?.fade || cache.fadeH !== refl.height) {
        const g = rctx.createLinearGradient(0, 0, 0, refl.height);
        g.addColorStop(0, 'rgba(0,0,0,1)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        if (cache) Object.assign(cache, { fade: g, fadeH: refl.height });
        rctx.fillStyle = g;
      } else rctx.fillStyle = cache.fade;
      rctx.fillRect(0, 0, refl.width, refl.height);
      rctx.globalCompositeOperation = 'source-over';
      ctx.save();
      ctx.globalAlpha *= grade.refl;
      ctx.drawImage(refl, box.x, fy, box.w, depth * squash);
      ctx.restore();
    },

    /**
     * Composite the lit layer into the frame (inside the camera) with its rim. For the spectral
     * echo, `ghost` = { alpha, tint } lays lagging afterimages behind a translucent core.
     */
    composite(ctx, L, light, now, { alpha = 1, rimA = 0.3, ghost = null, ext = null } = {}) {
      const e = clip(ext);
      // layer px of the covered part
      const sx = (e.x - box.x) * q;
      const sy = (e.y - box.y) * q;
      const sw = e.w * q;
      const sh = e.h * q;
      if (ghost && ghosts.length) {
        // afterimages: snapshots of the layer taken ~90 ms apart, tinted moon-violet
        const gw = ghosts[0].width;
        const gh = ghosts[0].height;
        if (now - ghostAt > 90) {
          ghostAt = now;
          ghostIdx = (ghostIdx + 1) % ghosts.length;
          const g = ghosts[ghostIdx].getContext('2d');
          g.globalCompositeOperation = 'copy';
          g.drawImage(layer, 0, 0, gw, gh);
          g.globalCompositeOperation = 'source-atop';
          g.fillStyle = ghost.tint;
          g.fillRect(0, 0, gw, gh);
          g.globalCompositeOperation = 'source-over';
          ghosts[ghostIdx].ext = e;
        }
        ctx.save();
        const offs = [[-7, 2], [6, -3]];
        for (let i = 0; i < 2; i += 1) {
          const gc = ghosts[(ghostIdx - 1 - i + ghosts.length * 2) % ghosts.length];
          const ge = gc.ext ?? e;
          const k = gw / box.w;
          ctx.globalAlpha = ghost.alpha * (i ? 0.7 : 1);
          ctx.drawImage(gc, (ge.x - box.x) * k, (ge.y - box.y) * k, ge.w * k, ge.h * k, ge.x + offs[i][0] * L.s, ge.y + offs[i][1] * L.s, ge.w, ge.h);
        }
        ctx.restore();
      }
      ctx.save();
      ctx.globalAlpha *= alpha;
      ctx.drawImage(layer, sx, sy, sw, sh, e.x, e.y, e.w, e.h);
      ctx.restore();
      if (tier.rim && rimA > 0.01) {
        // the silhouette minus itself nudged away from the light, at half resolution (soft)
        const rctx = rim.getContext('2d');
        const d = Math.max(1.2, 2.2 * L.s * q * 0.5);
        const rw = Math.ceil(sw * 0.5);
        const rh = Math.ceil(sh * 0.5);
        rctx.setTransform(1, 0, 0, 1, 0, 0);
        rctx.globalCompositeOperation = 'copy';
        rctx.drawImage(layer, sx, sy, sw, sh, 0, 0, rw, rh);
        rctx.globalCompositeOperation = 'source-in';
        rctx.fillStyle = cache?.rim ?? rgba(rimColor(light));
        rctx.fillRect(0, 0, rw, rh);
        rctx.globalCompositeOperation = 'destination-out';
        rctx.drawImage(layer, sx, sy, sw, sh, -light.side * d, d * 0.7, rw, rh);
        rctx.globalCompositeOperation = 'source-over';
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha *= clamp01(rimA);
        ctx.drawImage(rim, 0, 0, rw, rh, e.x, e.y, e.w, e.h);
        ctx.restore();
      }
    },
  };
  return api;
}
