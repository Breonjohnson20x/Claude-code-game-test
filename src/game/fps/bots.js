// Bots that play the Greywater Front through the same inputs a person has. The tests use them
// to prove the mission can be finished, that standing still cannot win it, and that the
// simulation is deterministic. They read only what a player could see.

import { makeRng } from '../core/rng.js';
import { ENEMY, PLAYER, WEAPONS, enemyHeight, walkerHullY } from './combat.js';
import { losClear } from './physics.js';
import { clamp } from './noise.js';
import { steerThroughGates } from './level.js';

const TAU = Math.PI * 2;
const STAGE_GROUPS = { advance: ['A'], picket: ['A'], checkpoint: ['B'], gate: ['B2', 'B'], ford: ['C', 'C2'], depot: ['W', 'D'], surrender: [], done: [] };

const SKILL = {
  // turn: rad/s the aim can move; tol: how close before firing; wobble: aim noise in radians
  oracle: { turn: 9, tol: 0.012, wobble: 0.002, react: 0.1 },
  recruit: { turn: 4.2, tol: 0.03, wobble: 0.016, react: 0.35 },
};

function wrap(a) {
  let d = a % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

function targetPoint(e, out) {
  if (e.type === 'walker') {
    const rx = Math.cos(e.yaw);
    const rz = -Math.sin(e.yaw);
    if (e.mode === 'kneel') {
      out.x = e.x;
      out.y = e.y + walkerHullY(e);
      out.z = e.z;
    } else {
      const side = e.legs[0] > 0 ? -1 : 1;
      out.x = e.x + rx * side * 1.95;
      out.y = e.y + 3.0;
      out.z = e.z + rz * side * 1.95;
    }
    return out;
  }
  out.x = e.x;
  out.y = e.y + enemyHeight(e) * (e.type === 'heavy' ? 0.55 : 0.8);
  out.z = e.z;
  return out;
}

/** kind: 'oracle' (a very good player), 'recruit' (a clumsy one) or 'idle' (does nothing). */
export function createBot(kind = 'oracle', seed = 7) {
  const skill = SKILL[kind] ?? SKILL.oracle;
  const rng = makeRng(seed);
  const bot = { kind, yaw: null, pitch: 0, route: 0, strafe: 1, strafeT: 0, seenT: 0, stuckT: 0, lastX: 0, lastZ: 0, jumpAt: -1, detour: null, skip: new Set(), fetch: null, fetchT: 0, anchorX: 0, anchorZ: 0, anchorT: 0, roam: null, wobX: 0, wobY: 0, wobT: 0, tp: { x: 0, y: 0, z: 0 } };

  bot.step = (state, dt = 1 / 60) => {
    const p = state.player;
    if (bot.yaw == null) bot.yaw = p.yaw;
    const inp = { moveX: 0, moveZ: 0, yaw: bot.yaw, pitch: bot.pitch, fire: false, ads: false, ward: false, sprint: false, crouch: false, jump: false, reload: false, swap: false, pulse: false, melee: false, interact: false };
    if (kind === 'idle' || state.status !== 'playing') return inp;
    const eyeY = p.y + PLAYER.EYE;

    for (const ev of state.events) {
      if (ev.type === 'walker_stomp_wind') bot.jumpAt = state.t + 760;
      if (ev.type === 'respawn') bot.route = Math.max(0, bot.route - 3);
    }

    // pick a target: the nearest living enemy in plain sight
    let target = null;
    let bestD = Infinity;
    for (const e of state.enemies) {
      if (e.hp <= 0 || e.dormant) continue;
      if (e.type === 'walker' && e.mode === 'overwatch') continue;
      const d = Math.hypot(e.x - p.x, e.z - p.z);
      if (d > (e.type === 'walker' ? 60 : 46) || d >= bestD) continue;
      const tp = targetPoint(e, bot.tp);
      if (!losClear(state, p.x, eyeY, p.z, tp.x, tp.y, tp.z)) continue;
      target = e;
      bestD = d;
    }

    const face = (tx, ty, tz, rate) => {
      const dx = tx - p.x;
      const dy = ty - eyeY;
      const dz = tz - p.z;
      const wantYaw = Math.atan2(-dx, -dz);
      const wantPitch = Math.atan2(dy, Math.hypot(dx, dz));
      const dyaw = wrap(wantYaw - bot.yaw);
      const dpitch = wantPitch - bot.pitch;
      const step = rate * dt;
      bot.yaw += clamp(dyaw, -step, step);
      bot.pitch += clamp(dpitch, -step, step);
      return Math.hypot(wrap(wantYaw - bot.yaw), wantPitch - bot.pitch);
    };

    const walkTo = (gx, gz, sprint) => {
      const via = steerThroughGates(state.level, p.x, p.z, gx, gz, bot.tp);
      const tx = via.x;
      const tz = via.z;
      const dx = tx - p.x;
      const dz = tz - p.z;
      const want = Math.atan2(-dx, -dz);
      const rel = wrap(want - bot.yaw);
      inp.moveZ = Math.cos(rel);
      inp.moveX = -Math.sin(rel);
      inp.sprint = sprint && Math.abs(rel) < 0.5;
      return Math.hypot(dx, dz);
    };

    const w = WEAPONS[p.weapon];
    const ammo = p.ammo[p.weapon];
    if (ammo.mag === 0 && ammo.reserve === 0) inp.swap = true;
    else if (!p.reload && ammo.mag === 0) inp.reload = true;

    if (target) {
      bot.seenT += dt;
      bot.wobT -= dt;
      if (bot.wobT <= 0) {
        bot.wobT = 0.18;
        bot.wobX = (rng.next() - 0.5) * 2 * skill.wobble;
        bot.wobY = (rng.next() - 0.5) * 2 * skill.wobble;
      }
      const tp = targetPoint(target, bot.tp);
      const err = face(tp.x, tp.y, tp.z, skill.turn);
      inp.yaw = bot.yaw + bot.wobX;
      inp.pitch = bot.pitch + bot.wobY;
      const size = target.type === 'walker' ? 0.9 : ENEMY[target.type].r;
      inp.fire = bot.seenT > skill.react && err < Math.max(skill.tol, Math.atan2(size * 0.6, bestD));
      if (p.weapon === 'lance') inp.fire = inp.fire && state.tick % 4 === 0; // semi-automatic: tap it
      // footwork: sidestep bolts, back away from blades, keep off the walker
      bot.strafeT -= dt;
      if (bot.strafeT <= 0) {
        bot.strafeT = target.type === 'walker' ? 2.4 + rng.next() * 1.6 : 0.7 + rng.next() * 0.9;
        bot.strafe = -bot.strafe;
      }
      inp.moveX = bot.strafe;
      if (target.type === 'trooper' && bestD < 7) inp.moveZ = -1;
      else if (target.type === 'walker') inp.moveZ = bestD < 15 ? -1 : bestD > 24 ? 1 : 0;
      else if (bestD > 30) inp.moveZ = 0.6;
      if (target.type === 'trooper' && bestD < 2.8 && (target.state === 'windup' || p.reload)) inp.melee = true;
      if (bestD < 6 && p.pulseCd <= 0 && (target.type === 'trooper' || p.hp < 50)) inp.pulse = true;
      if (target.type === 'walker' && target.state === 'lance') {
        inp.ward = true;
        inp.fire = false;
      }
      if (!w.auto) inp.ads = true;
    } else {
      bot.seenT = 0;
      inp.yaw = bot.yaw;
      inp.pitch = bot.pitch;
      // nobody in sight: hunt what is left of this stage's enemies, else follow the road
      let hunt = null;
      let hd = Infinity;
      for (const e of state.enemies) {
        if (e.hp <= 0 || e.dormant || !e.alerted || e.type === 'walker' || e.static) continue;
        if (!STAGE_GROUPS[state.stage]?.includes(e.group)) continue;
        const d = Math.hypot(e.x - p.x, e.z - p.z);
        if (d < hd) {
          hd = d;
          hunt = e;
        }
      }
      const L = state.level;
      let goal = null;
      if (state.prompt) {
        inp.interact = true;
      }
      if (state.objective.id === 'winch') goal = [L.winch.x - 1.3, L.winch.z + 1.2];
      else if (state.stage === 'gate' && !hunt) goal = [L.gates.gateB + 2, -93];
      else if (state.stage === 'surrender') goal = [state.objective.x, state.objective.z];
      else if (state.stage === 'depot' && !hunt) {
        const wk = state.enemies.find((e) => e.type === 'walker');
        goal = wk ? [wk.x + 8, wk.z + 14] : null;
      } else if (hunt) goal = [hunt.x, hunt.z];
      if (!goal) {
        const route = L.route;
        while (bot.route < route.length - 1 && (Math.hypot(route[bot.route][0] - p.x, route[bot.route][1] - p.z) < 1.8 || route[bot.route][1] > p.z + 3)) bot.route += 1;
        goal = route[bot.route];
      }
      if (bot.detour && state.t < bot.detour.until) goal = [bot.detour.x, bot.detour.z];
      const via = steerThroughGates(L, p.x, p.z, goal[0], goal[1], bot.tp);
      face(via.x, p.y + 1.4, via.z, 5);
      walkTo(goal[0], goal[1], true);
      // unstick: hop and sidestep when the body has not moved
      if (Math.hypot(p.x - bot.lastX, p.z - bot.lastZ) < 0.6) bot.stuckT += dt;
      else {
        bot.stuckT = 0;
        bot.lastX = p.x;
        bot.lastZ = p.z;
      }
      if (bot.stuckT > 0.8) {
        inp.jump = p.grounded;
        inp.moveX = bot.strafe;
        if (bot.stuckT > 1.6) {
          // walk around whatever it is: a few metres to one side, then try again
          bot.strafe = -bot.strafe;
          const gx = goal[0] - p.x;
          const gz = goal[1] - p.z;
          const gl = Math.hypot(gx, gz) || 1;
          bot.detour = { x: p.x + (-gz / gl) * bot.strafe * 7 - (gx / gl) * 2, z: p.z + (gx / gl) * bot.strafe * 7 - (gz / gl) * 2, until: state.t + 2200 };
          bot.stuckT = 0;
        }
      }
    }
    // running dry: go and fetch cells like anyone would (still shooting on the way);
    // give up on a crate that cannot be reached in a few seconds
    if (p.ammo.carbine.reserve < 30 && state.stage !== 'surrender' && state.objective.id !== 'winch' && !(target && target.type === 'trooper')) {
      let cell = null;
      let cd = 70;
      for (const k of state.pickups) {
        if (k.taken || k.kind !== 'cells' || bot.skip.has(k.id)) continue;
        const d = Math.hypot(k.x - p.x, k.z - p.z);
        if (d < cd) {
          cd = d;
          cell = k;
        }
      }
      if (cell) {
        if (bot.fetch !== cell.id) {
          bot.fetch = cell.id;
          bot.fetchT = 0;
        }
        bot.fetchT += dt;
        if (bot.fetchT > 7) bot.skip.add(cell.id);
        if (!target) {
          face(cell.x, p.y + 1.2, cell.z, 5);
          inp.yaw = bot.yaw;
        }
        walkTo(cell.x, cell.z, !target);
        if (bot.fetchT > 2 && Math.floor(bot.fetchT * 2) % 3 === 0) inp.moveX = bot.strafe;
      }
    }
    // last resort: if the body has hung around one spot for ten seconds, walk somewhere else
    if (Math.hypot(p.x - bot.anchorX, p.z - bot.anchorZ) > 3 || state.stage === 'gate') {
      bot.anchorX = p.x;
      bot.anchorZ = p.z;
      bot.anchorT = state.t;
    } else if (state.t - bot.anchorT > 10000) {
      const ang = rng.next() * TAU;
      bot.roam = { x: clamp(p.x + Math.cos(ang) * 12, -30, 30), z: p.z + Math.sin(ang) * 12, until: state.t + 3500 };
      bot.anchorT = state.t;
    }
    if (bot.roam && state.t < bot.roam.until) {
      walkTo(bot.roam.x, bot.roam.z, false);
      if (state.tick % 90 < 6) inp.jump = true;
    }
    if (bot.jumpAt > 0 && state.t >= bot.jumpAt) {
      inp.jump = true;
      if (state.t > bot.jumpAt + 120) bot.jumpAt = -1;
    }
    return inp;
  };
  return bot;
}
