// Impact effects: sparks, slash marks, rings, flashes, vignettes, shakes, and the swipe trails your
// own finger leaves. Each engine fx event becomes a few short-lived visuals and, for the heaviest
// moments, a brief hitstop (the renderer freezes the engine for a few frames; both sides freeze, so
// timing stays fair).

import { TAU, clamp01, easeOut, glow, hex, lerp, rgba } from './util.js';

const GOLD = hex('#ffd98a');
const WHITE = hex('#f4f6fa');
const EMBER = hex('#ff9a4a');
const BLOOD = hex('#9e2b25');

/** Turn one engine fx event into visuals. Returns { hitstopMs, hit, zoom } hints for the renderer. */
export function spawnFx(list, ev, now, L, rand) {
  const { cx, floorY, s, h } = L;
  const torso = { x: cx, y: floorY - 175 * s };
  const contact = { x: cx + 30 * s, y: h * 0.62 };
  const add = (o) => list.push({ t0: now, ...o });
  const sparks = (x, y, color, n, speed = 1, dur = 520) => {
    const parts = [];
    for (let i = 0; i < n; i += 1) {
      const a = rand() * TAU;
      const v = (90 + rand() * 260) * speed * s;
      parts.push({ vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80 * s, len: 6 + rand() * 12 });
    }
    add({ kind: 'sparks', dur, x, y, color, parts });
  };
  const out = { hitstopMs: 0, hit: null, zoom: 0 };
  switch (ev.name) {
    case 'strike_hit': {
      const dirX = ev.dir === 'left' ? 1 : ev.dir === 'right' ? -1 : 0;
      const x = torso.x + (rand() - 0.5) * 50 * s;
      const y = torso.y + (rand() - 0.5) * 60 * s;
      add({ kind: 'slash', dur: 260, x, y, dir: ev.dir, len: 150 * s });
      sparks(x, y, ev.open ? GOLD : WHITE, ev.open ? 22 : 14, ev.open ? 1.2 : 1);
      add({ kind: 'flash', dur: 90, color: WHITE, a: 0.08 });
      out.hitstopMs = ev.open ? 70 : 45;
      out.hit = { dir: dirX || (rand() < 0.5 ? -1 : 1), strength: ev.open ? 1 : 0.7 };
      break;
    }
    case 'strike_blocked':
      sparks(torso.x + (ev.dir === 'left' ? -1 : 1) * 40 * s, torso.y - 30 * s, WHITE, 8, 0.7, 360);
      out.hit = { dir: ev.dir === 'left' ? 1 : -1, strength: 0.25 };
      break;
    case 'parry':
      add({ kind: 'flash', dur: 140, color: WHITE, a: 0.2 });
      add({ kind: 'ring', dur: 360, x: contact.x, y: contact.y, color: WHITE, r: 90 * s });
      sparks(contact.x, contact.y, WHITE, 18, 1.1);
      out.hitstopMs = 50;
      break;
    case 'perfect_parry':
      add({ kind: 'flash', dur: 220, color: GOLD, a: 0.38 });
      add({ kind: 'ring', dur: 560, x: contact.x, y: contact.y, color: GOLD, r: 170 * s, w: 8 });
      add({ kind: 'ring', dur: 760, x: contact.x, y: contact.y, color: GOLD, r: 280 * s, w: 4 });
      sparks(contact.x, contact.y, GOLD, 34, 1.4, 700);
      out.hitstopMs = 110;
      out.zoom = 1;
      break;
    case 'player_hit':
    case 'hurt':
      add({ kind: 'vignette', dur: 460, color: BLOOD, a: ev.heavy ? 0.7 : 0.5 });
      add({ kind: 'shake', dur: ev.heavy ? 340 : 240, amp: ev.heavy ? 16 : 9 });
      add({ kind: 'gash', dur: 380, heavy: Boolean(ev.heavy), dir: ev.dir });
      out.hitstopMs = ev.heavy ? 60 : 0;
      break;
    case 'guard_broken':
    case 'guard_baited':
      add({ kind: 'vignette', dur: 380, color: hex('#c2413a'), a: 0.4 });
      add({ kind: 'shake', dur: 200, amp: 7 });
      sparks(contact.x, contact.y, EMBER, 10, 0.8);
      break;
    case 'poise_break':
    case 'interrupt':
      add({ kind: 'ring', dur: 760, x: torso.x, y: torso.y, color: GOLD, r: 300 * s, w: 7 });
      add({ kind: 'shake', dur: 240, amp: 7 });
      sparks(torso.x, torso.y, GOLD, 28, 1.2, 700);
      out.hitstopMs = ev.name === 'poise_break' ? 90 : 40;
      break;
    case 'arc_pulse':
      add({ kind: 'beam', dur: 560, x: torso.x, y: torso.y });
      add({ kind: 'flash', dur: 240, color: hex('#fff4d6'), a: 0.4 });
      sparks(torso.x, torso.y, GOLD, 30, 1.3, 760);
      out.hitstopMs = 80;
      out.zoom = 0.6;
      break;
    case 'royal_command':
      add({ kind: 'wave', dur: 1000, color: hex('#e3c463') });
      add({ kind: 'flash', dur: 300, color: GOLD, a: 0.2 });
      break;
    case 'sparky_acid':
      sparks(torso.x, torso.y + 20 * s, hex('#b4e83f'), 26, 1, 760);
      break;
    case 'ward_block':
      add({ kind: 'ring', dur: 300, x: cx, y: h * 1.04, color: GOLD, r: Math.min(L.w * 0.66, h * 0.58), w: 4, fixed: true });
      add({ kind: 'flash', dur: 140, color: GOLD, a: 0.14 });
      break;
    case 'ward_broken':
      add({ kind: 'vignette', dur: 420, color: EMBER, a: 0.4 });
      break;
    case 'dodge':
      add({ kind: 'streak', dur: 260, side: ev.side ?? 'left' });
      break;
    case 'dodge_clean':
      add({ kind: 'streak', dur: 420, side: ev.side ?? 'left', gold: true });
      break;
    case 'feint_read':
      add({ kind: 'ring', dur: 520, x: torso.x, y: torso.y, color: hex('#e9d9ff'), r: 160 * s, w: 4 });
      break;
    case 'combo_up':
      add({ kind: 'flash', dur: 160, color: GOLD, a: 0.1 });
      break;
    case 'victory':
      add({ kind: 'bloom', dur: 1400, color: GOLD });
      break;
    case 'defeat':
      add({ kind: 'vignette', dur: 1600, color: hex('#05070c'), a: 0.75, hold: true });
      break;
    default:
      break;
  }
  return out;
}

