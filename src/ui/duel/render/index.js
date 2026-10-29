// The duel renderer. DuelScreen owns the engine loop and the input; this owns every pixel:
//
//   const r = createDuelRenderer({ config, archetypeId, reduced, intro });
//   r.resize(cssW, cssH, dpr);
//   const { hitstopMs } = r.events(duel.events, now);   // after each stepDuel
//   r.frame(ctx, duel, now, { guarding, hold });         // every animation frame
//   r.swipe(points, now);                                // a strike gesture, for its trail
//   r.dprCap                                             // the canvas resolution the tier allows
//   r.introShowing(now)                                  // the opening name card is on screen
//
// The frame is built on a budget (see ./post.js): the static scenery, its big soft lights, the
// stage's colour grade and the vignette are painted once per resize into the backdrop; the foe is
// drawn into a small layer that covers only its box, lit there, rim-lit and mirrored in wet
// ground; the Sovereign's arm and blade are a cached sprite with live light drawn over it. Nothing
// reads the frame back. If frames run long the renderer steps down a quality tier (a smaller foe
// layer, fewer particles, no rim, then a lower canvas resolution). Only the look changes: the
// engine keeps its fixed timestep whatever the tier.
//
// Cinema: the fight opens with a push-in, letterbox bars sliding away and the foe's name on a gold
// rule in the sky band at the top (the HUD's nameplate waits until it has gone; it starts on the
// first frame not held by `hold`, i.e. once the intro card is dismissed). A win ends in a
// slow-motion beat with a warm flash and turning shafts of light; a loss drains and darkens the
// colour. Hitstop, slow motion and the camera are cosmetic: both sides freeze together, and the
// slow motion only begins once the engine has declared the duel over.

import { layout, stageFor, STAGES, paintStage, animateStage, createAtmosphere, drawAtmosphere } from './stages.js';
import { lookFor, drawFoe, drawFoeFocal, drawFoeShadow } from './foes.js';
import { drawTelegraph } from './telegraph.js';
import { drawPlayer, createPlayerArt } from './player.js';
import { spawnFx, drawFx, drawScreenFx, drawSwipes, currentShake, fxLights } from './fx.js';
import { createPost, bakeGrade, GRADE, TIERS } from './post.js';
import { TAU, clamp01, easeInOut, easeOut, glow, lerp, rgba, rng } from './util.js';

export { layout, stageFor, STAGES };
export { TELE } from './foes.js';

const INTRO_MS = 2100;
// dev only: ?off=foe,stage,atmos,player,bd,refl,rim,ghost,light switches passes off, for profiling
const OFF = new Set(import.meta.env?.DEV ? (new URLSearchParams(globalThis.location?.search ?? '').get('off') ?? '').split(',') : []);
const CARD_OUT_MS = 1750; // the name card has gone by then; the HUD's nameplate takes over

/** The camera is at rest (no zoom, no slide): the backdrop can be copied without scaling. */
const bzStill = (zoom, camX) => Math.abs(zoom - 1) < 1e-3 && Math.abs(camX) < 0.05;

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/** The letterbox: two bars of navy-black, the same height top and bottom, no edge line. */
function letterbox(ctx, L, k) {
  if (k <= 0.001) return;
  const { w, h } = L;
  const bh = Math.round(h * (L.phone ? 0.1 : 0.12) * k);
  ctx.fillStyle = 'rgb(3,5,10)';
  ctx.fillRect(0, 0, w, bh);
  ctx.fillRect(0, h - bh, w, bh);
}

/**
 * The foe's name card, in the sky band under the top bar (where the HUD's nameplate will sit):
 * eyebrow, name, a gold rule with a diamond, the epithet, over a soft scrim. It never covers the
 * foe or the blade, and it is either fully there or on its way out (rising into the HUD slot).
 */
