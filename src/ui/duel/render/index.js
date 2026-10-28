// The duel renderer. DuelScreen owns the engine loop and the input; this owns every pixel:
//
//   const r = createDuelRenderer({ config, archetypeId, reduced, intro });
//   r.resize(cssW, cssH, dpr);
//   const { hitstopMs } = r.events(duel.events, now);   // after each stepDuel
//   r.frame(ctx, duel, now, { guarding, hold });         // every animation frame
//   r.swipe(points, now);                                // a strike gesture, for its trail
//
// Static scenery is painted once per resize into an offscreen canvas; the foe is drawn into its own
// layer so it can be lit (rim, occlusion, the glow of sparks), flashed when struck and mirrored in
// wet ground. A post pass (./post.js) adds bloom, the stage's colour grade and a film vignette.
//
// Cinema: the fight opens with a push-in, letterbox bars sliding away and the foe's name on a gold
// rule (it starts on the first frame not held by `hold`, i.e. once the intro card is dismissed). A
// win ends in a slow-motion beat with a white-gold flash; a loss drains the colour. Hitstop, slow
// motion and the camera are cosmetic: the engine keeps its fixed timestep and both sides freeze
// together, and the slow motion only begins once the engine has declared the duel over.

import { layout, stageFor, STAGES, paintStage, animateStage, createAtmosphere, drawAtmosphere } from './stages.js';
import { lookFor, drawFoe } from './foes.js';
import { drawTelegraph } from './telegraph.js';
import { drawPlayer } from './player.js';
import { spawnFx, drawFx, drawScreenFx, drawSwipes, currentShake, fxLights } from './fx.js';
import { createPost, GRADE } from './post.js';
import { TAU, clamp01, easeInOut, easeOut, lerp, rgba, rng } from './util.js';

export { layout, stageFor, STAGES };
export { TELE } from './foes.js';

const INTRO_MS = 2100;

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/** The letterbox: two bars of deep navy with a thin brass edge. */
function letterbox(ctx, L, k) {
  if (k <= 0.001) return;
  const { w, h } = L;
  const bh = h * (L.phone ? 0.1 : 0.12) * k;
  ctx.save();
  ctx.fillStyle = 'rgb(3,5,10)';
  ctx.fillRect(0, 0, w, bh);
  ctx.fillRect(0, h - bh, w, bh);
  ctx.fillStyle = `rgba(201,162,39,${0.35 * k})`;
  ctx.fillRect(0, bh, w, 1);
  ctx.fillRect(0, h - bh - 1, w, 1);
  ctx.restore();
}

