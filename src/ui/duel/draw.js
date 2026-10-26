// Canvas renderer for the duel: a torch-lit stone circle at night, the foe as a large readable
// silhouette facing you, the Sovereign's blade at the bottom, and telegraphs you can read at a
// glance (README: red-gold = dodge, steel = parry or dodge, flicker = feint: wait).
// Pure drawing from the engine's duel state plus a small list of visual effects.

const TAU = Math.PI * 2;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => 1 - (1 - t) * (1 - t);

export const TELE_COLORS = {
  steel: { core: '#f3f6fa', glow: 'rgba(214,226,240,', label: 'Parry or dodge' },
  red_gold: { core: '#ffb347', glow: 'rgba(255,120,40,', label: 'Dodge' },
  flicker: { core: '#e9d9ff', glow: 'rgba(230,220,255,', label: 'Feint: wait' },
};

export function layout(w, h) {
  const s = Math.min(w / 420, h / 640) * (w < 600 ? 1 : 0.92);
  return { w, h, cx: w / 2, floorY: h * 0.6, s, bladeY: h * 0.86 };
}

// ── arena ───────────────────────────────────────────────────────────────────────────────

function torch(ctx, x, y, s, t, motion) {
  const f = motion ? 0.85 + 0.15 * Math.sin(t * 9 + x) * Math.sin(t * 4.3 + 1) : 1;
  const g = ctx.createRadialGradient(x, y, 0, x, y, 220 * s * f);
  g.addColorStop(0, 'rgba(255,170,80,0.42)');
  g.addColorStop(1, 'rgba(255,170,80,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, 220 * s * f, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#1b130d';
  ctx.fillRect(x - 4 * s, y + 6 * s, 8 * s, 70 * s);
  ctx.fillStyle = '#4f3d0d';
  ctx.fillRect(x - 9 * s, y + 2 * s, 18 * s, 6 * s);
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = 'rgba(224,120,43,0.9)';
  ctx.beginPath();
  ctx.ellipse(x, y - 8 * s * f, 7 * s, 15 * s * f, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,233,174,0.95)';
  ctx.beginPath();
  ctx.ellipse(x, y - 4 * s * f, 3.5 * s, 8 * s * f, 0, 0, TAU);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
}

function pillar(ctx, x, top, bottom, w) {
  const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  g.addColorStop(0, '#0d121c');
  g.addColorStop(0.6, '#1c2029');
  g.addColorStop(1, '#0b0f17');
  ctx.fillStyle = g;
  ctx.fillRect(x - w / 2, top, w, bottom - top);
  ctx.fillStyle = '#2a2f3a';
  ctx.fillRect(x - w * 0.62, top - 6, w * 1.24, 8);
}

export function drawArena(ctx, L, t, motion) {
  const { w, h, cx, floorY, s } = L;
  const sky = ctx.createLinearGradient(0, 0, 0, floorY);
  sky.addColorStop(0, '#04070d');
  sky.addColorStop(1, '#0f1b2d');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, floorY + 2);
  // back wall of the circle
  ctx.fillStyle = '#0b1220';
  ctx.beginPath();
  ctx.ellipse(cx, floorY - 10 * s, w * 0.75, 140 * s, 0, Math.PI, TAU);
  ctx.fill();
  for (let i = -3; i <= 3; i += 1) {
    if (i === 0) continue;
    const px = cx + i * 120 * s;
    pillar(ctx, px, floorY - 230 * s + Math.abs(i) * 18 * s, floorY - 4 * s, 26 * s);
  }
  // floor: a stone disc in perspective, etched with the circle's geometry
  const floor = ctx.createRadialGradient(cx, floorY + 120 * s, 20 * s, cx, floorY + 120 * s, Math.max(w, h) * 0.8);
  floor.addColorStop(0, '#2a2f3a');
  floor.addColorStop(0.5, '#1c2029');
  floor.addColorStop(1, '#0a0d13');
  ctx.fillStyle = floor;
  ctx.fillRect(0, floorY - 2, w, h - floorY + 2);
  ctx.save();
  ctx.translate(cx, floorY + 150 * s);
  ctx.scale(1, 0.32);
  ctx.strokeStyle = 'rgba(201,162,39,0.22)';
  ctx.lineWidth = 2 * s;
  for (const r of [140, 230, 330, 450]) {
    ctx.beginPath();
    ctx.arc(0, 0, r * s, 0, TAU);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(201,162,39,0.14)';
  for (let i = 0; i < 12; i += 1) {
    const a = (i / 12) * TAU + (motion ? t * 0.02 : 0);
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 140 * s, Math.sin(a) * 140 * s);
    ctx.lineTo(Math.cos(a) * 450 * s, Math.sin(a) * 450 * s);
    ctx.stroke();
  }
  // the broken-circle sigil at the centre
  ctx.strokeStyle = 'rgba(255,233,174,0.25)';
  ctx.lineWidth = 3 * s;
  ctx.beginPath();
  ctx.arc(0, 0, 70 * s, 0.4, TAU - 0.2);
  ctx.stroke();
  ctx.restore();
  torch(ctx, cx - 0.42 * w, floorY - 150 * s, s, t, motion);
  torch(ctx, cx + 0.42 * w, floorY - 150 * s, s, t + 1.3, motion);
}