function nameCard(ctx, L, name, epithet, a, rise) {
  if (a <= 0.01) return;
  const { cx, s, w } = L;
  const top = L.h * (L.phone ? 0.1 : 0.12);
  const big = Math.max(22, Math.min(38, 30 * s * (L.phone ? 1 : 1.1)));
  const y0 = top + big * 0.95 - rise;
  ctx.save();
  // the scrim: the top bar's navy, fading down behind the type
  const sh = big * 4.6;
  const sg = ctx.createLinearGradient(0, top - 1, 0, top + sh);
  sg.addColorStop(0, `rgba(3,5,10,${0.86 * a})`);
  sg.addColorStop(0.62, `rgba(3,5,10,${0.62 * a})`);
  sg.addColorStop(1, 'rgba(3,5,10,0)');
  ctx.fillStyle = sg;
  ctx.fillRect(0, top - 1, w, sh + 1);
  ctx.globalAlpha = a;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `600 ${Math.round(big * 0.4)}px Cinzel, "Cormorant Garamond", serif`;
  ctx.fillStyle = 'rgb(227,196,99)';
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.round(big * 0.12)}px`;
  ctx.fillText('THE CHALLENGER', cx, y0);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '1px';
  const maxW = Math.min(w - 32, 620);
  let size = big;
  ctx.font = `600 ${Math.round(size)}px Cinzel, "Cormorant Garamond", serif`;
  while (ctx.measureText(name).width > maxW && size > 15) {
    size -= 1;
    ctx.font = `600 ${Math.round(size)}px Cinzel, "Cormorant Garamond", serif`;
  }
  const y1 = y0 + big * 0.35 + size;
  const tw = ctx.measureText(name).width;
  const ng = ctx.createLinearGradient(0, y1 - size, 0, y1);
  ng.addColorStop(0, '#fffaf0');
  ng.addColorStop(0.55, '#f6e9bd');
  ng.addColorStop(1, '#e3c463');
  ctx.shadowColor = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 1;
  ctx.fillStyle = ng;
  ctx.fillText(name, cx, y1);
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  // the rule grows out from the centre
  const rw = Math.max(tw * 0.5, 110 * s) * easeOut(clamp01(a * 1.4));
  const ry = y1 + size * 0.4;
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
    ctx.font = `italic 500 ${Math.round(Math.max(16, size * 0.6))}px "Cormorant Garamond", Georgia, serif`;
    ctx.fillStyle = 'rgb(232,223,200)';
    ctx.fillText(epithet, cx, ry + Math.max(19, size * 0.82));
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
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  g.addColorStop(0, `rgba(255,236,196,${0.3 * a})`);
  g.addColorStop(1, 'rgba(255,217,122,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  for (let i = 0; i < 12; i += 1) {
    const ang = (i / 12) * TAU;
    const wid = 0.05 + (i % 3) * 0.025;
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r * (0.7 + (i % 2) * 0.3), ang - wid, ang + wid);
    ctx.closePath();
  }
  ctx.fill();
  ctx.restore();
}

export function createDuelRenderer({ config, archetypeId, reduced = false, intro = true, quality = null }) {
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
  let arm = null;
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

  // adaptive quality: the median frame time over a window steps the tier down, never up
  const pinned = quality != null;
  let tierIdx = pinned ? Math.max(0, Math.min(TIERS.length - 1, quality)) : 0;
  const times = [];
  let seen = 0;
  const tier = () => TIERS[tierIdx];
  function applyTier() {
    post.resize(L, dpr, tier());
    atmos = createAtmosphere(stageId, L, tier().particles);
  }
  function measure(frameMs) {
    if (pinned || tierIdx >= TIERS.length - 1) return;
    seen += 1;
    if (seen <= 20) return; // let the page settle (fonts, JIT) first
    times.push(frameMs);
    if (times.length < 24) return;
    const med = [...times].sort((a, b) => a - b)[times.length >> 1];
    times.length = 0;
    if (med > 24) {
      tierIdx = Math.min(TIERS.length - 1, tierIdx + (med > 60 ? 2 : 1));
      applyTier();
    }
  }

  return {
    stageId,
    stage,
    look,
    layout: () => L,
    /** The canvas resolution the current quality tier allows (DuelScreen resizes to it). */
    get dprCap() {
      return tier().dprCap;
    },
    get tier() {
      return tierIdx;
    },

    resize(w, h, ratio) {
      L = layout(w, h);
      dpr = ratio;
      backdrop = canvas(w * dpr, h * dpr);
      const bctx = backdrop.getContext('2d');
      bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paintStage(bctx, L, stageId);
      // the light behind the foe, so it reads at night (baked: it never moves)
      glow(bctx, L.cx, L.floorY - 160 * L.s, 260 * L.s, stage.light.back, look.spectral ? 0.26 : 0.18);
      bakeGrade(bctx, L, grade);
      arm = createPlayerArt(L, dpr);
      applyTier();
    },

    /** Start (or seek) the intro: it began `elapsedMs` before `now`. For the duel lab. */
    seekIntro(now, elapsedMs = 0) {
      introAt = now - elapsedMs;
    },

    /** True while the opening name card is up (the HUD keeps its nameplate hidden meanwhile). */
    introShowing(now) {
      if (!motion || !intro) return false;
      if (introAt == null) return true;
      return now - introAt < CARD_OUT_MS - 150;
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
      if (last) measure(realNow - last);
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

      if (backdrop && bzStill(zoom, camX)) {
        // at rest: a straight 1:1 copy (no resampling)
        if (!OFF.has('bd')) {
          ctx.save();
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.drawImage(backdrop, 0, 0);
          ctx.restore();
        }
      } else if (backdrop) {
        // the backdrop moves less than the foe: a touch of depth (it always covers the frame)
        ctx.save();
        const bz = 1 + (zoom - 1) * 0.5;
        ctx.translate(cx, h * 0.5);
        ctx.scale(bz, bz);
        ctx.translate(-cx + camX * 0.4, -h * 0.5);
        if (!OFF.has('bd')) ctx.drawImage(backdrop, -camX * 0.4 - 2, 0, w + 4, h);
        ctx.restore();
      } else ctx.clearRect(0, 0, w, h);
      const sh = currentShake(fx, now, motion, L.s);
      ctx.save();
      ctx.translate(sh.x, sh.y);
      ctx.translate(cx, h * 0.5);
      ctx.scale(zoom, zoom);
      ctx.translate(-cx + camX, -h * 0.5);
      if (!OFF.has('stage')) animateStage(ctx, L, stageId, t, motion);
      if (!OFF.has('atmos')) drawAtmosphere(ctx, L, atmos, dt, t, motion);

      // the finishing blow: slow shafts of light turning behind the struck foe
      if (react.outcome === 'victory' && overMs >= 0) {
        const torsoY = L.floorY - 175 * L.s;
        if (motion) godRays(ctx, cx, torsoY, Math.max(w, h) * 0.7, clamp01(overMs / 300) * clamp01(1 - (overMs - 1100) / 900), t);
        else godRays(ctx, cx, torsoY, Math.max(w, h) * 0.6, 0.6, 0);
      }

      // the foe, on its own small layer: lit, flashed when struck, mirrored in wet ground, rim-lit
      drawFoeShadow(ctx, L, look);
      const lctx = post.begin();
      if (!OFF.has('foe')) drawFoe(lctx, L, duel, t, look, stage.light, reactNow);
      // the hit flash: a blink of the silhouette over a couple of frames, never a white-out
      const flash = motion ? clamp01(1 - (now - react.hitAt) / 70) * 0.26 * react.hitStrength : 0;
      if (!OFF.has('light')) post.light(L, stage.light, motion ? fxLights(fx, now, L) : [], { spectral: look.spectral, flash });
      let foeA = 1;
      if (reactNow.overK > 0 && react.outcome === 'victory' && look.spectral) foeA = 1 - reactNow.overK * 0.9;
      ctx.globalAlpha = foeA;
      if (!OFF.has('refl')) post.reflect(ctx, L, grade, t, motion);
      post.composite(ctx, L, stage.light, now, {
        // the echo is an afterimage: its body is translucent (the stones show through), its
        // crown, eyes and blade edge are drawn over it at full strength
        alpha: look.spectral ? 0.6 : 1,
        rimA: OFF.has('rim') ? 0 : look.spectral ? 0.16 : 0.26,
        ghost: !OFF.has('ghost') && look.spectral && motion ? { alpha: 0.2, tint: 'rgba(150,132,214,0.55)' } : null,
      });
      if (look.spectral && !OFF.has('foe')) drawFoeFocal(ctx, L, duel, t, look, stage.light, reactNow);
      ctx.globalAlpha = 1;
      drawTelegraph(ctx, L, duel, t, motion);
      drawFx(ctx, L, fx, now);
      ctx.restore();

      // the Sovereign's blade rides the shake but not the parallax
      ctx.save();
      ctx.translate(sh.x, sh.y);
      if (!OFF.has('player')) drawPlayer(ctx, L, duel, t, guarding, bladeHist, motion, arm);
      ctx.restore();
      drawSwipes(ctx, L, swipes, now);
      drawScreenFx(ctx, L, fx, now);

      // a loss drains the colour and lets the dark in (cool, never chalky)
      const cold = react.outcome && react.outcome !== 'victory' && overMs >= 0 ? clamp01(overMs / 900) : 0;
      if (cold > 0.01) {
        ctx.save();
        ctx.globalCompositeOperation = 'saturation';
        ctx.fillStyle = `rgba(128,128,128,${0.62 * cold})`;
        ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = rgba([lerp(255, 168, cold), lerp(255, 176, cold), lerp(255, 196, cold)]);
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
      }

      // the finishing blow: a warm flash blooming out of the struck foe
      if (react.outcome === 'victory' && overMs >= 0 && motion) {
        const fk = clamp01(overMs / 420);
        const fa = (1 - fk) * (1 - fk);
        if (fa > 0.01) {
          const torsoY = L.floorY - 175 * L.s;
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          const r = Math.max(w, h) * (0.35 + 0.5 * easeOut(fk));
          const fg = ctx.createRadialGradient(cx, torsoY, 0, cx, torsoY, r);
          fg.addColorStop(0, rgba([255, 240, 212], 0.5 * fa));
          fg.addColorStop(0.35, rgba([255, 214, 150], 0.24 * fa));
          fg.addColorStop(1, rgba([255, 200, 120], 0));
          ctx.fillStyle = fg;
          ctx.fillRect(0, 0, w, h);
          ctx.restore();
        }
      }

      // the letterbox: open on the intro, close again (part way) on the last blow
      let bars = 0;
      if (motion) {
        if (introAt == null) bars = 1;
        else bars = 1 - easeInOut(clamp01((realNow - introAt - 700) / 750));
        if (react.overAt != null) bars = Math.max(bars, 0.7 * easeInOut(clamp01(overMs / 600)));
      }
      letterbox(ctx, L, bars);
      if (motion && introAt != null && ik < 1) {
        const e = realNow - introAt;
        // fully there quickly; on the way out it rises toward the HUD's nameplate as it fades
        const out = clamp01((e - 1400) / (CARD_OUT_MS - 1400));
        const a = clamp01((e - 80) / 220) * (1 - out);
        nameCard(ctx, L, duel.config?.title || duel.def?.name || '', duel.config?.subtitle || duel.def?.epithet || '', a, easeInOut(out) * 26 * L.s);
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
