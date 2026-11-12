// Tuning tables and the shared combat rules of the first-person mode: who has how much health,
// where they can be hit, what a hit does, and what explodes.

import { rayCylinder, raySphere } from './physics.js';

export const TICK = 1 / 60;

export const PLAYER = Object.freeze({
  MAX_HP: 100,
  MAX_WARD: 100,
  RADIUS: 0.4,
  HEIGHT: 1.78,
  CROUCH_HEIGHT: 1.2,
  EYE: 1.62,
  CROUCH_EYE: 1.02,
  WALK: 4.6,
  SPRINT: 7.1,
  CROUCH: 2.3,
  JUMP: 5.7,
  GRAVITY: 17,
  REGEN_DELAY_MS: 4500,
  REGEN_PER_S: 11,
  WARD_DRAIN_PER_S: 11,
  WARD_REGEN_PER_S: 16,
  WARD_REGEN_DELAY_MS: 1600,
  PULSE_COOLDOWN_MS: 11000,
  PULSE_RADIUS: 9.5,
  PULSE_DAMAGE: 45,
  MELEE_COOLDOWN_MS: 650,
  MELEE_RANGE: 2.5,
  MELEE_DAMAGE: 60,
});

/** The Sovereign's two arms. Both are Lattice-coil weapons: warm light, no powder. */
export const WEAPONS = Object.freeze({
  carbine: {
    id: 'carbine',
    name: 'Lattice Carbine',
    note: 'Elvian coil-rifle. Fast, steady, forgiving.',
    auto: true,
    cycleMs: 100,
    damage: 15,
    head: 2.1,
    mag: 30,
    reserve: 150,
    reserveMax: 240,
    trickleMs: 550, // an empty carbine draws a slow charge from the Lattice: never truly out
    reloadMs: 1650,
    spread: 0.0045,
    bloom: 0.0042,
    bloomMax: 0.034,
    adsSpread: 0.3,
    recoil: 0.0085,
    range: 140,
    falloff: [30, 85, 0.45], // full damage to 30 m, down to 45% by 85 m
    pierce: 0,
    zoom: 1.25,
  },
  lance: {
    id: 'lance',
    name: 'Sunlance',
    note: 'A warden\'s long gun. One bright line; it goes through.',
    auto: false,
    cycleMs: 880,
    damage: 90,
    head: 2.2,
    mag: 5,
    reserve: 20,
    reserveMax: 35,
    reloadMs: 2300,
    spread: 0.011,
    bloom: 0,
    bloomMax: 0.011,
    adsSpread: 0.04,
    recoil: 0.042,
    range: 220,
    pierce: 2,
    zoom: 2.6,
  },
});
export const WEAPON_ORDER = Object.freeze(['carbine', 'lance']);

export const ENEMY = Object.freeze({
  rifleman: { hp: 55, speed: 3.5, r: 0.38, h: 1.78, bolt: { speed: 62, dmg: 9 }, score: 1 },
  trooper: { hp: 85, speed: 6.1, r: 0.4, h: 1.82, strike: 24, score: 2 },
  heavy: { hp: 250, speed: 1.9, r: 0.55, h: 2.02, bolt: { speed: 58, dmg: 6 }, score: 4 },
  walker: { hp: 2400, speed: 2.5, r: 2.5, h: 8, leg: 270, shell: { speed: 34, dmg: 27, splash: 3.5 }, score: 20 },
});

export const DIFFICULTY = Object.freeze({
  story: { id: 'story', label: 'Story', dmg: 0.55, acc: 0.72, regenTo: 1 },
  soldier: { id: 'soldier', label: 'Soldier', dmg: 1, acc: 1, regenTo: 1 },
  veteran: { id: 'veteran', label: 'Veteran', dmg: 1.4, acc: 1.22, regenTo: 0.5 },
});

export function emit(state, type, data) {
  const ev = data ?? {};
  ev.type = type;
  ev.t = state.t;
  state.events.push(ev);
  return ev;
}

export const isHuman = (e) => e.type !== 'walker';
export const alive = (e) => e.hp > 0 && !e.dormant;

/** Height of a human enemy as it stands right now. */
export function enemyHeight(e) {
  const h = ENEMY[e.type].h;
  return e.crouch ? h * 0.66 : h;
}

/** Where an enemy's eyes (or lamp) are. */
export function enemyEyeY(e) {
  if (e.type === 'walker') return e.y + walkerHullY(e);
  return e.y + enemyHeight(e) * 0.92;
}

export function walkerHullY(e) {
  return 6.2 - 2.9 * (e.kneel ?? 0);
}

const ZHIT = { t: Infinity, enemy: null, zone: '', mult: 1 };

