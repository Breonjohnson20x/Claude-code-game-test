// The Sovereign's side of the frame: the blade in a gauntleted hand, the Shield Ward, the guard.
// The blade swings along the strike you made and leaves a crescent of light behind it. The arm is
// drawn in "s-units" around the grip (blade up = negative y), lit from the upper right: an engraved
// vambrace with a warm magitech thread and the Architect's broken circle on a brass boss, a plated
// fist, a brass crossguard with an ember stone, and a bevelled blade with a fuller of light that
// brightens as the Arc Pulse charges.

import { TAU, clamp01, easeOut, glow, hex, lerp, mix, rgba } from './util.js';

// steel and brass from the theme's iron, gold, brass and lattice scales
const STEEL = hex('#c3c7cc');
const STEEL_HI = hex('#f3f6fa');
const IRON = hex('#5d636b');
const IRON_DARK = hex('#1b1d21');
const NAVY = hex('#16243a');
const BRASS = hex('#b08d57');
const BRASS_HI = hex('#f0dc95');
const BRASS_DARK = hex('#4f3d0d');
const LEATHER = hex('#3a2a1e');
const LATTICE = hex('#ffd97a');
const LATTICE_HI = hex('#fff4d6');

function bladeAngle(p, guarding) {
  if (p.swingMs > 0 && p.swingDurMs > 0) {
    const k = easeOut(1 - p.swingMs / p.swingDurMs);
    const d = p.swingDir;
    if (d === 'left') return { a: lerp(0.7, -1.9, k), k, d };
    if (d === 'right') return { a: lerp(-1.5, 1.0, k), k, d };
    if (d === 'down') return { a: lerp(-1.4, 0.4, k), k, d };
    return { a: lerp(0.2, -1.4, k), k, d };
  }
  if (guarding) return { a: -1.32, k: 0, d: null };
  return { a: -0.2, k: 0, d: null };
}

const bladeLength = (L) => Math.min(L.h * (L.phone ? 0.27 : 0.34), 250 * L.s);

/**
 * Paint the arm, hilt and blade once (per resize) into a sprite: they are rigid, and their
 * engraving, rivets and bevels are most of the cost. The light that lives on them (the magitech
 * thread, the stones, the running glint) is drawn over the sprite every frame.
 */
export function createPlayerArt(L, dpr) {
  const { s } = L;
  const bl = bladeLength(L) / s;
  const x0 = -54;
  const x1 = 56;
  const y0 = -bl - 4;
  const y1 = 274;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round((x1 - x0) * s * dpr));
  c.height = Math.max(1, Math.round((y1 - y0) * s * dpr));
  const g = c.getContext('2d');
  g.setTransform(s * dpr, 0, 0, s * dpr, -x0 * s * dpr, -y0 * s * dpr);
  drawArm(g);
  if (L.phone) {
    // on phones the controls own the bottom of the screen: the vambrace sinks into the dark
    // below the fist, so the engraving never fights the buttons drawn over it
    g.save();
    g.globalCompositeOperation = 'destination-out';
    const fg = g.createLinearGradient(0, 58, 0, 150);
    fg.addColorStop(0, 'rgba(0,0,0,0)');
    fg.addColorStop(1, 'rgba(0,0,0,0.62)');
    g.fillStyle = fg;
    g.fillRect(x0, 58, x1 - x0, y1 - 58);
    g.restore();
  }
  drawHilt(g);
  drawBlade(g, bl);
  return { canvas: c, x0, y0, w: x1 - x0, h: y1 - y0, bl };
}

/**
 * Draw the blade. `hist` is the renderer's short history of blade angles, for the swing trail;
 * `art` is the cached sprite from createPlayerArt (drawn from scratch without it).
 */