/** The camera shake from every live shake effect. */
export function currentShake(list, now, motion, s) {
  let x = 0;
  let y = 0;
  if (!motion) return { x, y };
  list.forEach((f, i) => {
    if (f.kind !== 'shake') return;
    const k = (now - f.t0) / f.dur;
    if (k < 0 || k >= 1) return;
    const amp = f.amp * s * (1 - k) * (1 - k);
    x += Math.sin(now * 0.09 + i) * amp;
    y += Math.cos(now * 0.11 + i) * amp;
  });
  return { x, y };
}

/** Draw the world-space effects (inside the camera) and retire the finished ones. */
export function drawFx(ctx, L, list, now) {
  const { w, h, cx, s } = L;
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const f = list[i];
    const k = (now - f.t0) / f.dur;
    if (k >= 1) {
      list.splice(i, 1);
      continue;
    }
    if (k < 0) continue;
    const a = 1 - k;
    const dt = (now - f.t0) / 1000;
    ctx.save();
    switch (f.kind) {
      case 'sparks':
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        for (const p of f.parts) {
          const x = f.x + p.vx * dt;
          const y = f.y + p.vy * dt + 420 * s * dt * dt;
          const vx = p.vx;
          const vy = p.vy + 840 * s * dt;
          const sp = Math.hypot(vx, vy) || 1;
          ctx.strokeStyle = rgba(f.color, a);
          ctx.lineWidth = Math.max(1, 2.2 * s * a);
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x - (vx / sp) * p.len * s, y - (vy / sp) * p.len * s);
          ctx.stroke();
        }
        break;
      case 'slash': {
        // a bright cut across the foe, along the strike you made
        ctx.globalCompositeOperation = 'lighter';
        const ang = f.dir === 'left' ? -0.35 : f.dir === 'right' ? Math.PI + 0.35 : f.dir === 'up' ? -Math.PI / 2 + 0.2 : Math.PI / 2 - 0.2;
        const grow = easeOut(clamp01(k * 2.5));
        const x0 = f.x - Math.cos(ang) * f.len * 0.5;
        const y0 = f.y - Math.sin(ang) * f.len * 0.5;
        const x1 = x0 + Math.cos(ang) * f.len * grow;
        const y1 = y0 + Math.sin(ang) * f.len * grow;
        ctx.lineCap = 'round';
        ctx.strokeStyle = rgba(hex('#ffe9ae'), 0.35 * a);
        ctx.lineWidth = 16 * s * a;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
        ctx.strokeStyle = rgba(WHITE, 0.95 * a);
        ctx.lineWidth = 4 * s * a;
        ctx.stroke();
        break;
      }
      case 'ring':
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = rgba(f.color, 0.9 * a);
        ctx.lineWidth = (f.w ?? 5) * s * a;
        ctx.beginPath();
        if (f.fixed) ctx.arc(f.x, f.y, f.r, Math.PI * 1.04, Math.PI * 1.96);
        else ctx.arc(f.x, f.y, f.r * easeOut(k), 0, TAU);
        ctx.stroke();
        break;
      case 'beam': {
        ctx.globalCompositeOperation = 'lighter';
        const bx = cx + 76 * s;
        const by = L.bladeY - 120 * s;
        const g = ctx.createLinearGradient(bx, by, f.x, f.y);
        g.addColorStop(0, rgba(hex('#ffe9ae'), 0.2 * a));
        g.addColorStop(1, rgba(hex('#fff4d6'), 0.95 * a));
        ctx.strokeStyle = g;
        ctx.lineCap = 'round';
        ctx.lineWidth = 30 * s * a;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(f.x, f.y);
        ctx.stroke();
        ctx.lineWidth = 8 * s * a;
        ctx.strokeStyle = rgba(WHITE, a);
        ctx.stroke();
        glow(ctx, f.x, f.y, 140 * s * (0.6 + 0.4 * a), GOLD, 0.6 * a);
        break;
      }
      case 'wave':
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = rgba(f.color, 0.8 * a);
        ctx.lineWidth = 12 * s * a;
        ctx.beginPath();
        ctx.arc(cx, h, Math.max(w, h) * easeOut(k), Math.PI, TAU);
        ctx.stroke();
        for (let r = 0; r < 12; r += 1) {
          const ang = Math.PI + (r / 11) * Math.PI;
          ctx.strokeStyle = rgba(f.color, 0.2 * a);
          ctx.lineWidth = 3 * s;
          ctx.beginPath();
          ctx.moveTo(cx, h);
          ctx.lineTo(cx + Math.cos(ang) * Math.max(w, h) * easeOut(k), h + Math.sin(ang) * Math.max(w, h) * easeOut(k));
          ctx.stroke();
        }
        break;
      default:
        break;
    }
    ctx.restore();
  }
}

