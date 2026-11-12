// Enemy behaviour for the first-person mode.
//
// Fairness rules, the same spirit as the duel engine: every attack is announced before it lands.
//   • Riflemen fight from cover: they crouch out of sight, stand, AIM (a visible beat), then fire
//     a three-round burst of bolts that travel, so moving sideways or breaking sight beats them.
//   • Shock-troopers run you down with blades: a wind-up you can back away from, ward or shoot.
//   • Heavies spin up for most of a second, then walk a stream of fire toward where you were.
//   • The walker announces its salvo, its stomp (jump it) and its lance sweep (get behind stone).

import { BOUNDS, steerThroughGates } from './level.js';
import { clamp } from './noise.js';
import { floorAt, losClear, moveCircle } from './physics.js';
import { ENEMY, alertGroup, deployGroup, emit, hurtPlayer, spawnProjectile, walkerHullY } from './combat.js';

const TAU = Math.PI * 2;
export const yawTo = (dx, dz) => Math.atan2(-dx, -dz);

function turn(e, target, rate, dt) {
  let d = (target - e.yaw) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  const step = rate * dt;
  e.yaw += d > step ? step : d < -step ? -step : d;
  return Math.abs(d);
}

function setState(e, s) {
  e.state = s;
  e.stT = 0;
}

const STEER = { x: 0, z: 0 };

function walk(state, e, goalX, goalZ, speed, dt) {
  let tx = goalX;
  let tz = goalZ;
  if (e.type !== 'walker') {
    steerThroughGates(state.level, e.x, e.z, goalX, goalZ, STEER);
    tx = STEER.x;
    tz = STEER.z;
  }
  const dx = tx - e.x;
  const dz = tz - e.z;
  const d = Math.hypot(dx, dz);
  if (d < 1e-3) {
    e.speed = 0;
    return 0;
  }
  let ux = dx / d;
  let uz = dz / d;
  if (e.detour > 0) {
    e.detour -= dt;
    const px = -uz * e.detourDir;
    const pz = ux * e.detourDir;
    ux = ux * 0.25 + px;
    uz = uz * 0.25 + pz;
    const l = Math.hypot(ux, uz);
    ux /= l;
    uz /= l;
  }
  const def = ENEMY[e.type];
  const stepLen = Math.min(d, speed * dt);
  const bx = e.x;
  const bz = e.z;
  moveCircle(state, e, ux * stepLen, uz * stepLen, def.r, def.h, e.type === 'walker' ? 1.9 : 0.55);
  e.x = clamp(e.x, BOUNDS.minX + 0.5, BOUNDS.maxX - 0.5);
  e.z = clamp(e.z, BOUNDS.minZ + 0.5, BOUNDS.maxZ - 0.5);
  const moved = Math.hypot(e.x - bx, e.z - bz);
  e.speed = moved / dt;
  if (moved < stepLen * 0.35) {
    e.stuck += dt;
    if (e.stuck > 0.3 && e.detour <= 0) {
      e.detour = 0.85;
      e.detourDir = -e.detourDir || 1;
      e.stuck = 0;
    }
  } else {
    e.stuck = Math.max(0, e.stuck - dt * 2);
  }
  e.y = floorAt(state, e.x, e.z, e.y, e.type === 'walker' ? 1.9 : 0.6);
  turn(e, yawTo(ux, uz), 9, dt);
  return Math.hypot(goalX - e.x, goalZ - e.z);
}

function fireBolt(state, e, rng, kind, tx, ty, tz, errBase) {
  const p = state.player;
  const def = ENEMY[e.type].bolt;
  const fx = -Math.sin(e.yaw);
  const fz = -Math.cos(e.yaw);
  const h = ENEMY[e.type].h;
  const mx = e.x + fx * 0.6;
  const my = e.y + h * 0.74;
  const mz = e.z + fz * 0.6;
  let dx = tx - mx;
  let dy = ty - my;
  let dz = tz - mz;
  const dist = Math.hypot(dx, dy, dz) || 1;
  dx /= dist;
  dy /= dist;
  dz /= dist;
  const pspeed = Math.hypot(p.vx, p.vz);
  const err = (errBase / state.diff.acc) * (1 + (pspeed / 7) * 0.8) * (p.crouch > 0.5 ? 0.9 : 1);
  const a = (rng.next() - 0.5) * 2 * err;
  const b = (rng.next() - 0.5) * 1.2 * err;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const rx = dx * ca - dz * sa;
  const rz = dx * sa + dz * ca;
  const ry = dy + b;
  const l = Math.hypot(rx, ry, rz);
  spawnProjectile(state, kind, mx, my, mz, (rx / l) * def.speed, (ry / l) * def.speed, (rz / l) * def.speed, def.dmg, { owner: e.id, life: 2.6 });
  emit(state, 'enemy_fire', { id: e.id, enemy: e.type, x: mx, y: my, z: mz });
}