export function drawPlayer(ctx, L, duel, t, guarding, hist, motion, art = null) {
  const { w, h, cx, s, bladeY } = L;
  const p = duel.player;

  // Shield Ward: a dome of lattice light rising from below
  if (p.wardHeld && p.wardBrokenMs <= 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const r = Math.min(w * 0.66, h * 0.58);
    const g = ctx.createRadialGradient(cx, h * 1.04, r * 0.6, cx, h * 1.04, r);
    g.addColorStop(0, 'rgba(255,233,174,0)');
    g.addColorStop(0.9, 'rgba(255,217,122,0.2)');
    g.addColorStop(1, 'rgba(255,217,122,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,224,150,0.6)';
    ctx.lineWidth = 2.4 * s;
    ctx.beginPath();
    ctx.arc(cx, h * 1.04, r, Math.PI * 1.04, Math.PI * 1.96);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,224,150,0.18)';
    for (let i = 1; i < 6; i += 1) {
      const a = Math.PI * (1.04 + (0.92 * i) / 6);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r * 0.55, h * 1.04 + Math.sin(a) * r * 0.55);
      ctx.lineTo(cx + Math.cos(a) * r, h * 1.04 + Math.sin(a) * r);
      ctx.stroke();
    }
    // the lattice: an inner arc of light where the ribs meet
    ctx.strokeStyle = 'rgba(255,224,150,0.28)';
    ctx.lineWidth = 1.4 * s;
    ctx.beginPath();
    ctx.arc(cx, h * 1.04, r * 0.78, Math.PI * 1.06, Math.PI * 1.94);
    ctx.stroke();
    ctx.restore();
  }

  const { a: angle, k: swingK, d: swingDir } = bladeAngle(p, guarding);
  let ox = 0;
  let oy = 0;
  if (guarding) {
    ox = -58 * s;
    oy = -70 * s;
  }
  if (swingDir) oy = -50 * s * Math.sin(swingK * Math.PI);
  if (p.dodge.active) ox += (p.dodge.side === 'left' ? -1 : 1) * 30 * s;
  if (p.stunMs > 0 && motion) {
    ox += Math.sin(t * 50) * 4 * s;
    oy += 18 * s;
  }
  const idle = motion ? Math.sin(t * 1.8) * 4 * s : 0;
  // at rest the crossguard sits low and right, so the blade rests beside the foe's hip
  // (on wide screens it sits in the gap between the Sovereign's bar and the right-hand controls)
  const bx = cx + (L.phone ? 122 * s : Math.max(112 * s, L.w * 0.15)) + ox;
  const by = bladeY + oy + idle;
  const len = bladeLength(L);

  // swing trail: a crescent of light along the recent arc, brightest at the tip
  hist.push({ a: angle, x: bx, y: by, at: t });
  while (hist.length && t - hist[0].at > 0.16) hist.shift();
  if (swingDir && hist.length > 2 && motion) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const tipAt = (e, f) => [e.x + Math.sin(e.a) * len * f, e.y - Math.cos(e.a) * len * f];
    for (let i = 1; i < hist.length; i += 1) {
      const h0 = hist[i - 1];
      const h1 = hist[i];
      const fade = i / hist.length;
      const [ax, ay] = tipAt(h0, 1);
      const [tx, ty] = tipAt(h1, 1);
      const [ix, iy] = tipAt(h1, 0.35);
      const g = ctx.createLinearGradient(tx, ty, ix, iy);
      g.addColorStop(0, rgba(LATTICE_HI, 0.5 * fade));
      g.addColorStop(0.35, rgba(LATTICE, 0.22 * fade));
      g.addColorStop(1, rgba(LATTICE, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(...tipAt(h0, 0.35));
      ctx.lineTo(ax, ay);
      ctx.lineTo(tx, ty);
      ctx.lineTo(ix, iy);
      ctx.closePath();
      ctx.fill();
    }
    // the hard edge the point cut through the air
    ctx.strokeStyle = 'rgba(255,250,240,0.85)';
    ctx.lineWidth = 2 * s;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    hist.forEach((e, i) => {
      const [x, y] = tipAt(e, 0.99);
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    });
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  ctx.translate(bx, by);
  ctx.rotate(angle);
  ctx.scale(s, s);
  const bl = len / s;
  if (guarding) glow(ctx, 0, -bl * 0.55, bl * 0.5, hex('#ffe9ae'), 0.2);
  const pulse = motion ? 0.75 + 0.25 * Math.sin(t * 2.6) : 0.85;
  const charged = clamp01(p.arcCharge ?? 0);
  if (art && Math.abs(art.bl - bl) < 0.5) ctx.drawImage(art.canvas, art.x0, art.y0, art.w, art.h);
  else {
    drawArm(ctx);
    drawHilt(ctx);
    drawBlade(ctx, bl);
  }
  armLights(ctx, pulse, charged, L.phone ? 0.45 : 1);
  bladeLights(ctx, bl, t, motion, Boolean(swingDir), pulse, charged);
  ctx.restore();
}

// ── the arm: an engraved vambrace over a navy sleeve, a plated fist on a leather grip ──────────

function steelAcross(ctx, x0, x1, base, rimK = 1) {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, rgba(mix(base, IRON_DARK, 0.75)));
  g.addColorStop(0.35, rgba(mix(base, IRON_DARK, 0.25)));
  g.addColorStop(0.62, rgba(base));
  g.addColorStop(0.8, rgba(mix(base, STEEL_HI, 0.55 * rimK)));
  g.addColorStop(0.9, rgba(mix(base, IRON_DARK, 0.1)));
  g.addColorStop(1, rgba(mix(base, IRON_DARK, 0.45)));
  return g;
}