function testWalker(e, ox, oy, oz, dx, dy, dz, best) {
  const fx = -Math.sin(e.yaw);
  const fz = -Math.cos(e.yaw);
  const rx = Math.cos(e.yaw);
  const rz = -Math.sin(e.yaw);
  const hy = e.y + walkerHullY(e);
  const kneeling = (e.kneel ?? 0) > 0.6;
  let t = raySphere(ox, oy, oz, dx, dy, dz, e.x + fx * 2.3, hy - 0.2, e.z + fz * 2.3, 0.75);
  if (t < best.t) {
    best.t = t;
    best.zone = 'lamp';
    best.mult = kneeling ? 2.6 : 1.5;
    best.enemy = e;
  }
  t = raySphere(ox, oy, oz, dx, dy, dz, e.x, hy, e.z, 2.35);
  if (t < best.t) {
    best.t = t;
    best.zone = kneeling ? 'hatch' : 'hull';
    best.mult = kneeling ? 2.0 : 0.35;
    best.enemy = e;
  }
  for (let side = -1; side <= 1; side += 2) {
    const lx = e.x + rx * side * 1.95;
    const lz = e.z + rz * side * 1.95;
    const kneeY = e.y + 3.1 - 1.6 * (e.kneel ?? 0);
    t = Math.min(raySphere(ox, oy, oz, dx, dy, dz, lx, kneeY, lz, 0.95), rayCylinder(ox, oy, oz, dx, dy, dz, lx + fx * 0.3, lz + fz * 0.3, 0.62, e.y + 0.1, kneeY));
    if (t < best.t) {
      best.t = t;
      best.zone = side < 0 ? 'leg_l' : 'leg_r';
      best.mult = 1;
      best.enemy = e;
    }
  }
}

/** Nearest enemy hit zone along a ray (shared record). `skip` is a set of ids to pass through. */
export function rayEnemies(state, ox, oy, oz, dx, dy, dz, maxT, skip) {
  ZHIT.t = maxT;
  ZHIT.enemy = null;
  ZHIT.zone = '';
  ZHIT.mult = 1;
  const list = state.enemies;
  for (let i = 0; i < list.length; i += 1) {
    const e = list[i];
    if (e.hp <= 0 || e.dormant || (skip && skip.has(e.id))) continue;
    if (e.type === 'walker') {
      testWalker(e, ox, oy, oz, dx, dy, dz, ZHIT);
      continue;
    }
    const def = ENEMY[e.type];
    const h = enemyHeight(e);
    const headY = e.y + h * 0.92;
    let t = raySphere(ox, oy, oz, dx, dy, dz, e.x, headY, e.z, 0.2);
    if (t < ZHIT.t) {
      ZHIT.t = t;
      ZHIT.zone = 'head';
      ZHIT.mult = e.type === 'heavy' ? 1.6 : -1; // -1: use the weapon's own headshot multiplier
      ZHIT.enemy = e;
    }
    if (e.type === 'heavy') {
      const bx = e.x + Math.sin(e.yaw) * 0.5;
      const bz = e.z + Math.cos(e.yaw) * 0.5;
      t = raySphere(ox, oy, oz, dx, dy, dz, bx, e.y + h * 0.66, bz, 0.34);
      if (t < ZHIT.t) {
        ZHIT.t = t;
        ZHIT.zone = 'pack';
        ZHIT.mult = 2.3;
        ZHIT.enemy = e;
      }
    }
    t = rayCylinder(ox, oy, oz, dx, dy, dz, e.x, e.z, def.r, e.y + 0.05, e.y + h * 0.84);
    if (t < ZHIT.t) {
      ZHIT.t = t;
      ZHIT.zone = 'body';
      // a heavy's breastplate turns shots that come from the front
      const frontal = e.type === 'heavy' && dx * -Math.sin(e.yaw) + dz * -Math.cos(e.yaw) < -0.25;
      ZHIT.mult = frontal ? 0.6 : 1;
      ZHIT.enemy = e;
    }
  }
  return ZHIT;
}

/** Wake a group: its members start fighting. Dormant members wait for their own cue. */
export function alertGroup(state, group, quiet = false) {
  let woke = false;
  for (const e of state.enemies) {
    if (e.group !== group || e.dormant || e.alerted || e.hp <= 0) continue;
    e.alerted = true;
    e.stT = 0;
    woke = true;
  }
  if (woke && !quiet) emit(state, 'alert', { group });
  return woke;
}

/** Bring a held-back group onto the field. */
export function deployGroup(state, group) {
  for (const e of state.enemies) {
    if (e.group !== group || !e.dormant) continue;
    e.dormant = false;
    e.alerted = true;
    e.stT = 0;
    emit(state, 'deploy', { id: e.id, enemy: e.type, x: e.x, z: e.z });
  }
}