/** The foe's name card: eyebrow, name, a gold rule with a diamond, the epithet. */
function nameCard(ctx, L, name, epithet, a, rise) {
  if (a <= 0.01) return;
  const { cx, s } = L;
  const y = L.floorY - 50 * s + rise;
  const big = Math.max(22, Math.min(40, 30 * s * (L.phone ? 1 : 1.1)));
  ctx.save();
  ctx.globalAlpha = a;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  // a soft dark band so the card reads over any stage
  const bw = Math.min(L.w * 0.96, 640);
  const band = ctx.createLinearGradient(cx - bw / 2, 0, cx + bw / 2, 0);
  band.addColorStop(0, 'rgba(3,5,10,0)');
  band.addColorStop(0.2, 'rgba(3,5,10,0.72)');
  band.addColorStop(0.8, 'rgba(3,5,10,0.72)');
  band.addColorStop(1, 'rgba(3,5,10,0)');
  ctx.fillStyle = band;
  ctx.fillRect(cx - bw / 2, y - big * 2.05, bw, big * 3.6);
  ctx.font = `600 ${Math.round(big * 0.42)}px Cinzel, "Cormorant Garamond", serif`;
  ctx.fillStyle = 'rgba(227,196,99,0.95)';
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.round(big * 0.12)}px`;
  ctx.fillText('THE CHALLENGER', cx, y - big * 1.25);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '1px';
  let size = big;
  ctx.font = `600 ${Math.round(size)}px Cinzel, "Cormorant Garamond", serif`;
  while (ctx.measureText(name).width > bw * 0.84 && size > 14) {
    size -= 1;
    ctx.font = `600 ${Math.round(size)}px Cinzel, "Cormorant Garamond", serif`;
  }
  const tw = ctx.measureText(name).width;
  const ng = ctx.createLinearGradient(0, y - size, 0, y);
  ng.addColorStop(0, '#fffaf0');
  ng.addColorStop(0.55, '#f6e9bd');
  ng.addColorStop(1, '#e3c463');
  ctx.shadowColor = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur = 8;
  ctx.fillStyle = ng;
  ctx.fillText(name, cx, y);
  ctx.shadowBlur = 0;
  // the rule grows out from the centre
  const rw = Math.max(tw * 0.55, 120 * s) * easeOut(clamp01(a * 1.4));
  const ry = y + size * 0.42;
  const rg = ctx.createLinearGradient(cx - rw, 0, cx + rw, 0);
  rg.addColorStop(0, 'rgba(201,162,39,0)');
  rg.addColorStop(0.5, 'rgba(240,220,149,1)');
  rg.addColorStop(1, 'rgba(201,162,39,0)');
  ctx.fillStyle = rg;
  ctx.fillRect(cx - rw, ry - 0.75, rw * 2, 1.5);
  ctx.fillStyle = '#f0dc95';
  ctx.beginPath();
  ctx.moveTo(cx, ry - 4);
  ctx.lineTo(cx + 4, ry);
  ctx.lineTo(cx, ry + 4);
  ctx.lineTo(cx - 4, ry);
  ctx.closePath();
  ctx.fill();
  if (epithet) {
    ctx.font = `italic 500 ${Math.round(Math.max(16, size * 0.62))}px "Cormorant Garamond", Georgia, serif`;
    ctx.fillStyle = 'rgba(232,223,200,0.95)';
    ctx.fillText(epithet, cx, ry + Math.max(18, size * 0.8));
  }
  ctx.restore();
}

/** Shafts of light turning slowly around the struck foe (the finishing blow). */
function godRays(ctx, x, y, r, a, t) {
  if (a <= 0.01) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.translate(x, y);
  ctx.rotate(t * 0.25);
  for (let i = 0; i < 12; i += 1) {
    const ang = (i / 12) * TAU;
    const wid = 0.05 + (i % 3) * 0.025;
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, `rgba(255,244,214,${0.34 * a})`);
    g.addColorStop(1, 'rgba(255,217,122,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r * (0.7 + (i % 2) * 0.3), ang - wid, ang + wid);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

export function createDuelRenderer({ config, archetypeId, reduced = false, intro = true }) {
  const stageId = stageFor(config);
  const stage = STAGES[stageId];
  const grade = GRADE[stageId] ?? GRADE.circle;
  const look = lookFor(config, archetypeId);
  const motion = !reduced;
  const rand = rng(1234);
  const post = createPost();
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
  // the visual clock: real time, except during the slow-motion finish (offset = real - visual)
  let lag = 0;
  let introAt = intro && motion ? null : -1e9;

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
      post.resize(w, h, dpr);
      atmos = createAtmosphere(stageId, L);
    },

    /** Start (or seek) the intro: it began `elapsedMs` before `now`. For the duel lab. */
    seekIntro(now, elapsedMs = 0) {
      introAt = now - elapsedMs;
    },

    /** Feed the engine's events from one step. Returns { hitstopMs }. */
    events(events, now) {
      let hitstopMs = 0;
      const vnow = now - lag;
      for (const ev of events ?? []) {
        if (ev.type !== 'fx') continue;
        const out = spawnFx(fx, ev, vnow, L, rand);
        hitstopMs = Math.max(hitstopMs, out.hitstopMs);
        if (out.hit) {
          react.hitAt = vnow;
          react.hitDir = out.hit.dir;
          react.hitStrength = out.hit.strength;
        }
        if (out.zoom) {
          zoomAt = vnow;
          zoomAmt = out.zoom;
        }
      }
      return { hitstopMs: motion ? hitstopMs : 0 };
    },

    /** Start a swipe trail; returns it so the caller can keep extending `pts` as the finger moves. */
    swipe(points, now) {
      const trail = { pts: points.slice(-24), t0: now - lag };
      swipes.push(trail);
      return trail;
    },

    frame(ctx, duel, realNow, { guarding = false, hold = false } = {}) {
      const realDt = last ? Math.max(0, Math.min(100, realNow - last)) : 16;
      last = realNow;
      // slow motion for the finishing blow: the visual clock runs at a third of real time, then
      // eases back. The engine has already finished; nothing here touches it.
      let rate = 1;
      if (react.overAt != null && react.outcome === 'victory' && motion) {
        const since = realNow - lag - react.overAt;
        rate = since < 650 ? 0.3 : Math.min(1, 0.3 + (since - 650) / 900);
        lag += realDt * (1 - rate);
      }
      const now = realNow - lag;
      const t = now / 1000;
      const dt = realDt * rate;
      const { w, h, cx } = L;
      if (duel.phase === 'over' && react.overAt == null) {
        react.overAt = now;
        react.outcome = duel.outcome;
      }
      if (introAt == null && !hold) introAt = realNow;
      const ik = introAt == null ? 0 : clamp01((realNow - introAt) / INTRO_MS);
      const hitK = clamp01(1 - (now - react.hitAt) / 240) * react.hitStrength;
      const overMs = react.overAt == null ? -1 : now - react.overAt;
      const reactNow = {
        hitK: motion ? easeOut(hitK) : 0,
        hitDir: react.hitDir,
        overK: react.overAt == null ? 0 : clamp01(overMs / 700),
        outcome: react.outcome,
      };

      // camera: the world slides opposite your dodge; a punch-in on the biggest moments; the
      // opening push-in
      const p = duel.player;
      const targetX = p.dodge.active ? (p.dodge.side === 'left' ? 1 : -1) * 34 * L.s : 0;
      camX = motion ? lerp(camX, targetX, 1 - Math.exp(-dt / 70)) : 0;
      const zk = clamp01(1 - (now - zoomAt) / 420);
      let zoom = motion ? 1 + 0.035 * zoomAmt * Math.sin(zk * Math.PI) : 1;
      if (motion && introAt != null) zoom *= 1 + 0.12 * (1 - easeOut(clamp01((realNow - introAt) / 1700)));
      if (motion && introAt == null) zoom *= 1.12;
      if (motion && react.outcome === 'victory') zoom *= 1 + 0.06 * easeInOut(clamp01(overMs / 1400));

      ctx.clearRect(0, 0, w, h);
      if (backdrop) {
        // the backdrop moves less than the foe: a touch of depth
        ctx.save();
        const bz = 1 + (zoom - 1) * 0.5;
        ctx.translate(cx, h * 0.5);
        ctx.scale(bz, bz);
        ctx.translate(-cx + camX * 0.4, -h * 0.5);
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

      // the finishing blow: slow shafts of light turning behind the struck foe
      if (react.outcome === 'victory' && overMs >= 0) {
        const torsoY = L.floorY - 175 * L.s;
        if (motion) godRays(ctx, cx, torsoY, Math.max(w, h) * 0.7, clamp01(overMs / 300) * clamp01(1 - (overMs - 1100) / 900), t);
        else godRays(ctx, cx, torsoY, Math.max(w, h) * 0.6, 0.6, 0);
      }

      // the foe, on its own layer: lit, flashed when struck, mirrored in wet ground, rim-lit
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
        post.foeLight(layer, L, stage.light, motion ? fxLights(fx, now, L) : [], { rimA: look.spectral ? 0.35 : 0.62, spectral: look.spectral });
        let foeA = 1;
        if (reactNow.overK > 0 && react.outcome === 'victory' && look.spectral) foeA = 1 - reactNow.overK * 0.9;
        ctx.globalAlpha = foeA;
        post.reflect(ctx, layer, L, grade, t, motion);
        ctx.drawImage(layer, 0, 0, w, h);
        post.rimTo(ctx);
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

      // light and grade
      let boost = 0;
      if (react.outcome === 'victory' && overMs >= 0) boost = 0.5 * clamp01(1 - overMs / 1600);
      post.bloom(ctx, L, grade, boost);
      const cold = react.outcome && react.outcome !== 'victory' && overMs >= 0 ? clamp01(overMs / 900) : 0;
      post.grade(ctx, L, grade, { cold });

      // the finishing blow: a white-gold flash blooming out of the struck foe
      if (react.outcome === 'victory' && overMs >= 0 && motion) {
        const fk = clamp01(overMs / 420);
        const fa = (1 - fk) * (1 - fk);
        if (fa > 0.01) {
          const torsoY = L.floorY - 175 * L.s;
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          const r = Math.max(w, h) * (0.35 + 0.5 * easeOut(fk));
          const fg = ctx.createRadialGradient(cx, torsoY, 0, cx, torsoY, r);
          fg.addColorStop(0, rgba([255, 250, 236], 0.7 * fa));
          fg.addColorStop(0.35, rgba([255, 228, 160], 0.35 * fa));
          fg.addColorStop(1, rgba([255, 217, 122], 0));
          ctx.fillStyle = fg;
          ctx.fillRect(0, 0, w, h);
          ctx.fillStyle = rgba([255, 244, 214], 0.18 * fa);
          ctx.fillRect(0, 0, w, h);
          ctx.restore();
        }
      }

      // the letterbox: open on the intro, close again on the last blow
      let bars = 0;
      if (motion) {
        if (introAt == null) bars = 1;
        else bars = 1 - easeInOut(clamp01((realNow - introAt - 700) / 750));
        if (react.overAt != null) bars = Math.max(bars, easeInOut(clamp01(overMs / 600)));
      }
      letterbox(ctx, L, bars);
      if (motion && introAt != null && ik < 1) {
        const e = realNow - introAt;
        const a = clamp01((e - 120) / 380) * clamp01(1 - (e - 1450) / 450);
        nameCard(ctx, L, duel.config?.title || duel.def?.name || '', duel.config?.subtitle || duel.def?.epithet || '', a, (1 - easeOut(clamp01((e - 120) / 600))) * 10 * L.s);
        // the held dim lifts as the camera starts to move
        const fade = 0.25 * (1 - clamp01(e / 520));
        if (fade > 0) {
          ctx.fillStyle = `rgba(3,5,10,${fade})`;
          ctx.fillRect(0, 0, w, h);
        }
      } else if (motion && introAt == null) {
        // held behind the intro card: the scene waits, dimmed
        ctx.fillStyle = 'rgba(3,5,10,0.25)';
        ctx.fillRect(0, 0, w, h);
      }
    },
  };
}