function rivet(ctx, x, y, r = 2.6) {
  ctx.fillStyle = rgba(BRASS_DARK);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.fillStyle = rgba(BRASS_HI);
  ctx.beginPath();
  ctx.arc(x + r * 0.3, y - r * 0.3, r * 0.45, 0, TAU);
  ctx.fill();
}

function brassBand(ctx, y0, y1, wA, wB) {
  const g = ctx.createLinearGradient(-wA, 0, wB, 0);
  g.addColorStop(0, rgba(BRASS_DARK));
  g.addColorStop(0.55, rgba(BRASS));
  g.addColorStop(0.8, rgba(BRASS_HI));
  g.addColorStop(1, rgba(BRASS_DARK));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-wA, y0);
  ctx.quadraticCurveTo(1, y0 + 6, wB, y0);
  ctx.lineTo(wB + 1.5, y1);
  ctx.quadraticCurveTo(1, y1 + 6, -wA - 1.5, y1);
  ctx.closePath();
  ctx.fill();
}

function drawArm(ctx) {
  // the sleeve, disappearing off the bottom of the frame
  ctx.fillStyle = steelAcross(ctx, -40, 50, NAVY, 0.35);
  ctx.beginPath();
  ctx.moveTo(-30, 150);
  ctx.quadraticCurveTo(-40, 200, -36, 270);
  ctx.lineTo(50, 270);
  ctx.quadraticCurveTo(48, 200, 40, 150);
  ctx.closePath();
  ctx.fill();
  // vambrace: a tapered plate with a raised centre ridge
  ctx.fillStyle = steelAcross(ctx, -34, 38, IRON);
  ctx.beginPath();
  ctx.moveTo(-21, 44);
  ctx.quadraticCurveTo(-30, 100, -31, 168);
  ctx.quadraticCurveTo(4, 178, 39, 168);
  ctx.quadraticCurveTo(34, 100, 23, 44);
  ctx.closePath();
  ctx.fill();
  brassBand(ctx, 44, 54, 22, 24);
  brassBand(ctx, 156, 170, 30, 38);
  // the ridge: a dark crease and a bright crest beside it
  ctx.lineCap = 'round';
  ctx.strokeStyle = rgba(IRON_DARK, 0.7);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(2, 58);
  ctx.quadraticCurveTo(3, 110, 4, 154);
  ctx.stroke();
  ctx.strokeStyle = rgba(STEEL_HI, 0.75);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(4.5, 58);
  ctx.quadraticCurveTo(5.5, 110, 6.5, 154);
  ctx.stroke();
  // engraved filigree: scrolls of gold inlay either side of the ridge
  ctx.strokeStyle = rgba(BRASS_HI, 0.7);
  ctx.lineWidth = 1.2;
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(sx * 6 + 3, 76);
    ctx.bezierCurveTo(sx * 18 + 3, 82, sx * 16 + 3, 96, sx * 9 + 3, 100);
    ctx.bezierCurveTo(sx * 4 + 3, 103, sx * 6 + 3, 110, sx * 12 + 3, 108);
    ctx.moveTo(sx * 7 + 3, 120);
    ctx.bezierCurveTo(sx * 20 + 3, 128, sx * 18 + 3, 142, sx * 9 + 3, 146);
    ctx.stroke();
  }
  // the magitech channel, unlit (armLights runs the light along it)
  ctx.strokeStyle = rgba(BRASS_DARK, 0.9);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-8, 150);
  ctx.quadraticCurveTo(-8, 110, -4, 76);
  ctx.stroke();
  // the medallion: a brass boss with the Architect's broken circle
  const mg = ctx.createRadialGradient(0, 64, 1, -3, 68, 11);
  mg.addColorStop(0, rgba(BRASS_HI));
  mg.addColorStop(0.6, rgba(BRASS));
  mg.addColorStop(1, rgba(BRASS_DARK));
  ctx.fillStyle = mg;
  ctx.beginPath();
  ctx.arc(-3, 68, 9.5, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = rgba(IRON_DARK, 0.85);
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(-3, 68, 5.5, -1.2, 4.4);
  ctx.stroke();
  for (const [x, y] of [[-24, 122], [30, 122], [-27, 148], [34, 148]]) rivet(ctx, x, y, 2.2);

  // the fist around the grip: a back-of-hand plate, four knuckle plates, the thumb across
  ctx.fillStyle = steelAcross(ctx, -26, 28, IRON);
  ctx.beginPath();
  ctx.moveTo(-22, 46);
  ctx.quadraticCurveTo(-29, 26, -24, 8);
  ctx.quadraticCurveTo(0, 0, 25, 8);
  ctx.quadraticCurveTo(30, 26, 24, 46);
  ctx.closePath();
  ctx.fill();
  for (let i = 0; i < 4; i += 1) {
    const x = -16 + i * 11;
    const y = 10 + Math.abs(i - 1.5) * 1.5;
    const kg = ctx.createLinearGradient(x - 6, y - 5, x + 6, y + 6);
    kg.addColorStop(0, rgba(mix(IRON, STEEL_HI, 0.55)));
    kg.addColorStop(0.5, rgba(IRON));
    kg.addColorStop(1, rgba(IRON_DARK));
    ctx.fillStyle = kg;
    ctx.beginPath();
    ctx.ellipse(x, y, 6.2, 7.5, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = rgba(IRON_DARK, 0.8);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = rgba(STEEL_HI, 0.8);
    ctx.beginPath();
    ctx.ellipse(x + 2, y - 3, 2, 1.2, -0.5, 0, TAU);
    ctx.fill();
  }
  // knuckle trim and two finger lames below it
  ctx.strokeStyle = rgba(BRASS, 0.95);
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-23, 19);
  ctx.quadraticCurveTo(1, 24, 25, 19);
  ctx.stroke();
  for (const y of [28, 36]) {
    ctx.strokeStyle = rgba(IRON_DARK, 0.85);
    ctx.beginPath();
    ctx.moveTo(-24, y);
    ctx.quadraticCurveTo(1, y + 5, 26, y);
    ctx.stroke();
    ctx.strokeStyle = rgba(STEEL_HI, 0.35);
    ctx.beginPath();
    ctx.moveTo(-20, y + 1.5);
    ctx.quadraticCurveTo(1, y + 6.5, 24, y + 1.5);
    ctx.stroke();
  }
  // the thumb, curled over the front of the grip
  ctx.fillStyle = steelAcross(ctx, -30, -4, IRON, 0.8);
  ctx.beginPath();
  ctx.moveTo(-27, 30);
  ctx.quadraticCurveTo(-34, 12, -18, 2);
  ctx.quadraticCurveTo(-6, -2, -4, 6);
  ctx.quadraticCurveTo(-12, 12, -16, 32);
  ctx.closePath();
  ctx.fill();
  rivet(ctx, 12, 40, 2);
}

