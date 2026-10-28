// The duel renderer. DuelScreen owns the engine loop and the input; this owns every pixel:
//
//   const r = createDuelRenderer({ config, archetypeId, reduced });
//   r.resize(cssW, cssH, dpr);
//   const { hitstopMs } = r.events(duel.events, now);   // after each stepDuel
//   r.frame(ctx, duel, now, { guarding });               // every animation frame
//   r.swipe(points, now);                                // a strike gesture, for its trail
//
// Static scenery is painted once per resize into an offscreen canvas; the foe is drawn into its own
// layer so a hit can flash its silhouette. Hitstop and the camera are cosmetic: the engine keeps its
// fixed timestep and both sides freeze together.

import { layout, stageFor, STAGES, paintStage, animateStage, createAtmosphere, drawAtmosphere } from './stages.js';
import { lookFor, drawFoe } from './foes.js';
import { drawTelegraph } from './telegraph.js';
import { drawPlayer } from './player.js';
import { spawnFx, drawFx, drawScreenFx, drawSwipes, currentShake } from './fx.js';
import { clamp01, easeOut, lerp, rng } from './util.js';

export { layout, stageFor, STAGES };
export { TELE } from './foes.js';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

export function createDuelRenderer({ config, archetypeId, reduced = false }) {
  const stageId = stageFor(config);
  const stage = STAGES[stageId];
  const look = lookFor(config, archetypeId);
  const motion = !reduced;
  const rand = rng(1234);
  let L = layout(1, 1);
  let dpr = 1;
  let backdrop = null;
  let layer = null;
  let atmos = [];
  const fx = [];
  const swipes = [];
  const bladeHist = [];
  const react = { hitAt: -1e9, hitDir: 0, hitStrength: 0, overAt: null, outcome: null };
  let camX = 0;
  let zoomAt = -1e9;
  let zoomAmt = 0;
  let last = 0;

  return {
    stageId,
    stage,
    look,
    layout: () => L,

    resize(w, h, ratio) {
      L = layout(w, h);
      dpr = ratio;
      backdrop = canvas(w * dpr, h * dpr);
      const bctx = backdrop.getContext('2d');
      bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paintStage(bctx, L, stageId);
      layer = canvas(w * dpr, h * dpr);
      atmos = createAtmosphere(stageId, L);
    },

    /** Feed the engine's events from one step. Returns { hitstopMs }. */
    events(events, now) {
      let hitstopMs = 0;
      for (const ev of events ?? []) {
        if (ev.type !== 'fx') continue;
        const out = spawnFx(fx, ev, now, L, rand);
        hitstopMs = Math.max(hitstopMs, out.hitstopMs);
        if (out.hit) {
          react.hitAt = now;
          react.hitDir = out.hit.dir;
          react.hitStrength = out.hit.strength;
        }
        if (out.zoom) {
          zoomAt = now;
          zoomAmt = out.zoom;
        }
      }
      return { hitstopMs: motion ? hitstopMs : 0 };
    },

    /** Start a swipe trail; returns it so the caller can keep extending `pts` as the finger moves. */
    swipe(points, now) {
      const trail = { pts: points.slice(-24), t0: now };
      swipes.push(trail);
      return trail;
    },

    frame(ctx, duel, now, { guarding = false } = {}) {
      const t = now / 1000;
      const dt = last ? now - last : 16;
      last = now;
      const { w, h, cx } = L;
      if (duel.phase === 'over' && react.overAt == null) {
        react.overAt = now;
        react.outcome = duel.outcome;
      }
      const hitK = clamp01(1 - (now - react.hitAt) / 240) * react.hitStrength;
      const reactNow = {
        hitK: motion ? easeOut(hitK) : 0,
        hitDir: react.hitDir,
        overK: react.overAt == null ? 0 : clamp01((now - react.overAt) / 700),
        outcome: react.outcome,
      };

      // camera: the world slides opposite your dodge; a punch-in on the biggest moments
      const p = duel.player;
      const targetX = p.dodge.active ? (p.dodge.side === 'left' ? 1 : -1) * 34 * L.s : 0;
      camX = motion ? lerp(camX, targetX, 1 - Math.exp(-dt / 70)) : 0;
      const zk = clamp01(1 - (now - zoomAt) / 420);
      const zoom = motion ? 1 + 0.035 * zoomAmt * Math.sin(zk * Math.PI) : 1;

      ctx.clearRect(0, 0, w, h);
      if (backdrop) {
        // the backdrop moves less than the foe: a touch of depth
        ctx.save();
        ctx.translate(camX * 0.4, 0);
        ctx.drawImage(backdrop, -camX * 0.4 - 2, 0, w + 4, h);
        ctx.restore();
      }
      const sh = currentShake(fx, now, motion, L.s);
      ctx.save();
      ctx.translate(sh.x, sh.y);
      ctx.translate(cx, h * 0.5);
      ctx.scale(zoom, zoom);
      ctx.translate(-cx + camX, -h * 0.5);
      animateStage(ctx, L, stageId, t, motion);
      drawAtmosphere(ctx, L, atmos, dt, t, motion);

      // the foe, on its own layer so a hit can flash the silhouette
      if (layer) {
        const lctx = layer.getContext('2d');
        lctx.setTransform(1, 0, 0, 1, 0, 0);
        lctx.clearRect(0, 0, layer.width, layer.height);
        lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawFoe(lctx, L, duel, t, look, stage.light, reactNow);
        const flash = motion ? hitK * 0.75 : 0;
        if (flash > 0.01) {
          lctx.globalCompositeOperation = 'source-atop';
          lctx.fillStyle = `rgba(255,248,232,${flash})`;
          lctx.fillRect(0, 0, w, h);
          lctx.globalCompositeOperation = 'source-over';
        }
        if (reactNow.overK > 0 && react.outcome === 'victory' && look.spectral) ctx.globalAlpha = 1 - reactNow.overK * 0.9;
        ctx.drawImage(layer, 0, 0, w, h);
        ctx.globalAlpha = 1;
      }
      drawTelegraph(ctx, L, duel, t, motion);
      drawFx(ctx, L, fx, now);
      ctx.restore();

      // the Sovereign's blade rides the shake but not the parallax
      ctx.save();
      ctx.translate(sh.x, sh.y);
      drawPlayer(ctx, L, duel, t, guarding, bladeHist, motion);
      ctx.restore();
      drawSwipes(ctx, L, swipes, now);
      drawScreenFx(ctx, L, fx, now);

      // a gentle vignette frames every stage
      const v = ctx.createRadialGradient(cx, h * 0.48, Math.min(w, h) * 0.42, cx, h * 0.48, Math.max(w, h) * 0.78);
      v.addColorStop(0, 'rgba(0,0,0,0)');
      v.addColorStop(1, 'rgba(2,4,9,0.55)');
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, w, h);
    },
  };
}