/** Screen-space effects drawn last (outside the camera): flashes, vignettes, streaks, claws. */
export function drawScreenFx(ctx, L, list, now) {
  const { w, h, cx } = L;
  for (const f of list) {
    const k = (now - f.t0) / f.dur;
    if (k >= 1 || k < 0) continue;
    const a = f.hold ? Math.min(1, k * 3) : 1 - k;
    ctx.save();
    switch (f.kind) {
      case 'flash':
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = rgba(f.color, f.a * a);
        ctx.fillRect(0, 0, w, h);
        break;
      case 'vignette': {
        const g = ctx.createRadialGradient(cx, h / 2, Math.min(w, h) * 0.28, cx, h / 2, Math.max(w, h) * 0.72);
        g.addColorStop(0, rgba(f.color, 0));
        g.addColorStop(1, rgba(f.color, f.a * a));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        break;
      }
      case 'streak': {
        const left = f.side === 'left';
        const g = ctx.createLinearGradient(left ? w : 0, 0, left ? w * 0.55 : w * 0.45, 0);
        g.addColorStop(0, rgba(f.gold ? GOLD : WHITE, (f.gold ? 0.28 : 0.16) * a));
        g.addColorStop(1, rgba(WHITE, 0));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = rgba(f.gold ? GOLD : WHITE, 0.35 * a);
        ctx.lineWidth = 2;
        for (let i = 0; i < 9; i += 1) {
          const y = h * (0.15 + i * 0.08);
          const x0 = left ? w * (0.75 + 0.2 * Math.sin(i * 7)) : w * (0.25 - 0.2 * Math.sin(i * 7));
          ctx.beginPath();
          ctx.moveTo(x0, y);
          ctx.lineTo(x0 + (left ? 1 : -1) * w * 0.2 * a, y);
          ctx.stroke();
        }
        break;
      }
      case 'gash': {
        // the blow that got through: a hot red flare along the edge it came from
        const side = f.dir === 'right' ? 1 : f.dir === 'left' ? -1 : 0;
        const x = side ? (side > 0 ? w : 0) : cx;
        const y = side ? h * 0.45 : 0;
        const r = Math.max(w, h) * (f.heavy ? 0.75 : 0.55);
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, rgba(hex('#ff5a3a'), 0.42 * a));
        g.addColorStop(0.45, rgba(BLOOD, 0.22 * a));
        g.addColorStop(1, rgba(BLOOD, 0));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        break;
      }
      case 'bloom': {
        ctx.globalCompositeOperation = 'lighter';
        glow(ctx, cx, h * 0.42, Math.max(w, h) * lerp(0.2, 0.9, easeOut(k)), f.color, 0.45 * a);
        break;
      }
      default:
        break;
    }
    ctx.restore();
  }
}

/** Your finger's swipe, as a fading ribbon of gold light. */
export function drawSwipes(ctx, L, swipes, now) {
  for (let i = swipes.length - 1; i >= 0; i -= 1) {
    const sw = swipes[i];
    const age = now - sw.t0;
    if (age > 320) {
      swipes.splice(i, 1);
      continue;
    }
    const a = 1 - age / 320;
    const pts = sw.pts;
    if (pts.length < 2) continue;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const [width, alpha, color] of [[22, 0.18, GOLD], [9, 0.5, hex('#ffe9ae')], [3, 0.95, WHITE]]) {
      ctx.strokeStyle = rgba(color, alpha * a);
      ctx.lineWidth = width * L.s * (0.6 + 0.4 * a);
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1]);
      ctx.stroke();
    }
    ctx.restore();
  }
}