/** The live light on the arm and hilt: the magitech thread, the medallion and the ember stone. */
function armLights(ctx, pulse, charged, dim = 1) {
  const live = Math.min(1.2, 0.45 + 0.4 * pulse + 0.4 * charged) * dim;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.strokeStyle = rgba(LATTICE, 0.3 * live);
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-8, 150);
  ctx.quadraticCurveTo(-8, 110, -4, 76);
  ctx.stroke();
  ctx.strokeStyle = rgba(LATTICE_HI, 0.85 * Math.min(1, live));
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.restore();
  glow(ctx, -3, 68, 16, LATTICE, 0.28 * live);
  glow(ctx, 0, -13, 16, hex('#f4a35e'), 0.3 + 0.2 * pulse);
}

// ── the hilt: a leather grip, a brass crossguard with down-turned quillons and an ember stone ──

function drawHilt(ctx) {
  // the grip, between fist and guard
  ctx.fillStyle = rgba(LEATHER);
  ctx.fillRect(-7, -9, 14, 12);
  ctx.strokeStyle = rgba(mix(LEATHER, STEEL_HI, 0.25), 0.7);
  ctx.lineWidth = 1.1;
  for (let y = -8; y < 3; y += 4) {
    ctx.beginPath();
    ctx.moveTo(-7, y + 3);
    ctx.lineTo(7, y);
    ctx.stroke();
  }
  // quillons
  const cg = ctx.createLinearGradient(0, -20, 0, -2);
  cg.addColorStop(0, rgba(BRASS_HI));
  cg.addColorStop(0.45, rgba(BRASS));
  cg.addColorStop(1, rgba(BRASS_DARK));
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.moveTo(-14, -18);
  ctx.bezierCurveTo(-30, -20, -40, -16, -46, -8);
  ctx.quadraticCurveTo(-48, -2, -43, -1);
  ctx.bezierCurveTo(-36, -9, -26, -10, -14, -7);
  ctx.lineTo(14, -7);
  ctx.bezierCurveTo(26, -10, 36, -9, 43, -1);
  ctx.quadraticCurveTo(48, -2, 46, -8);
  ctx.bezierCurveTo(40, -16, 30, -20, 14, -18);
  ctx.closePath();
  ctx.fill();
  for (const sx of [-1, 1]) {
    const fg = ctx.createRadialGradient(sx * 45 + 1.5, -4.5, 0.5, sx * 45, -3, 5.5);
    fg.addColorStop(0, rgba(BRASS_HI));
    fg.addColorStop(1, rgba(BRASS_DARK));
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.arc(sx * 45, -3, 5, 0, TAU);
    ctx.fill();
  }
  // a bright line along the top edge where the light catches it
  ctx.strokeStyle = 'rgba(255,250,240,0.7)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-12, -17.5);
  ctx.bezierCurveTo(-28, -19, -38, -15, -44, -8);
  ctx.moveTo(12, -17.5);
  ctx.bezierCurveTo(28, -19, 38, -15, 44, -8);
  ctx.stroke();
  // the centre block and its ember stone
  const bg = ctx.createLinearGradient(-15, 0, 15, 0);
  bg.addColorStop(0, rgba(BRASS_DARK));
  bg.addColorStop(0.6, rgba(BRASS_HI));
  bg.addColorStop(1, rgba(BRASS));
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.moveTo(-15, -12);
  ctx.lineTo(0, -27);
  ctx.lineTo(15, -12);
  ctx.lineTo(0, -2);
  ctx.closePath();
  ctx.fill();
  const sg = ctx.createRadialGradient(1.5, -14.5, 0.5, 0, -13, 6);
  sg.addColorStop(0, rgba(hex('#ffe9ae')));
  sg.addColorStop(0.35, rgba(hex('#f4a35e')));
  sg.addColorStop(1, rgba(hex('#8a3a1c')));
  ctx.fillStyle = sg;
  ctx.beginPath();
  ctx.arc(0, -13, 5.2, 0, TAU);
  ctx.fill();
}