// ── the foe ──────────────────────────────────────────────────────────────────────────────

/** Where the weapon hand and blade tip are, given the foe's state. Offsets in s-units from the feet. */
function weaponPose(duel) {
  const e = duel.enemy;
  const tg = duel.telegraph;
  const side = (dir) => (dir === 'left' ? -1 : dir === 'right' ? 1 : 0);
  if (e.state === 'windup' && tg) {
    const p = ease(tg.progress);
    const sx = side(tg.dir);
    if (tg.dir === 'overhead') return { hand: [lerp(10, 0, p), lerp(-150, -250, p)], tip: [lerp(40, 10, p), lerp(-230, -350, p)], glow: tg };
    if (tg.dir === 'thrust') return { hand: [lerp(20, 30, p), lerp(-120, -125, p)], tip: [lerp(20, 30, p), lerp(-150, -150, p)], thrust: true, glow: tg };
    return { hand: [sx * lerp(40, 85, p), lerp(-140, -175, p)], tip: [sx * lerp(90, 170, p), lerp(-210, -255, p)], glow: tg };
  }
  if (e.state === 'active') {
    const dir = e.step?.dir;
    const p = ease(clamp01(e.stateMs / Math.max(1, e.stateDurMs)));
    const sx = side(dir);
    if (dir === 'overhead') return { hand: [0, lerp(-240, -80, p)], tip: [0, lerp(-340, -20, p)], swing: true };
    if (dir === 'thrust') return { hand: [0, -110], tip: [0, -120], thrust: true, lunge: p, swing: true };
    return { hand: [sx * lerp(80, -60, p), lerp(-170, -90, p)], tip: [sx * lerp(160, -170, p), lerp(-240, -60, p)], swing: true };
  }
  if (e.state === 'recovery' || e.state === 'open') return { hand: [30, -80], tip: [70, -10], low: true };
  if (e.state === 'staggered') return { hand: [55, -70], tip: [110, 0], low: true };
  const g = e.guardSide === 'left' ? -1 : e.guardSide === 'right' ? 1 : 0.4;
  return { hand: [g * 45, -125], tip: [g * 70, -235], guard: true };
}

function teleAlpha(tg, t) {
  if (!tg) return 0;
  if (tg.isFeint) return 0.35 + 0.65 * Math.abs(Math.sin(t * 22));
  if (tg.isHeavy) return 0.65 + 0.35 * Math.sin(t * 10) * tg.progress;
  return 0.8;
}

function blade(ctx, x0, y0, x1, y1, s, color, glow, glowA) {
  if (glow) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `${glow}${0.35 * glowA})`;
    ctx.lineWidth = 22 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.strokeStyle = `${glow}${0.6 * glowA})`;
    ctx.lineWidth = 10 * s;
    ctx.stroke();
    ctx.restore();
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 5 * s;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}