/** Aim point on the player: chest, led a little by their motion. */
function aimAt(state, lead) {
  const p = state.player;
  aimAt.x = p.x + p.vx * lead * 0.55;
  aimAt.y = p.y + (p.crouch > 0.5 ? 0.7 : 1.08);
  aimAt.z = p.z + p.vz * lead * 0.55;
  return aimAt;
}

function chooseCover(state, e, rng) {
  const covers = state.level.covers[e.group] ?? [];
  const p = state.player;
  let best = -1;
  let bestScore = Infinity;
  for (let i = 0; i < covers.length; i += 1) {
    if (i === e.cover) continue;
    let taken = false;
    for (const o of state.enemies) if (o !== e && o.hp > 0 && o.group === e.group && o.cover === i) taken = true;
    if (taken) continue;
    const [cx, cz] = covers[i];
    const dp = Math.hypot(cx - p.x, cz - p.z);
    if (dp < 5) continue;
    const sees = losClear(state, cx, floorAt(state, cx, cz, 50, 0, 0) + 1.6, cz, p.x, p.y + 1.05, p.z);
    const score = Math.abs(dp - 17) + Math.hypot(cx - e.x, cz - e.z) * 0.35 + rng.next() * 5 - (sees ? 9 : 0);
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

function nearestCover(state, e) {
  const covers = state.level.covers[e.group] ?? [];
  let best = -1;
  let bd = 4;
  for (let i = 0; i < covers.length; i += 1) {
    const d = Math.hypot(covers[i][0] - e.x, covers[i][1] - e.z);
    let taken = false;
    for (const o of state.enemies) if (o !== e && o.hp > 0 && o.group === e.group && o.cover === i) taken = true;
    if (!taken && d < bd) {
      bd = d;
      best = i;
    }
  }
  return best;
}

function relocate(state, e, rng) {
  const i = chooseCover(state, e, rng);
  if (i < 0) {
    setState(e, 'cover');
    e.coverDur = 0.5 + rng.next() * 0.8;
    return;
  }
  e.cover = i;
  const c = state.level.covers[e.group][i];
  e.tx = c[0];
  e.tz = c[1];
  e.blind = 0;
  setState(e, 'move');
}

function stepRifleman(state, e, dt, rng, dist) {
  const p = state.player;
  const def = ENEMY.rifleman;
  const toP = yawTo(p.x - e.x, p.z - e.z);
  switch (e.state) {
    case 'idle':
      if (e.cover == null && !e.static) e.cover = nearestCover(state, e);
      setState(e, 'cover');
      e.coverDur = 0.15 + rng.next() * 0.9;
      break;
    case 'stagger':
      e.crouch = false;
      e.speed = 0;
      if (e.stT >= e.stagger) {
        setState(e, 'cover');
        e.coverDur = 0.3;
      }
      break;
    case 'cover':
      e.crouch = true;
      e.speed = 0;
      turn(e, toP, 5, dt);
      if (dist < 6.5 && e.los && e.stT > 0.12) {
        e.aimDur = 0.24;
        setState(e, 'aim');
        emit(state, 'enemy_aim', { id: e.id, enemy: e.type });
      } else if (e.stT >= e.coverDur) {
        if (e.los) {
          e.blind = 0;
          e.aimDur = 0.44 / state.diff.acc + rng.next() * 0.26;
          setState(e, 'aim');
          emit(state, 'enemy_aim', { id: e.id, enemy: e.type });
        } else {
          e.blind += 1;
          if (!e.static && e.blind >= 2) relocate(state, e, rng);
          else {
            setState(e, 'cover');
            e.coverDur = 0.6 + rng.next() * 0.9;
          }
        }
      }
      break;
    case 'aim':
      e.crouch = false;
      e.speed = 0;
      turn(e, toP, 8, dt);
      if (!e.los && e.stT > 0.35) {
        setState(e, 'cover');
        e.coverDur = 0.5 + rng.next() * 0.6;
      } else if (e.stT >= e.aimDur) {
        e.burstLeft = 3;
        e.nextShot = 0;
        setState(e, 'burst');
      }
      break;
    case 'burst':
      e.crouch = false;
      turn(e, toP, 6, dt);
      e.nextShot -= dt;
      if (e.nextShot <= 0 && e.burstLeft > 0) {
        const a = aimAt(state, dist / def.bolt.speed);
        fireBolt(state, e, rng, 'bolt', a.x, a.y, a.z, dist < 8 ? 0.05 : 0.03);
        e.burstLeft -= 1;
        e.nextShot = 0.13;
      } else if (e.burstLeft === 0 && e.nextShot <= 0) {
        if (!e.static && rng.next() < 0.36) relocate(state, e, rng);
        else {
          setState(e, 'cover');
          e.coverDur = 0.8 + rng.next() * 1.3;
        }
      }
      break;
    case 'move': {
      e.crouch = false;
      const left = walk(state, e, e.tx, e.tz, def.speed * (e.flinch > 0 ? 0.5 : 1), dt);
      if (left < 0.45 || e.stT > 6) {
        setState(e, 'cover');
        e.coverDur = 0.25 + rng.next() * 0.5;
      }
      break;
    }
    default:
      setState(e, 'cover');
      e.coverDur = 0.5;
  }
}

function stepTrooper(state, e, dt, dist) {
  const p = state.player;
  const def = ENEMY.trooper;
  const toP = yawTo(p.x - e.x, p.z - e.z);
  switch (e.state) {
    case 'stagger':
      e.speed = 0;
      if (e.stT >= e.stagger) setState(e, 'chase');
      break;
    case 'windup':
      e.speed = 0;
      turn(e, toP, 7, dt);
      if (e.stT >= 0.46) {
        const hit = dist < 3.05 && Math.abs(p.y - e.y) < 1.7 && losClear(state, e.x, e.y + 1.3, e.z, p.x, p.y + 1.05, p.z);
        if (hit) hurtPlayer(state, def.strike, e.x, e.z, 'blade');
        emit(state, 'enemy_strike', { id: e.id, hit, x: e.x, y: e.y + 1.2, z: e.z });
        setState(e, 'recover');
      }
      break;
    case 'recover':
      e.speed = 0;
      if (e.stT >= 0.72) setState(e, 'chase');
      break;
    default: {
      if (e.state !== 'chase') setState(e, 'chase');
      if (dist < 2.45 && Math.abs(p.y - e.y) < 1.6) {
        setState(e, 'windup');
        emit(state, 'enemy_windup', { id: e.id, enemy: e.type });
        break;
      }
      let tx = p.x;
      let tz = p.z;
      if (dist > 7) {
        const w = Math.sin(state.t * 0.0042 + e.phase) * 0.55;
        const dx = p.x - e.x;
        const dz = p.z - e.z;
        tx = e.x + dx * Math.cos(w) - dz * Math.sin(w);
        tz = e.z + dx * Math.sin(w) + dz * Math.cos(w);
      }
      walk(state, e, tx, tz, def.speed * (e.flinch > 0 ? 0.45 : 1), dt);
    }
  }
}

function stepHeavy(state, e, dt, rng, dist) {
  const p = state.player;
  const def = ENEMY.heavy;
  const toP = yawTo(p.x - e.x, p.z - e.z);
  switch (e.state) {
    case 'stagger':
      e.speed = 0;
      if (e.stT >= e.stagger * 0.6) setState(e, 'advance');
      break;
    case 'spinup':
      e.speed = 0;
      turn(e, toP, 2.4, dt);
      if (e.stT >= 0.82) {
        e.nextShot = 0;
        setState(e, 'fire');
      }
      break;
    case 'fire': {
      e.speed = 0;
      // the stream chases the player: outrun it or break sight
      const chase = 4.4 * state.diff.acc;
      const ax = p.x - e.aimX;
      const az = p.z - e.aimZ;
      const al = Math.hypot(ax, az);
      if (al > 0.01) {
        const s = Math.min(al, chase * dt);
        e.aimX += (ax / al) * s;
        e.aimZ += (az / al) * s;
      }
      turn(e, yawTo(e.aimX - e.x, e.aimZ - e.z), 3, dt);
      e.nextShot -= dt;
      if (e.nextShot <= 0) {
        fireBolt(state, e, rng, 'slug', e.aimX, p.y + (p.crouch > 0.5 ? 0.7 : 1.05), e.aimZ, 0.022);
        e.nextShot = 0.09;
      }
      if (e.stT >= 2.1) setState(e, 'cool');
      break;
    }
    case 'cool':
      walk(state, e, p.x, p.z, def.speed * 0.6, dt);
      if (e.stT >= 1.5) setState(e, 'advance');
      break;
    default: {
      if (e.state !== 'advance') setState(e, 'advance');
      if (e.los && dist <= 26 && e.stT > 0.5) {
        const side = rng.next() < 0.5 ? -1 : 1;
        e.aimX = p.x + Math.cos(e.yaw) * 2.2 * side;
        e.aimZ = p.z - Math.sin(e.yaw) * 2.2 * side;
        setState(e, 'spinup');
        emit(state, 'heavy_spin', { id: e.id, x: e.x, y: e.y + 1.4, z: e.z });
      } else if (dist > 12 || !e.los) {
        walk(state, e, e.los ? p.x : e.seenX ?? p.x, e.los ? p.z : e.seenZ ?? p.z, def.speed, dt);
      } else {
        e.speed = 0;
        turn(e, toP, 2.4, dt);
      }
    }
  }
}

// The walker's yard: it never leaves the depot.
const YARD = { minX: -25, maxX: 25, minZ: -207, maxZ: -163 };

function walkerShell(state, e, rng, scatter) {
  const p = state.player;
  const def = ENEMY.walker.shell;
  const fx = -Math.sin(e.yaw);
  const fz = -Math.cos(e.yaw);
  const rx = Math.cos(e.yaw);
  const rz = -Math.sin(e.yaw);
  const mx = e.x + fx * 2.6 + rx * 1.9;
  const my = e.y + walkerHullY(e) - 0.6;
  const mz = e.z + fz * 2.6 + rz * 1.9;
  const flat = Math.hypot(p.x - mx, p.z - mz);
  const tof = flat / def.speed;
  const tx = p.x + p.vx * tof * 0.45 + (rng.next() - 0.5) * 2 * scatter;
  const tz = p.z + p.vz * tof * 0.45 + (rng.next() - 0.5) * 2 * scatter;
  const ty = p.y + 0.2;
  const g = 7;
  const dx = tx - mx;
  const dz = tz - mz;
  const d = Math.hypot(dx, dz) || 1;
  const t = d / def.speed;
  const vy = (ty - my) / t + 0.5 * g * t;
  spawnProjectile(state, 'shell', mx, my, mz, (dx / d) * def.speed, vy, (dz / d) * def.speed, def.dmg, { owner: e.id, life: 6, splash: def.splash, gravity: g });
  emit(state, 'walker_fire', { id: e.id, x: mx, y: my, z: mz, tx, ty, tz });
}

function stepWalker(state, e, dt, rng, dist) {
  const p = state.player;
  const def = ENEMY.walker;
  const toP = yawTo(p.x - e.x, p.z - e.z);
  const hullY = e.y + walkerHullY(e);
  e.kneel += ((e.mode === 'kneel' ? 1 : 0) - e.kneel) * Math.min(1, dt * 3.2);

  if (e.mode === 'overwatch') {
    // parked in the depot, sweeping its lamp over the ford
    e.speed = 0;
    const base = yawTo(0, 1);
    e.lampYaw = base + Math.sin(state.t * 0.00042) * 0.62;
    const inFord = p.z < -103 && p.z > -153;
    let lit = false;
    if (inFord) {
      const want = yawTo(p.x - e.x, p.z - e.z);
      let d = (want - e.lampYaw) % TAU;
      if (d > Math.PI) d -= TAU;
      if (d < -Math.PI) d += TAU;
      lit = Math.abs(d) < 0.085 && losClear(state, e.x, hullY, e.z, p.x, p.y + 1.05, p.z);
    }
    e.lit = lit ? Math.min(2, e.lit + dt) : Math.max(0, e.lit - dt * 1.5);
    e.atkCd -= dt;
    if (e.lit > 0.9 && e.atkCd <= 0) {
      if (!state.flags.lampWarned) {
        state.flags.lampWarned = true;
        emit(state, 'walker_spotted', { id: e.id });
      }
      walkerShell(state, e, rng, 3.2);
      e.atkCd = 3.4;
    }
    return;
  }

  if (e.mode === 'kneel') {
    e.speed = 0;
    e.beam = null;
    e.kneelT -= dt;
    if (e.kneelT <= 0) {
      e.mode = 'engage';
      e.legMax *= 0.8;
      e.legs[0] = e.legMax;
      e.legs[1] = e.legMax;
      e.atkCd = 1.6;
      setState(e, 'hunt');
      emit(state, 'walker_stand', { id: e.id });
      emit(state, 'radio', { key: 'walker_stand' });
    }
    return;
  }

  // engage
  if (e.legs[0] <= 0 && e.legs[1] <= 0) {
    e.mode = 'kneel';
    e.kneelT = 6.5;
    e.beam = null;
    setState(e, 'kneel');
    emit(state, 'walker_kneel', { id: e.id, x: e.x, y: e.y, z: e.z });
    if (!state.flags.kneelSaid) {
      state.flags.kneelSaid = true;
      emit(state, 'radio', { key: 'walker_kneel' });
    }
    return;
  }
  if (!state.flags.reinforced && e.hp < def.hp * 0.55) {
    state.flags.reinforced = true;
    deployGroup(state, 'D');
    emit(state, 'radio', { key: 'walker_reinforce' });
    state.flags.wantCheckpoint = true;
  }
  const lame = e.legs[0] <= 0 || e.legs[1] <= 0 ? 0.5 : 1;
  e.lampYaw = e.yaw;

  switch (e.state) {
    case 'salvo_wind':
      e.speed = 0;
      turn(e, toP, 1.4, dt);
      if (e.stT >= 0.85) {
        e.burstLeft = 3;
        e.nextShot = 0;
        setState(e, 'salvo');
      }
      break;
    case 'salvo':
      e.speed = 0;
      turn(e, toP, 0.9, dt);
      e.nextShot -= dt;
      if (e.nextShot <= 0 && e.burstLeft > 0) {
        walkerShell(state, e, rng, 2.4 / state.diff.acc);
        e.burstLeft -= 1;
        e.nextShot = 0.3;
      } else if (e.burstLeft === 0 && e.nextShot <= 0) {
        e.atkCd = 2.4;
        setState(e, 'hunt');
      }
      break;
    case 'stomp_wind':
      e.speed = 0;
      if (e.stT >= 0.95) {
        const d = Math.hypot(p.x - e.x, p.z - e.z);
        const hit = d < 8.5 && p.grounded;
        if (hit) hurtPlayer(state, 38 * (1 - 0.5 * (d / 8.5)), e.x, e.z, 'stomp');
        emit(state, 'walker_stomp', { id: e.id, x: e.x, y: e.y, z: e.z, hit });
        e.atkCd = 2.2;
        setState(e, 'hunt');
      }
      break;
    case 'lance_wind':
      e.speed = 0;
      turn(e, toP, 1.6, dt);
      if (e.stT >= 1.3) {
        const dirn = rng.next() < 0.5 ? -1 : 1;
        e.beam = { from: e.yaw - 0.72 * dirn, to: e.yaw + 0.72 * dirn, yaw: e.yaw - 0.72 * dirn };
        setState(e, 'lance');
        emit(state, 'walker_beam', { id: e.id, on: true });
      }
      break;
    case 'lance': {
      e.speed = 0;
      const k = Math.min(1, e.stT / 1.7);
      e.beam.yaw = e.beam.from + (e.beam.to - e.beam.from) * k;
      e.lampYaw = e.beam.yaw;
      let d = (toP - e.beam.yaw) % TAU;
      if (d > Math.PI) d -= TAU;
      if (d < -Math.PI) d += TAU;
      const flat = Math.hypot(p.x - e.x, p.z - e.z);
      if (flat < 70 && Math.abs(d) < Math.atan2(0.95, Math.max(1, flat)) && losClear(state, e.x, hullY - 0.2, e.z, p.x, p.y + 0.95, p.z)) {
        hurtPlayer(state, 62 * dt, e.x, e.z, 'beam');
      }
      if (k >= 1) {
        e.beam = null;
        e.atkCd = 2.8;
        setState(e, 'hunt');
        emit(state, 'walker_beam', { id: e.id, on: false });
      }
      break;
    }
    default: {
      if (e.state !== 'hunt') setState(e, 'hunt');
      turn(e, toP, 0.95 * lame, dt);
      if (dist > 20) {
        const tx = clamp(p.x, YARD.minX, YARD.maxX);
        const tz = clamp(p.z, YARD.minZ, YARD.maxZ);
        walk(state, e, tx, tz, def.speed * lame, dt);
        e.x = clamp(e.x, YARD.minX, YARD.maxX);
        e.z = clamp(e.z, YARD.minZ, YARD.maxZ);
      } else {
        e.speed = 0;
      }
      e.atkCd -= dt;
      if (e.atkCd <= 0) {
        if (dist < 7.5) {
          setState(e, 'stomp_wind');
          emit(state, 'walker_stomp_wind', { id: e.id, x: e.x, y: e.y, z: e.z });
        } else if (e.hp < def.hp * 0.72 && rng.next() < 0.42) {
          setState(e, 'lance_wind');
          emit(state, 'walker_charge', { id: e.id });
        } else {
          setState(e, 'salvo_wind');
          emit(state, 'walker_aim', { id: e.id });
        }
      }
    }
  }
}

export function stepEnemies(state, dt, rng) {
  const p = state.player;
  const list = state.enemies;
  for (let i = 0; i < list.length; i += 1) {
    const e = list[i];
    if (e.dormant || e.hp <= 0) continue;
    e.stT += dt;
    if (e.flinch > 0) e.flinch -= dt;
    const dist = Math.hypot(p.x - e.x, p.z - e.z);
    if ((state.tick + i * 3) % 8 === 0) {
      const ey = e.type === 'walker' ? e.y + walkerHullY(e) : e.y + ENEMY[e.type].h * 0.9;
      e.los = dist < 90 && losClear(state, e.x, ey, e.z, p.x, p.y + 1.05, p.z);
      if (e.los) {
        e.seenX = p.x;
        e.seenZ = p.z;
      }
    }
    if (e.type === 'walker') {
      if (state.status === 'playing') stepWalker(state, e, dt, rng, dist);
      continue;
    }
    if (!e.alerted) {
      e.notice = e.los && dist < 34 ? e.notice + dt : Math.max(0, e.notice - dt);
      if (e.notice > 0.7) alertGroup(state, e.group);
      continue;
    }
    if (state.status !== 'playing') {
      e.speed = 0;
      continue;
    }
    if (e.type === 'rifleman') stepRifleman(state, e, dt, rng, dist);
    else if (e.type === 'trooper') stepTrooper(state, e, dt, dist);
    else stepHeavy(state, e, dt, rng, dist);
  }
  // keep bodies from stacking
  for (let i = 0; i < list.length; i += 1) {
    const a = list[i];
    if (a.hp <= 0 || a.dormant || a.static || a.type === 'walker' || !a.alerted) continue;
    for (let j = i + 1; j < list.length; j += 1) {
      const b = list[j];
      if (b.hp <= 0 || b.dormant || b.static || b.type === 'walker') continue;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > 0.81 || d2 < 1e-6) continue;
      const d = Math.sqrt(d2);
      const push = (0.9 - d) * 0.5;
      a.x -= (dx / d) * push;
      a.z -= (dz / d) * push;
      b.x += (dx / d) * push;
      b.z += (dz / d) * push;
    }
  }
}