// ── the blade: two bevels, a fuller with a thread of light, an engraved ricasso, bright edges ──

const BLADE_BASE = -24;
const BLADE_HALF = 11.5;

function bladeOutline(ctx, len) {
  const base = BLADE_BASE;
  const half = BLADE_HALF;
  const shoulder = -len + 40;
  ctx.beginPath();
  ctx.moveTo(-half, base);
  ctx.lineTo(-half + 0.5, base - 18);
  ctx.lineTo(-half * 0.72, shoulder);
  ctx.lineTo(0, -len);
  ctx.lineTo(half * 0.72, shoulder);
  ctx.lineTo(half - 0.5, base - 18);
  ctx.lineTo(half, base);
  ctx.closePath();
}

function drawBlade(ctx, len) {
  const base = BLADE_BASE;
  const half = BLADE_HALF;
  const shoulder = -len + 40;
  ctx.save();
  bladeOutline(ctx, len);
  ctx.clip();
  // the shadow-side bevel (left) and the lit bevel (right) meet at the spine
  const lg = ctx.createLinearGradient(-half, 0, 0, 0);
  lg.addColorStop(0, rgba(mix(STEEL, IRON_DARK, 0.55)));
  lg.addColorStop(0.7, rgba(mix(STEEL, IRON_DARK, 0.28)));
  lg.addColorStop(1, rgba(mix(STEEL, IRON_DARK, 0.12)));
  ctx.fillStyle = lg;
  ctx.fillRect(-half - 1, -len - 1, half + 1, len + 2);
  const rg = ctx.createLinearGradient(0, 0, half, 0);
  rg.addColorStop(0, rgba(STEEL_HI));
  rg.addColorStop(0.55, rgba(STEEL));
  rg.addColorStop(1, rgba(mix(STEEL, IRON_DARK, 0.2)));
  ctx.fillStyle = rg;
  ctx.fillRect(0, -len - 1, half + 1, len + 2);
  // the sky reflected along the length: warmer near the hilt, cooler toward the point
  const vg = ctx.createLinearGradient(0, base, 0, -len);
  vg.addColorStop(0, 'rgba(255,214,150,0.2)');
  vg.addColorStop(0.5, 'rgba(255,255,255,0)');
  vg.addColorStop(1, 'rgba(200,210,230,0.22)');
  ctx.fillStyle = vg;
  ctx.fillRect(-half - 1, -len - 1, half * 2 + 2, len + 2);
  // the fuller: a dark groove with a lit lip
  const fTop = -len * 0.72;
  ctx.fillStyle = rgba(IRON_DARK, 0.55);
  ctx.beginPath();
  ctx.moveTo(-2.8, base - 22);
  ctx.lineTo(-1.6, fTop);
  ctx.lineTo(1.6, fTop);
  ctx.lineTo(2.8, base - 22);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = rgba(STEEL_HI, 0.85);
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(3.2, base - 22);
  ctx.lineTo(2, fTop);
  ctx.stroke();
  ctx.restore();
  // edges: a hard bright line on the lit edge, a fine one on the shadow edge
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(255,250,240,0.92)';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(half - 0.4, base - 2);
  ctx.lineTo(half - 0.8, base - 18);
  ctx.lineTo(half * 0.72 - 0.3, shoulder);
  ctx.lineTo(0, -len + 0.6);
  ctx.stroke();
  ctx.strokeStyle = rgba(STEEL_HI, 0.45);
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(-half + 0.4, base - 2);
  ctx.lineTo(-half + 0.9, base - 18);
  ctx.lineTo(-half * 0.72 + 0.3, shoulder);
  ctx.lineTo(0, -len + 0.6);
  ctx.stroke();
  // the ricasso: engraved gold inlay, a diamond and chevrons running into the fuller
  ctx.strokeStyle = rgba(BRASS_HI, 0.9);
  ctx.fillStyle = rgba(BRASS_HI, 0.9);
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(0, base - 4);
  ctx.lineTo(4, base - 10);
  ctx.lineTo(0, base - 16);
  ctx.lineTo(-4, base - 10);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, base - 10, 1.4, 0, TAU);
  ctx.fill();
  for (let i = 0; i < 4; i += 1) {
    const y = base - 24 - i * 9;
    ctx.beginPath();
    ctx.moveTo(-6.5, y + 3);
    ctx.lineTo(-3.6, y);
    ctx.moveTo(6.5, y + 3);
    ctx.lineTo(3.6, y);
    ctx.stroke();
  }
}