function humanoid(ctx, L, duel, t, look) {
  const { cx, floorY, s } = L;
  const e = duel.enemy;
  const pose = weaponPose(duel);
  const stag = e.state === 'staggered';
  const lean = stag ? -0.12 : pose.swing ? 0.06 : 0;
  const lunge = pose.lunge ? 1 + pose.lunge * 0.35 : 1;
  const x = cx;
  const y = floorY + 40 * s;
  ctx.save();
  ctx.globalAlpha = look.alpha ?? 1;
  ctx.translate(x, y);
  ctx.scale(lunge, lunge);
  ctx.rotate(lean);
  // aura for the spectral champion
  if (look.aura) {
    const g = ctx.createRadialGradient(0, -170 * s, 10 * s, 0, -170 * s, 200 * s);
    g.addColorStop(0, 'rgba(255,233,174,0.22)');
    g.addColorStop(1, 'rgba(255,233,174,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, -170 * s, 200 * s, 0, TAU);
    ctx.fill();
  }
  // cloak / legs
  ctx.fillStyle = look.dark;
  ctx.beginPath();
  ctx.moveTo(-46 * s, 0);
  ctx.lineTo(-30 * s, -120 * s);
  ctx.lineTo(30 * s, -120 * s);
  ctx.lineTo(46 * s, 0);
  ctx.closePath();
  ctx.fill();
  // torso, lit from the upper right
  const shade = ctx.createLinearGradient(-52 * s, -220 * s, 52 * s, -120 * s);
  shade.addColorStop(0, look.dark);
  shade.addColorStop(0.55, look.body);
  shade.addColorStop(1, look.head);
  ctx.fillStyle = shade;
  ctx.beginPath();
  ctx.moveTo(-44 * s, -120 * s);
  ctx.lineTo(-52 * s, -205 * s);
  ctx.quadraticCurveTo(0, -222 * s, 52 * s, -205 * s);
  ctx.lineTo(44 * s, -120 * s);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = look.trim;
  ctx.lineWidth = 2.5 * s;
  ctx.beginPath();
  ctx.moveTo(-40 * s, -150 * s);
  ctx.lineTo(40 * s, -150 * s);
  ctx.moveTo(0, -205 * s);
  ctx.lineTo(0, -125 * s);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,214,150,0.55)';
  ctx.lineWidth = 2 * s;
  ctx.beginPath();
  ctx.moveTo(52 * s, -205 * s);
  ctx.lineTo(44 * s, -122 * s);
  ctx.stroke();
  // pauldrons
  ctx.fillStyle = look.trim;
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(sx * 54 * s, -200 * s, 20 * s, 13 * s, sx * 0.3, 0, TAU);
    ctx.fill();
  }
  // head
  ctx.fillStyle = look.head;
  ctx.beginPath();
  ctx.ellipse(0, -245 * s, 22 * s, 27 * s, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = look.visor;
  ctx.fillRect(-14 * s, -250 * s, 28 * s, 4 * s);
  if (look.crown) {
    ctx.fillStyle = '#c9a227';
    ctx.beginPath();
    ctx.moveTo(-20 * s, -266 * s);
    for (let i = 0; i <= 4; i += 1) ctx.lineTo(-20 * s + i * 10 * s, i % 2 ? -276 * s : -292 * s);
    ctx.lineTo(20 * s, -266 * s);
    ctx.closePath();
    ctx.fill();
  }
  // weapon arm + blade
  const [hx, hy] = pose.hand.map((v) => v * s);
  const [tx, ty] = pose.tip.map((v) => v * s);
  ctx.strokeStyle = look.body;
  ctx.lineWidth = 15 * s;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo((hx >= 0 ? 48 : -48) * s, -195 * s);
  ctx.lineTo(hx, hy);
  ctx.stroke();
  const tc = pose.glow ? TELE_COLORS[pose.glow.telegraphColor] : null;
  const ga = pose.glow ? teleAlpha(pose.glow, t) : 0;
  if (pose.thrust) {
    // a blade pointed straight at you: a bright foreshortened point
    ctx.fillStyle = tc ? tc.core : look.steel;
    ctx.beginPath();
    ctx.arc(tx, ty, (tc ? 10 + 10 * (pose.glow?.progress ?? 0) : 8) * s, 0, TAU);
    ctx.fill();
    if (tc) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `${tc.glow}${0.35 * ga})`;
      ctx.beginPath();
      ctx.arc(tx, ty, 38 * s, 0, TAU);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
  } else {
    blade(ctx, hx, hy, tx, ty, s, look.steel, tc?.glow, ga);
  }
  if (stag) {
    ctx.fillStyle = 'rgba(255,233,174,0.9)';
    for (let i = 0; i < 5; i += 1) {
      const a = t * 3 + (i / 5) * TAU;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * 34 * s, -285 * s + Math.sin(a) * 8 * s, 3.2 * s, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
  // guard marker: the side it is covering while idle
  if (pose.guard && duel.enemy.guardSide) {
    const sx = duel.enemy.guardSide === 'left' ? -1 : 1;
    ctx.fillStyle = 'rgba(154,160,168,0.55)';
    ctx.beginPath();
    ctx.arc(cx + sx * 95 * s, floorY - 150 * s, 16 * s, 0, TAU);
    ctx.fill();
  }
}

function warg(ctx, L, duel, t) {
  const { cx, floorY, s } = L;
  const e = duel.enemy;
  const tg = e.state === 'windup' ? duel.telegraph : null;
  const active = e.state === 'active';
  const dir = tg?.dir ?? e.step?.dir;
  const p = tg ? ease(tg.progress) : active ? 1 : 0;
  const rear = dir === 'overhead' ? p : 0;
  const lunge = dir === 'thrust' && (tg || active) ? p : 0;
  const stag = e.state === 'staggered';
  const tc = tg ? TELE_COLORS[tg.telegraphColor] : null;
  const ga = teleAlpha(tg, t);
  const breathe = Math.sin(t * 2) * 2 * s;
  ctx.save();
  ctx.translate(cx, floorY + 50 * s);
  const sc = 1.1 + lunge * 0.4 + (active && dir === 'thrust' ? 0.25 : 0);
  ctx.scale(sc, sc);
  ctx.rotate(stag ? 0.1 : 0);
  // body (seen head-on): shoulders mass behind the head
  ctx.fillStyle = '#3a4656';
  ctx.beginPath();
  ctx.ellipse(0, -110 * s - rear * 60 * s + breathe, 120 * s, 80 * s, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#56657a';
  ctx.beginPath();
  ctx.ellipse(0, -135 * s - rear * 70 * s + breathe, 92 * s, 55 * s, 0, 0, TAU);
  ctx.fill();
  // ruff of frost-white fur
  ctx.fillStyle = '#b8c6d1';
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.ellipse(0, -120 * s - rear * 70 * s, 70 * s, 34 * s, 0, 0, Math.PI);
  ctx.fill();
  ctx.globalAlpha = 1;
  // forelegs and paws; the striking paw rises on its side
  for (const sx of [-1, 1]) {
    const lift = (dir === (sx < 0 ? 'left' : 'right') ? p : 0) + rear;
    const px = sx * (60 + lift * 50) * s;
    const py = -lift * 140 * s;
    ctx.strokeStyle = '#1d2632';
    ctx.lineWidth = 30 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(sx * 55 * s, -80 * s - rear * 60 * s);
    ctx.lineTo(px, py);
    ctx.stroke();
    ctx.fillStyle = '#121820';
    ctx.beginPath();
    ctx.ellipse(px, py, 22 * s, 13 * s, 0, 0, TAU);
    ctx.fill();
    if (tc && lift > 0.05) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `${tc.glow}${0.55 * ga})`;
      ctx.beginPath();
      ctx.arc(px, py - 6 * s, 34 * s, 0, TAU);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = tc.core;
      ctx.lineWidth = 3 * s;
      for (let k = -1; k <= 1; k += 1) {
        ctx.beginPath();
        ctx.moveTo(px + k * 8 * s, py - 10 * s);
        ctx.lineTo(px + k * 10 * s, py - 24 * s);
        ctx.stroke();
      }
    }
  }
  // head: lowered for the lunge
  const hy = -150 * s - rear * 90 * s + lunge * 40 * s;
  ctx.fillStyle = '#6b7a8e';
  ctx.beginPath();
  ctx.moveTo(-38 * s, hy - 20 * s);
  ctx.lineTo(-58 * s, hy - 62 * s); // ear
  ctx.lineTo(-20 * s, hy - 36 * s);
  ctx.lineTo(20 * s, hy - 36 * s);
  ctx.lineTo(58 * s, hy - 62 * s);
  ctx.lineTo(38 * s, hy - 20 * s);
  ctx.lineTo(22 * s, hy + 40 * s);
  ctx.lineTo(-22 * s, hy + 40 * s);
  ctx.closePath();
  ctx.fill();
  // scar
  ctx.strokeStyle = 'rgba(184,198,209,0.6)';
  ctx.lineWidth = 2 * s;
  ctx.beginPath();
  ctx.moveTo(-26 * s, hy - 22 * s);
  ctx.lineTo(-8 * s, hy + 8 * s);
  ctx.stroke();
  // eyes: pale frost, flaring with the telegraph
  const eyeGlow = tc && (dir === 'thrust' || dir === 'overhead') ? tc.core : '#eef2f5';
  ctx.fillStyle = eyeGlow;
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(sx * 14 * s, hy - 8 * s, 6 * s, 3 * s, sx * -0.3, 0, TAU);
    ctx.fill();
  }
  // jaws, glowing on the lunge
  ctx.fillStyle = '#0b0f15';
  ctx.beginPath();
  ctx.ellipse(0, hy + 32 * s, 16 * s, 8 * s + lunge * 8 * s, 0, 0, TAU);
  ctx.fill();
  if (tc && (dir === 'thrust' || dir === 'overhead')) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `${tc.glow}${0.5 * ga})`;
    ctx.beginPath();
    ctx.arc(0, hy + 20 * s, 60 * s, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
}

function backlight(ctx, L, warm) {
  const { cx, floorY, s } = L;
  const g = ctx.createRadialGradient(cx, floorY - 150 * s, 20 * s, cx, floorY - 150 * s, 300 * s);
  g.addColorStop(0, warm ? 'rgba(255,190,120,0.32)' : 'rgba(200,214,230,0.26)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, floorY - 150 * s, 300 * s, 0, TAU);
  ctx.fill();
}

export function drawEnemy(ctx, L, duel, t) {
  const id = duel.archetypeId;
  // Light behind the foe so the silhouette always reads against the night.
  backlight(ctx, L, id !== 'warg_alpha');
  if (id === 'warg_alpha') return warg(ctx, L, duel, t);
  if (id === 'fallen_champion') {
    return humanoid(ctx, L, duel, t, {
      alpha: 0.82,
      aura: true,
      crown: true,
      dark: 'rgba(79,61,13,0.85)',
      body: 'rgba(168,132,27,0.85)',
      trim: '#e3c463',
      head: 'rgba(240,220,149,0.9)',
      visor: 'rgba(255,244,214,0.95)',
      steel: '#fff4d6',
    });
  }
  return humanoid(ctx, L, duel, t, {
    dark: '#2a2f3a',
    body: '#4a4f5a',
    trim: '#d6b47a',
    head: '#8f929a',
    visor: 'rgba(255,217,122,0.85)',
    steel: '#c3c7cc',
  });
}

// ── telegraph overlay ────────────────────────────────────────────────────────────────────

export function drawTelegraph(ctx, L, duel, t) {
  const tg = duel.telegraph;
  if (!tg) return;
  const { w, h, cx, s } = L;
  const c = TELE_COLORS[tg.telegraphColor];
  const a = teleAlpha(tg, t);
  const p = tg.progress;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  const width = (6 + 10 * p + (tg.isHeavy ? 8 : 0)) * s;
  if (tg.isFeint) ctx.setLineDash([18 * s, 14 * s]);
  if (tg.dir === 'left' || tg.dir === 'right') {
    const sx = tg.dir === 'left' ? -1 : 1;
    const r = Math.min(h * 0.2, w * 0.26);
    const x = cx + sx * Math.min(w * 0.36, w / 2 - r - 14 * s);
    ctx.strokeStyle = `${c.glow}${0.35 * a})`;
    ctx.lineWidth = width * 2.4;
    ctx.beginPath();
    ctx.arc(x, h * 0.42, r, sx < 0 ? Math.PI * 0.62 : -Math.PI * 0.38, sx < 0 ? Math.PI * 1.38 : Math.PI * 0.38);
    ctx.stroke();
    ctx.strokeStyle = `${c.glow}${0.9 * a})`;
    ctx.lineWidth = width;
    ctx.stroke();
    // chevron: the way the blow travels
    ctx.setLineDash([]);
    ctx.lineWidth = 7 * s;
    ctx.strokeStyle = c.core;
    ctx.globalAlpha = a;
    const chx = x - sx * 26 * s;
    ctx.beginPath();
    ctx.moveTo(chx - sx * 18 * s, h * 0.42 - 24 * s);
    ctx.lineTo(chx + sx * 6 * s, h * 0.42);
    ctx.lineTo(chx - sx * 18 * s, h * 0.42 + 24 * s);
    ctx.stroke();
  } else if (tg.dir === 'overhead') {
    ctx.strokeStyle = `${c.glow}${0.35 * a})`;
    ctx.lineWidth = width * 2.4;
    ctx.beginPath();
    ctx.arc(cx, h * 0.3, w * 0.32, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
    ctx.strokeStyle = `${c.glow}${0.9 * a})`;
    ctx.lineWidth = width;
    ctx.stroke();
  } else {
    // thrust: rings closing in on you
    const r = lerp(Math.min(w, h) * 0.45, 40 * s, p);
    ctx.strokeStyle = `${c.glow}${0.9 * a})`;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.arc(cx, h * 0.48, r, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = `${c.glow}${0.3 * a})`;
    ctx.lineWidth = width * 2.4;
    ctx.stroke();
  }
  ctx.restore();
  // heavy: the whole frame warms (a rising pulse you feel before you read it)
  if (tg.isHeavy) {
    const g = ctx.createRadialGradient(cx, h * 0.5, Math.min(w, h) * 0.3, cx, h * 0.5, Math.max(w, h) * 0.75);
    g.addColorStop(0, 'rgba(255,120,40,0)');
    g.addColorStop(1, `rgba(255,120,40,${0.22 * p * a})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
}

// ── the Sovereign's blade, ward and dodge ───────────────────────────────────────────────

export function drawPlayer(ctx, L, duel, t, guarding) {
  const { w, h, cx, s, bladeY } = L;
  const p = duel.player;
  ctx.save();
  // Shield Ward: a dome of lattice light
  if (p.wardHeld && p.wardBrokenMs <= 0) {
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(cx, h * 1.05, 40 * s, cx, h * 1.05, w * 0.7);
    g.addColorStop(0, 'rgba(255,233,174,0)');
    g.addColorStop(0.85, 'rgba(255,217,122,0.16)');
    g.addColorStop(1, 'rgba(255,217,122,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,217,122,0.55)';
    ctx.lineWidth = 3 * s;
    ctx.beginPath();
    ctx.arc(cx, h * 1.05, Math.min(w * 0.62, h * 0.55), Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  }
  // the blade
  let angle = -0.35;
  let ox = 0;
  let oy = 0;
  if (guarding) {
    angle = -Math.PI / 2 + 0.08;
    oy = -60 * s;
  }
  if (p.swingMs > 0 && p.swingDurMs > 0) {
    const k = 1 - p.swingMs / p.swingDurMs;
    const d = p.swingDir;
    if (d === 'left') angle = lerp(0.6, -1.6, k);
    else if (d === 'right') angle = lerp(-1.3, 0.9, k);
    else if (d === 'down') angle = lerp(-0.2, 0.5, k);
    else angle = lerp(-0.1, -1.2, k);
    oy = -40 * s * Math.sin(k * Math.PI);
  }
  if (p.dodge.active) ox = (p.dodge.side === 'left' ? -1 : 1) * 40 * s;
  const bx = cx + 70 * s + ox;
  const by = bladeY + oy;
  const len = Math.min(h * 0.32, 230 * s);
  ctx.translate(bx, by);
  ctx.rotate(angle);
  // grip and guard
  ctx.fillStyle = '#3b2f22';
  ctx.fillRect(-6 * s, 0, 12 * s, 46 * s);
  ctx.fillStyle = '#c9a227';
  ctx.fillRect(-34 * s, -6 * s, 68 * s, 10 * s);
  ctx.beginPath();
  ctx.arc(0, 52 * s, 8 * s, 0, TAU);
  ctx.fill();
  // steel with a gold fuller; it glows while guarding
  if (guarding) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(255,233,174,0.35)';
    ctx.lineWidth = 26 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -6 * s);
    ctx.lineTo(0, -len);
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  }
  const g = ctx.createLinearGradient(-10 * s, 0, 10 * s, 0);
  g.addColorStop(0, '#9aa0a8');
  g.addColorStop(0.5, '#eef2f5');
  g.addColorStop(1, '#5d636b');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-11 * s, -6 * s);
  ctx.lineTo(-8 * s, -len + 24 * s);
  ctx.lineTo(0, -len);
  ctx.lineTo(8 * s, -len + 24 * s);
  ctx.lineTo(11 * s, -6 * s);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(201,162,39,0.8)';
  ctx.lineWidth = 2 * s;
  ctx.beginPath();
  ctx.moveTo(0, -12 * s);
  ctx.lineTo(0, -len + 40 * s);
  ctx.stroke();
  ctx.restore();
}

// ── effects ──────────────────────────────────────────────────────────────────────────────

/** Turn an engine fx event into a short-lived visual. */
export function spawnFx(list, ev, now, L) {
  const { cx, floorY, s, h } = L;
  const at = { x: cx, y: floorY - 150 * s };
  const add = (o) => list.push({ t0: now, ...o });
  switch (ev.name) {
    case 'hit':
    case 'strike':
      add({ kind: 'sparks', dur: 380, x: at.x + (Math.random() - 0.5) * 60 * s, y: at.y, color: '255,233,174', n: 10 });
      break;
    case 'parry':
      add({ kind: 'flash', dur: 160, color: '230,238,246', a: 0.25 });
      add({ kind: 'sparks', dur: 420, x: cx + 40 * s, y: h * 0.7, color: '230,238,246', n: 14 });
      break;
    case 'perfect_parry':
      add({ kind: 'flash', dur: 240, color: '255,233,174', a: 0.42 });
      add({ kind: 'ring', dur: 520, x: cx + 40 * s, y: h * 0.7, color: '255,217,122' });
      add({ kind: 'sparks', dur: 620, x: cx + 40 * s, y: h * 0.7, color: '255,217,122', n: 26 });
      break;
    case 'player_hit':
    case 'hurt':
      add({ kind: 'vignette', dur: 420, color: '158,43,37', a: 0.55 });
      add({ kind: 'shake', dur: 260, amp: ev.heavy ? 14 : 8 });
      break;
    case 'guard_broken':
    case 'guard_baited':
      add({ kind: 'vignette', dur: 360, color: '194,65,58', a: 0.35 });
      break;
    case 'poise_break':
      add({ kind: 'ring', dur: 700, x: at.x, y: at.y, color: '255,233,174', big: true });
      add({ kind: 'shake', dur: 220, amp: 6 });
      break;
    case 'arc_pulse':
      add({ kind: 'beam', dur: 520, x: at.x, y: at.y });
      add({ kind: 'flash', dur: 220, color: '255,244,214', a: 0.35 });
      break;
    case 'royal_command':
      add({ kind: 'wave', dur: 900, color: '227,196,99' });
      break;
    case 'sparky_acid':
      add({ kind: 'sparks', dur: 700, x: at.x, y: at.y + 20 * s, color: '180,232,63', n: 22 });
      break;
    case 'ward_block':
      add({ kind: 'flash', dur: 160, color: '255,217,122', a: 0.2 });
      break;
    case 'ward_broken':
      add({ kind: 'vignette', dur: 400, color: '224,120,43', a: 0.35 });
      break;
    case 'dodge_clean':
      add({ kind: 'streak', dur: 300, side: ev.side ?? 'left' });
      break;
    default:
      break;
  }
}

export function drawFx(ctx, L, list, now, motion) {
  const { w, h, cx, s } = L;
  let shake = { x: 0, y: 0 };
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const f = list[i];
    const k = (now - f.t0) / f.dur;
    if (k >= 1) {
      list.splice(i, 1);
      continue;
    }
    const a = 1 - k;
    ctx.save();
    switch (f.kind) {
      case 'flash':
        ctx.fillStyle = `rgba(${f.color},${f.a * a})`;
        ctx.fillRect(0, 0, w, h);
        break;
      case 'vignette': {
        const g = ctx.createRadialGradient(cx, h / 2, Math.min(w, h) * 0.25, cx, h / 2, Math.max(w, h) * 0.7);
        g.addColorStop(0, `rgba(${f.color},0)`);
        g.addColorStop(1, `rgba(${f.color},${f.a * a})`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        break;
      }
      case 'sparks':
        ctx.globalCompositeOperation = 'lighter';
        for (let j = 0; j < f.n; j += 1) {
          const ang = (j / f.n) * TAU + j;
          const r = (20 + 140 * ease(k)) * s * (0.5 + ((j * 37) % 10) / 10);
          ctx.fillStyle = `rgba(${f.color},${a})`;
          ctx.beginPath();
          ctx.arc(f.x + Math.cos(ang) * r, f.y + Math.sin(ang) * r + 40 * s * k * k, 2.6 * s * a + 0.6, 0, TAU);
          ctx.fill();
        }
        break;
      case 'ring':
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(${f.color},${a})`;
        ctx.lineWidth = 6 * s * a;
        ctx.beginPath();
        ctx.arc(f.x, f.y, (f.big ? 260 : 140) * s * ease(k), 0, TAU);
        ctx.stroke();
        break;
      case 'beam': {
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createLinearGradient(cx, h, f.x, f.y);
        g.addColorStop(0, `rgba(255,233,174,${0.1 * a})`);
        g.addColorStop(1, `rgba(255,244,214,${0.9 * a})`);
        ctx.strokeStyle = g;
        ctx.lineWidth = 26 * s * a;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx + 70 * s, h * 0.86);
        ctx.lineTo(f.x, f.y);
        ctx.stroke();
        break;
      }
      case 'wave': {
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(${f.color},${0.8 * a})`;
        ctx.lineWidth = 10 * s * a;
        ctx.beginPath();
        ctx.arc(cx, h, Math.max(w, h) * ease(k), Math.PI, TAU);
        ctx.stroke();
        break;
      }
      case 'streak':
        ctx.fillStyle = `rgba(230,238,246,${0.18 * a})`;
        ctx.fillRect(f.side === 'left' ? 0 : w * 0.7, 0, w * 0.3, h);
        break;
      case 'shake':
        if (motion) {
          const amp = f.amp * s * a;
          shake = { x: Math.sin(now * 0.09) * amp, y: Math.cos(now * 0.11) * amp };
        }
        break;
      default:
        break;
    }
    ctx.restore();
  }
  return shake;
}