export function damageEnemy(state, e, raw, zone, hx, hy, hz, source = 'shot') {
  if (e.hp <= 0) return 0;
  let dmg = raw;
  if (e.type === 'walker') {
    if (zone === 'leg_l' || zone === 'leg_r') {
      const i = zone === 'leg_l' ? 0 : 1;
      if (e.mode !== 'kneel' && e.legs[i] > 0) {
        e.legs[i] = Math.max(0, e.legs[i] - raw);
        if (e.legs[i] === 0) emit(state, 'walker_leg', { id: e.id, side: i, x: hx, y: hy, z: hz });
      }
      dmg = raw * 0.22;
    }
  }
  e.hp = Math.max(0, e.hp - dmg);
  e.hitT = state.t;
  if (!e.alerted) alertGroup(state, e.group);
  emit(state, 'enemy_hit', { id: e.id, enemy: e.type, zone, dmg, x: hx, y: hy, z: hz, source });
  if (e.hp === 0) {
    e.state = 'dead';
    e.deadT = state.t;
    e.stT = 0;
    if (e.cover != null) e.cover = null;
    state.stats.kills += 1;
    emit(state, e.type === 'walker' ? 'walker_down' : 'enemy_down', { id: e.id, enemy: e.type, zone, x: e.x, y: e.y, z: e.z, source });
  } else if (e.type === 'trooper' || e.type === 'rifleman') {
    e.flinch = 0.16;
  }
  return dmg;
}

/**
 * Hurt the Sovereign. The Shield Ward soaks what comes from the front while it is up.
 * `sx, sz` is where the harm came from (for the ward and for the on-screen direction marker).
 */
export function hurtPlayer(state, raw, sx, sz, kind = 'bolt') {
  const p = state.player;
  if (state.status !== 'playing' || p.hp <= 0 || state.god) return 0;
  let dmg = raw * state.diff.dmg;
  const dx = sx - p.x;
  const dz = sz - p.z;
  const len = Math.hypot(dx, dz) || 1;
  const fwd = (dx * -Math.sin(p.yaw) + dz * -Math.cos(p.yaw)) / len;
  const right = (dx * Math.cos(p.yaw) + dz * -Math.sin(p.yaw)) / len;
  const angle = Math.atan2(right, fwd);
  if (p.warding && p.ward > 0 && fwd > 0.15) {
    const soak = Math.min(dmg, p.ward / 0.8);
    p.ward = Math.max(0, p.ward - soak * 0.8);
    dmg -= soak;
    emit(state, 'ward_block', { dmg: soak, angle, kind });
    if (p.ward === 0) emit(state, 'ward_break', {});
    if (dmg <= 0.01) return 0;
  }
  p.hp = Math.max(0, p.hp - dmg);
  p.lastHurtT = state.t;
  state.stats.damageTaken += dmg;
  emit(state, 'player_hit', { dmg, angle, kind, hp: p.hp });
  if (p.hp === 0) {
    state.status = 'dead';
    state.stats.deaths += 1;
    state.deadT = state.t;
    emit(state, 'dead', { kind });
  } else if (p.hp < 30 && !state.flags.lowHealthSaid) {
    state.flags.lowHealthSaid = true;
    emit(state, 'radio', { key: 'low_health' });
  }
  return dmg;
}

export function spawnProjectile(state, kind, x, y, z, vx, vy, vz, dmg, opts = {}) {
  const pr = { id: state.nextId, kind, x, y, z, vx, vy, vz, dmg, life: opts.life ?? 3.2, splash: opts.splash ?? 0, gravity: opts.gravity ?? 0, owner: opts.owner ?? null, sx: x, sz: z };
  state.nextId += 1;
  state.projectiles.push(pr);
  return pr;
}

/** A blast: hurts the player and every enemy in reach, with linear falloff. */
export function explode(state, x, y, z, radius, playerDmg, enemyDmg, kind) {
  emit(state, 'explosion', { x, y, z, radius, kind });
  const p = state.player;
  const pd = Math.hypot(p.x - x, p.y + 0.9 - y, p.z - z);
  if (pd < radius && playerDmg > 0) hurtPlayer(state, playerDmg * (1 - 0.85 * (pd / radius)), x, z, kind);
  if (enemyDmg <= 0) return;
  for (const e of state.enemies) {
    if (e.hp <= 0 || e.dormant) continue;
    const reach = radius + (e.type === 'walker' ? 2.2 : 0);
    const d = Math.hypot(e.x - x, e.z - z);
    if (d > reach) continue;
    const f = 1 - 0.6 * Math.min(1, d / reach);
    if (e.type === 'walker') {
      if (e.mode !== 'kneel') {
        e.legs[0] = Math.max(0, e.legs[0] - enemyDmg * 1.6 * f);
        e.legs[1] = Math.max(0, e.legs[1] - enemyDmg * 1.6 * f);
      }
      damageEnemy(state, e, enemyDmg * f * 1.2, 'hull', e.x, e.y + 3, e.z, 'blast');
    } else {
      damageEnemy(state, e, enemyDmg * f, 'body', e.x, e.y + 1, e.z, 'blast');
      if (e.hp > 0) {
        e.state = 'stagger';
        e.stT = 0;
        e.stagger = 1.4;
      }
    }
  }
}