/** The live light on the blade: the running glint, the fuller's thread, the point mid-swing. */
function bladeLights(ctx, len, t, motion, swinging, pulse, charged) {
  const base = BLADE_BASE;
  const half = BLADE_HALF;
  const fTop = -len * 0.72;
  // a running glint: a diagonal band of light sliding up the steel
  const gk = motion ? ((t * 0.35) % 1.6) / 1.6 : 0.4;
  if (gk < 1) {
    const gy = lerp(base, -len, gk);
    ctx.save();
    bladeOutline(ctx, len);
    ctx.clip();
    const band = ctx.createLinearGradient(-half, gy + 26, half, gy - 26);
    band.addColorStop(0, 'rgba(255,255,255,0)');
    band.addColorStop(0.5, `rgba(255,248,232,${swinging ? 0.7 : 0.4})`);
    band.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = band;
    ctx.fillRect(-half - 1, gy - 40, half * 2 + 2, 80);
    ctx.restore();
  }
  // the thread of light in the fuller: warm gold, reaching further as the Arc charges
  const live = Math.min(1, 0.35 + 0.35 * pulse + 0.6 * charged + (swinging ? 0.3 : 0));
  const top = lerp(base - 22, fTop, 0.55 + 0.45 * charged);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const tg = ctx.createLinearGradient(0, base - 22, 0, top);
  tg.addColorStop(0, rgba(LATTICE_HI, 0.95 * live));
  tg.addColorStop(1, rgba(LATTICE, 0));
  ctx.strokeStyle = tg;
  ctx.lineCap = 'round';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(0, base - 22);
  ctx.lineTo(0, top);
  ctx.stroke();
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.restore();
  // the point catches the light mid-swing
  if (swinging) glow(ctx, 0, -len, 20, hex('#fff4d6'), 0.5);
}
