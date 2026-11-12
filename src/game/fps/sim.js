// The Greywater Front — first-person simulation.
//
// Deterministic and DOM-free like the rest of src/game: fixed 60 Hz steps from an accumulator,
// every random draw from the seeded RNG in core/rng.js, no Math.random or Date.now. Unlike the
// duel engine it MUTATES its state in place (dozens of bodies and bolts at 60 Hz); callers keep
// one state object and read `state.events` after each `stepFps` call (only the events of that
// call). Same seed + same input script ⇒ the same mission, shot for shot.
//
// Facing: yaw 0 looks toward −z; forward = (−sin yaw, −cos yaw); pitch > 0 looks up.

import { makeRng } from '../core/rng.js';
import { BOUNDS, WATER_Y, buildLevel, groundY, surfaceAt } from './level.js';
import { clamp, lerp, smooth } from './noise.js';
import { floorAt, losClear, moveCircle, rayGround, raySolids } from './physics.js';
import { DIFFICULTY, ENEMY, PLAYER, TICK, WEAPONS, WEAPON_ORDER, alertGroup, damageEnemy, deployGroup, emit, explode, hurtPlayer, rayEnemies } from './combat.js';
import { stepEnemies } from './ai.js';

export const STEP_MS = 1000 / 60;
const MAX_DT_MS = 250;

export const STAGES = Object.freeze(['advance', 'picket', 'checkpoint', 'gate', 'ford', 'depot', 'surrender', 'done']);

const OBJECTIVES = Object.freeze({
  advance: 'Follow the frontier road south',
  picket: 'Break the Syndicate picket',
  checkpoint: 'Take back the Greywater checkpoint',
  winch: 'Raise the inner gate at the winch',
  gate: 'Hold the yard while the gate rises',
  ford: 'Cross the Greywater',
  depot: 'Bring down the walker',
  surrender: 'Go to the pilot',
  done: 'The Greywater Front is yours',
});

function makeEnemy(def) {
  const stats = ENEMY[def.type];
  const y = def.elev != null ? groundY(def.x, def.z) + def.elev : groundY(def.x, def.z);
  const e = {
    id: def.id,
    type: def.type,
    group: def.group,
    x: def.x,
    y,
    z: def.z,
    yaw: Math.PI, // facing up the road, toward where the Sovereign comes from
    hp: stats.hp,
    maxHp: stats.hp,
    state: 'idle',
    stT: 0,
    alerted: false,
    dormant: !!def.dormant,
    static: !!def.static,
    cover: null,
    crouch: false,
    speed: 0,
    los: false,
    notice: 0,
    blind: 0,
    flinch: 0,
    stagger: 0,
    stuck: 0,
    detour: 0,
    detourDir: 1,
    phase: (def.x * 12.9898 + def.z * 78.233) % 6.283,
    burstLeft: 0,
    nextShot: 0,
    hitT: -1e9,
    deadT: 0,
  };
  if (def.type === 'walker') {
    e.mode = 'overwatch';
    e.legMax = stats.leg;
    e.legs = [stats.leg, stats.leg];
    e.kneel = 0;
    e.kneelT = 0;
    e.atkCd = 2;
    e.lampYaw = Math.PI;
    e.lit = 0;
    e.beam = null;
  }
  return e;
}

/** Start the mission. `difficulty`: 'story' | 'soldier' | 'veteran'. */
export function createFps(config = {}) {
  const level = buildLevel();
  const diff = DIFFICULTY[config.difficulty] ?? DIFFICULTY.soldier;
  const start = level.start;
  const state = {
    level,
    diff,
    t: 0,
    tick: 0,
    acc: 0,
    rngSeed: (config.seed ?? 412) >>> 0,
    status: 'playing', // 'playing' | 'dead' | 'won'
    stage: 'advance',
    outcome: null,
    god: !!config.god,
    nextId: 1,
    player: {
      x: start.x,
      y: groundY(start.x, start.z),
      z: start.z,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: start.yaw,
      pitch: 0,
      hp: PLAYER.MAX_HP,
      ward: PLAYER.MAX_WARD,
      warding: false,
      wardOffT: -1e9,
      crouch: 0,
      grounded: true,
      sprinting: false,
      ads: 0,
      weapon: 'carbine',
      ammo: { carbine: { mag: WEAPONS.carbine.mag, reserve: WEAPONS.carbine.reserve }, lance: { mag: WEAPONS.lance.mag, reserve: WEAPONS.lance.reserve } },
      cooldown: 0,
      reload: null,
      swap: null,
      bloom: 0,
      pulseCd: 0,
      meleeCd: 0,
      lastHurtT: -1e9,
      lastShotT: -1e9,
      stepDist: 0,
      fireHeld: false,
    },
    enemies: level.enemies.map((d) => makeEnemy(d)),
    projectiles: [],
    pickups: level.pickups.map((p) => ({ ...p, taken: false })),
    removed: {},
    gates: { inner_gate: 0 },
    gateRising: false,
    flags: {},
    objective: { id: 'advance', text: OBJECTIVES.advance, x: level.gates.gateA, z: -40 },
    prompt: null,
    stats: { shots: 0, hits: 0, headshots: 0, kills: 0, damageTaken: 0, deaths: 0, dispatches: [], timeMs: 0 },
    checkpoint: null,
    events: [],
  };
  if (config.stage && STAGES.includes(config.stage)) warpToStage(state, config.stage);
  saveCheckpoint(state, true);
  if (!config.stage) emit(state, 'radio', { key: 'start' });
  emit(state, 'objective', { text: state.objective.text });
  return state;
}

// ───────────────────────────────────────────────────────────── checkpoints

function snapshot(state) {
  return JSON.stringify({
    player: state.player,
    enemies: state.enemies,
    pickups: state.pickups,
    removed: state.removed,
    gates: state.gates,
    gateRising: state.gateRising,
    flags: state.flags,
    stage: state.stage,
    objective: state.objective,
  });
}

function saveCheckpoint(state, quiet = false) {
  const p = state.player;
  const keepHp = p.hp;
  p.hp = Math.max(p.hp, 60);
  state.checkpoint = snapshot(state);
  p.hp = keepHp;
  if (!quiet) emit(state, 'checkpoint', {});
}

/** After falling: the Lattice weaves the thread back in at the last checkpoint. */
export function respawn(state) {
  if (state.status !== 'dead' || !state.checkpoint) return state;
  const snap = JSON.parse(state.checkpoint);
  Object.assign(state, snap);
  const p = state.player;
  p.hp = Math.max(p.hp, 70);
  p.ward = PLAYER.MAX_WARD;
  p.vx = 0;
  p.vy = 0;
  p.vz = 0;
  p.reload = null;
  p.swap = null;
  p.cooldown = 0;
  p.lastHurtT = -1e9;
  for (const id of WEAPON_ORDER) p.ammo[id].reserve = Math.max(p.ammo[id].reserve, Math.round(WEAPONS[id].reserve * 0.6));
  state.projectiles = [];
  state.status = 'playing';
  state.prompt = null;
  state.events = [];
  emit(state, 'respawn', {});
  emit(state, 'radio', { key: 'respawn' });
  emit(state, 'objective', { text: state.objective.text });
  return state;
}

/** Dev and tests: start at a later stage with the earlier ones already won. */
function warpToStage(state, stage) {
  const L = state.level;
  const kill = (groups) => {
    for (const e of state.enemies) {
      if (!groups.includes(e.group)) continue;
      e.hp = 0;
      e.state = 'dead';
      e.dormant = false;
      e.deadT = -1e9;
    }
  };
  const put = (x, z) => {
    state.player.x = x;
    state.player.z = z;
    state.player.y = groundY(x, z);
  };
  const idx = STAGES.indexOf(stage);
  state.stage = stage;
  if (idx >= 1) put(L.gates.gateA, -18);
  if (idx >= 2) {
    kill(['A']);
    put(L.gates.gateA, -52);
  }
  if (idx >= 3) {
    kill(['B']);
    put(L.winch.x - 1.2, L.winch.z + 1.4);
    state.gateRising = true;
    deployGroup(state, 'B2');
  }
  if (idx >= 4) {
    kill(['B2']);
    state.gates.inner_gate = 1;
    put(L.gates.gateB, -106);
  }
  if (idx >= 5) {
    kill(['C', 'C2']);
    put(L.gates.gateD, -153);
    engageWalker(state);
  }
  if (idx >= 6) {
    kill(['W', 'D']);
    put(2, -176);
  }
  setObjective(state, stage === 'gate' ? 'gate' : stage, true);
  state.events = [];
}

// ───────────────────────────────────────────────────────────── script

function setObjective(state, id, quiet = false) {
  const L = state.level;
  const marks = {
    advance: [L.gates.gateA, -40],
    picket: [L.gates.gateA, -40],
    checkpoint: [L.gates.gateA, -72],
    winch: [L.winch.x, L.winch.z],
    gate: [L.gates.gateB, -100],
    ford: [L.gates.gateD, -152],
    depot: [2, -188],
    surrender: [2, -188],
    done: null,
  };
  const m = marks[id];
  state.objective = { id, text: OBJECTIVES[id], x: m ? m[0] : null, z: m ? m[1] : null };
  if (!quiet) emit(state, 'objective', { text: state.objective.text });
}

function groupAlive(state, group) {
  let n = 0;
  for (const e of state.enemies) if (e.group === group && e.hp > 0 && !e.dormant) n += 1;
  return n;
}

function say(state, key) {
  if (state.flags[`said_${key}`]) return;
  state.flags[`said_${key}`] = true;
  emit(state, 'radio', { key });
}

function engageWalker(state) {
  const w = state.enemies.find((e) => e.type === 'walker');
  if (!w || w.hp <= 0 || w.mode !== 'overwatch') return;
  w.mode = 'engage';
  w.alerted = true;
  w.state = 'hunt';
  w.stT = 0;
  w.atkCd = 2.2;
  emit(state, 'walker_engage', { id: w.id });
}

function stepScript(state, dt) {
  const p = state.player;
  const L = state.level;
  switch (state.stage) {
    case 'advance':
      if (p.z < -6) say(state, 'picket_seen');
      if (p.z < -13 || state.enemies.some((e) => e.group === 'A' && e.alerted)) {
        alertGroup(state, 'A');
        state.stage = 'picket';
        setObjective(state, 'picket');
      }
      break;
    case 'picket':
      if (groupAlive(state, 'A') === 0) {
        state.stage = 'checkpoint';
        setObjective(state, 'checkpoint');
        say(state, 'picket_clear');
        saveCheckpoint(state);
      }
      break;
    case 'checkpoint':
      if (p.z < -50) say(state, 'checkpoint_seen');
      if (p.z < -56) alertGroup(state, 'B');
      if (groupAlive(state, 'B') === 0) {
        if (state.objective.id !== 'winch') {
          setObjective(state, 'winch');
          say(state, 'checkpoint_clear');
          saveCheckpoint(state);
        }
      }
      break;
    case 'gate':
      if (state.gateRising && state.gates.inner_gate < 1) {
        const before = state.gates.inner_gate;
        state.gates.inner_gate = Math.min(1, before + dt / 16);
        if (before < 0.75 && state.gates.inner_gate >= 0.75) emit(state, 'gate', { id: 'inner_gate', open: true });
      }
      if (state.gates.inner_gate >= 1 && groupAlive(state, 'B2') === 0) {
        state.stage = 'ford';
        setObjective(state, 'ford');
        say(state, 'gate_open');
        saveCheckpoint(state);
      }
      break;
    case 'ford':
      if (p.z < -104) {
        say(state, 'ford_seen');
        alertGroup(state, 'C');
      }
      if (p.z < -117 && !state.flags.rush) {
        state.flags.rush = true;
        deployGroup(state, 'C2');
        say(state, 'ford_rush');
      }
      if (p.z < -150 && groupAlive(state, 'C') + groupAlive(state, 'C2') === 0) {
        state.stage = 'depot';
        setObjective(state, 'depot');
        say(state, 'far_bank');
        saveCheckpoint(state);
      }
      break;
    case 'depot': {
      if (p.z < -159) {
        engageWalker(state);
        say(state, 'walker_engage');
      }
      const w = state.enemies.find((e) => e.type === 'walker');
      if (state.flags.wantCheckpoint) {
        state.flags.wantCheckpoint = false;
        saveCheckpoint(state);
      }
      if (w && w.hp <= 0) {
        w.mode = 'down';
        for (const e of state.enemies) {
          if (e.group !== 'D' || e.hp <= 0) continue;
          // the yard gives up when the walker falls
          e.hp = 0;
          e.state = 'dead';
          e.deadT = state.t;
          e.surrendered = true;
        }
        state.projectiles.length = 0;
        state.stage = 'surrender';
        setObjective(state, 'surrender');
        state.objective.x = w.x;
        state.objective.z = w.z + 4.5;
        say(state, 'walker_down');
      }
      break;
    }
    default:
  }

  // what could the Sovereign do with a free hand right now?
  state.prompt = null;
  if (state.objective.id === 'winch' && Math.hypot(p.x - L.winch.x, p.z - L.winch.z) < 2.6) {
    state.prompt = { id: 'winch', text: 'Turn the winch' };
  } else if (state.stage === 'surrender' && Math.hypot(p.x - state.objective.x, p.z - state.objective.z) < 3.2) {
    state.prompt = { id: 'surrender', text: 'Speak to the pilot' };
  }
}

function interact(state) {
  if (!state.prompt) return;
  if (state.prompt.id === 'winch') {
    state.stage = 'gate';
    state.gateRising = true;
    setObjective(state, 'gate');
    deployGroup(state, 'B2');
    say(state, 'gate_start');
    emit(state, 'gate', { id: 'inner_gate', open: false, start: true });
  } else if (state.prompt.id === 'surrender') {
    emit(state, 'surrender', {});
    state.flags.surrenderOpen = true;
  }
}

/** The last choice of the mission: 'released' sends the pilot home; 'held' gives her to Director Rey. */
export function resolveSurrender(state, choice) {
  if (state.stage !== 'surrender') return state;
  state.outcome = choice === 'held' ? 'held' : 'released';
  state.stage = 'done';
  state.status = 'won';
  setObjective(state, 'done', true);
  emit(state, 'radio', { key: 'won' });
  emit(state, 'won', { outcome: state.outcome });
  return state;
}

// ───────────────────────────────────────────────────────────── player

function eyeY(p) {
  return p.y + lerp(PLAYER.EYE, PLAYER.CROUCH_EYE, p.crouch);
}

function stepPlayer(state, inp, dt, rng, edge) {
  const p = state.player;
  p.yaw = inp.yaw ?? p.yaw;
  p.pitch = clamp(inp.pitch ?? p.pitch, -1.5, 1.5);
  const wantCrouch = !!inp.crouch;
  p.crouch += ((wantCrouch ? 1 : 0) - p.crouch) * Math.min(1, dt * 11);
  p.ads += ((inp.ads && !p.reload && !p.sprinting ? 1 : 0) - p.ads) * Math.min(1, dt * 13);

  // Shield Ward: hold to raise it; it drains while up and returns when lowered
  const wantWard = !!inp.ward && p.ward > (p.warding ? 0 : 8);
  if (wantWard !== p.warding) {
    p.warding = wantWard;
    if (!wantWard) p.wardOffT = state.t;
    emit(state, wantWard ? 'ward_on' : 'ward_off', {});
  }
  if (p.warding) p.ward = Math.max(0, p.ward - PLAYER.WARD_DRAIN_PER_S * dt);
  else if (state.t - p.wardOffT > PLAYER.WARD_REGEN_DELAY_MS) p.ward = Math.min(PLAYER.MAX_WARD, p.ward + PLAYER.WARD_REGEN_PER_S * dt);

  let mx = clamp(inp.moveX ?? 0, -1, 1);
  let mz = clamp(inp.moveZ ?? 0, -1, 1);
  const ml = Math.hypot(mx, mz);
  if (ml > 1) {
    mx /= ml;
    mz /= ml;
  }
  const depth = Math.max(0, WATER_Y - p.y);
  // pulling the trigger always wins over sprinting: you slow to a walk and the shot goes
  p.sprinting = !!inp.sprint && mz > 0.3 && !wantCrouch && !inp.ads && !inp.fire && !p.warding && p.grounded && depth < 0.5;
  let speed = p.sprinting ? PLAYER.SPRINT : PLAYER.WALK;
  if (p.crouch > 0.5) speed = PLAYER.CROUCH;
  if (p.ads > 0.5) speed *= 0.62;
  if (p.warding) speed *= 0.72;
  speed *= lerp(1, 0.5, clamp(depth / 1.1, 0, 1));
  const fx = -Math.sin(p.yaw);
  const fz = -Math.cos(p.yaw);
  const rx = Math.cos(p.yaw);
  const rz = -Math.sin(p.yaw);
  const wx = (fx * mz + rx * mx) * speed;
  const wz = (fz * mz + rz * mx) * speed;
  const accel = Math.min(1, (p.grounded ? 13 : 2.6) * dt);
  p.vx += (wx - p.vx) * accel;
  p.vz += (wz - p.vz) * accel;

  if (edge && inp.jump && p.grounded && p.crouch < 0.6) {
    p.vy = PLAYER.JUMP;
    p.grounded = false;
    emit(state, 'jump', {});
  }
  p.vy -= PLAYER.GRAVITY * dt;

  const height = lerp(PLAYER.HEIGHT, PLAYER.CROUCH_HEIGHT, p.crouch);
  const bx = p.x;
  const bz = p.z;
  moveCircle(state, p, p.vx * dt, p.vz * dt, PLAYER.RADIUS, height, p.grounded ? 0.5 : 0.3);
  p.x = clamp(p.x, BOUNDS.minX, BOUNDS.maxX);
  p.z = clamp(p.z, BOUNDS.minZ, BOUNDS.maxZ);
  // the walker is not something you walk through
  for (const e of state.enemies) {
    if (e.type !== 'walker' || e.hp <= 0 && e.mode !== 'down') continue;
    const dx = p.x - e.x;
    const dz = p.z - e.z;
    const d = Math.hypot(dx, dz);
    const r = e.mode === 'down' || e.kneel > 0.5 ? 3.0 : 1.2;
    if (d < r && d > 1e-4) {
      p.x = e.x + (dx / d) * r;
      p.z = e.z + (dz / d) * r;
    }
  }

  let ny = p.y + p.vy * dt;
  const floor = floorAt(state, p.x, p.z, p.y, 0.5);
  if (ny <= floor) {
    if (!p.grounded && p.vy < -7.5) emit(state, 'land', { hard: p.vy < -11, surface: surfaceAt(p.x, p.z) });
    ny = floor;
    p.vy = 0;
    p.grounded = true;
  } else if (p.grounded && p.vy <= 0 && ny - floor < 0.5) {
    ny = floor; // walking downhill: stay glued to the ground
    p.vy = 0;
  } else if (ny - floor > 0.06) {
    p.grounded = false;
  }
  p.y = ny;

  const moved = Math.hypot(p.x - bx, p.z - bz);
  if (p.grounded && moved > 1e-4) {
    p.stepDist += moved;
    const stride = p.sprinting ? 2.5 : p.crouch > 0.5 ? 1.5 : 2.0;
    if (p.stepDist >= stride) {
      p.stepDist = 0;
      const standingOn = floor > groundY(p.x, p.z) + 0.1 ? 'wood' : surfaceAt(p.x, p.z);
      emit(state, 'step', { surface: standingOn, sprint: p.sprinting });
    }
  }

  // breathe: health returns after a quiet spell
  if (state.t - p.lastHurtT > PLAYER.REGEN_DELAY_MS && p.hp > 0) {
    const cap = PLAYER.MAX_HP * state.diff.regenTo;
    if (p.hp < cap) p.hp = Math.min(cap, p.hp + PLAYER.REGEN_PER_S * dt);
    if (p.hp > 55) state.flags.lowHealthSaid = false;
  }

  stepWeapons(state, inp, dt, rng, edge);
  stepPickups(state);
}

// ───────────────────────────────────────────────────────────── weapons

const SKIP = new Set();

function fireWeapon(state, w, rng) {
  const p = state.player;
  const ammo = p.ammo[w.id];
  ammo.mag -= 1;
  p.cooldown = w.cycleMs;
  p.lastShotT = state.t;
  state.stats.shots += 1;
  const pspeed = Math.hypot(p.vx, p.vz);
  let spread = w.spread + p.bloom;
  spread *= lerp(1, w.adsSpread, p.ads);
  spread *= 1 + (pspeed / PLAYER.WALK) * 0.9;
  if (!p.grounded) spread *= 2.4;
  if (p.crouch > 0.5) spread *= 0.7;
  p.bloom = Math.min(w.bloomMax, p.bloom + w.bloom);
  const a = rng.next() * Math.PI * 2;
  const r = Math.sqrt(rng.next()) * spread;
  const yaw = p.yaw + Math.cos(a) * r;
  const pitch = p.pitch + Math.sin(a) * r;
  const cp = Math.cos(pitch);
  const dx = -Math.sin(yaw) * cp;
  const dy = Math.sin(pitch);
  const dz = -Math.cos(yaw) * cp;
  const ox = p.x;
  const oy = eyeY(p);
  const oz = p.z;

  const world = raySolids(state, ox, oy, oz, dx, dy, dz, w.range);
  let worldT = world.t;
  let nx = world.nx;
  let ny = world.ny;
  let nz = world.nz;
  let solid = world.solid;
  const gt = rayGround(ox, oy, oz, dx, dy, dz, Math.min(w.range, worldT));
  let surface = solid ? solid.kind : 'none';
  if (gt < worldT) {
    worldT = gt;
    solid = null;
    nx = 0;
    ny = 1;
    nz = 0;
    surface = surfaceAt(ox + dx * gt, oz + dz * gt);
  }

  SKIP.clear();
  let endT = Math.min(worldT, w.range);
  let hitEnemy = false;
  let headshot = false;
  let killed = false;
  let left = w.pierce + 1;
  while (left > 0) {
    const hit = rayEnemies(state, ox, oy, oz, dx, dy, dz, endT, SKIP);
    if (!hit.enemy) break;
    const e = hit.enemy;
    const mult = hit.mult < 0 ? w.head : hit.mult;
    const hx = ox + dx * hit.t;
    const hy = oy + dy * hit.t;
    const hz = oz + dz * hit.t;
    const reach = w.falloff ? lerp(1, w.falloff[2], smooth(w.falloff[0], w.falloff[1], hit.t)) : 1;
    damageEnemy(state, e, w.damage * mult * reach, hit.zone, hx, hy, hz, w.id);
    hitEnemy = true;
    if (hit.zone === 'head') headshot = true;
    if (e.hp <= 0) killed = true;
    SKIP.add(e.id);
    left -= 1;
    if (left === 0) endT = hit.t;
    if (e.type === 'walker') {
      endT = hit.t;
      break;
    }
  }
  if (hitEnemy) {
    state.stats.hits += 1;
    if (headshot) state.stats.headshots += 1;
  }
  if (solid && solid.kind === 'fuel' && endT >= worldT - 1e-6) detonateFuel(state, solid);

  emit(state, 'shot', {
    weapon: w.id,
    ox,
    oy,
    oz,
    dx,
    dy,
    dz,
    dist: endT,
    world: endT >= worldT - 1e-6 && worldT < w.range,
    surface,
    nx,
    ny,
    nz,
    enemy: hitEnemy,
    headshot,
    killed,
    recoil: w.recoil * lerp(1, 0.7, p.ads),
  });
  // gunfire wakes anyone close enough to hear which way it came from
  for (const e of state.enemies) {
    if (e.alerted || e.dormant || e.hp <= 0 || e.type === 'walker') continue;
    if (Math.hypot(e.x - p.x, e.z - p.z) < 42) alertGroup(state, e.group);
  }
}

function detonateFuel(state, solid) {
  if (state.removed[solid.id]) return;
  state.removed[solid.id] = true;
  explode(state, solid.x, solid.y + 0.7, solid.z, 6.8, 70, 190, 'fuel');
  // casks set each other off
  for (const s of state.level.solids) {
    if (s.kind !== 'fuel' || state.removed[s.id]) continue;
    if (Math.hypot(s.x - solid.x, s.z - solid.z) < 3.2) detonateFuel(state, s);
  }
}

function startReload(state, w) {
  const p = state.player;
  const ammo = p.ammo[w.id];
  if (p.reload || ammo.mag >= w.mag || ammo.reserve <= 0) return false;
  p.reload = { t: 0, total: w.reloadMs };
  emit(state, 'reload_start', { weapon: w.id, ms: w.reloadMs });
  return true;
}

function stepWeapons(state, inp, dt, rng, edge) {
  const p = state.player;
  const ms = dt * 1000;
  let w = WEAPONS[p.weapon];
  p.cooldown = Math.max(0, p.cooldown - ms);
  p.pulseCd = Math.max(0, p.pulseCd - ms);
  p.meleeCd = Math.max(0, p.meleeCd - ms);
  p.bloom = Math.max(0, p.bloom - dt * 0.055);
  // the carbine is never truly empty: with no reserve it draws one magazine back, slowly
  const car = p.ammo.carbine;
  if (car.reserve < WEAPONS.carbine.mag && car.mag + car.reserve < WEAPONS.carbine.mag) {
    p.trickle = (p.trickle ?? 0) + ms;
    if (p.trickle >= WEAPONS.carbine.trickleMs) {
      p.trickle = 0;
      car.reserve += 1;
    }
  }

  if (p.swap) {
    p.swap.t += ms;
    if (p.swap.t >= p.swap.total) {
      p.weapon = p.swap.to;
      p.swap = null;
      p.bloom = 0;
      w = WEAPONS[p.weapon];
    }
  }
  if (p.reload) {
    p.reload.t += ms;
    if (p.reload.t >= p.reload.total) {
      const ammo = p.ammo[w.id];
      const need = Math.min(w.mag - ammo.mag, ammo.reserve);
      ammo.mag += need;
      ammo.reserve -= need;
      p.reload = null;
      emit(state, 'reload_end', { weapon: w.id });
    }
  }

  if (edge) {
    const want = inp.weapon && WEAPONS[inp.weapon] ? inp.weapon : inp.swap ? WEAPON_ORDER[(WEAPON_ORDER.indexOf(p.weapon) + 1) % WEAPON_ORDER.length] : null;
    if (want && want !== p.weapon && !p.swap) {
      p.reload = null;
      p.swap = { t: 0, total: 420, to: want };
      emit(state, 'swap', { to: want });
    }
    if (inp.reload && !p.swap) startReload(state, w);
    if (inp.interact) interact(state);
    if (inp.pulse && p.pulseCd <= 0) arcPulse(state);
    if (inp.melee && p.meleeCd <= 0 && !p.warding) bladeStrike(state);
  }

  const fire = !!inp.fire;
  const pressed = fire && !p.fireHeld;
  p.fireHeld = fire;
  const busy = p.swap || p.reload || p.warding || p.sprinting || p.meleeCd > PLAYER.MELEE_COOLDOWN_MS - 280;
  if (fire && !busy && p.cooldown <= 0 && (w.auto || pressed)) {
    if (p.ammo[w.id].mag > 0) fireWeapon(state, w, rng);
    else if (!startReload(state, w) && pressed) emit(state, 'dry', { weapon: w.id });
  }
}

function arcPulse(state) {
  const p = state.player;
  p.pulseCd = PLAYER.PULSE_COOLDOWN_MS;
  emit(state, 'pulse', { x: p.x, y: p.y + 1, z: p.z, radius: PLAYER.PULSE_RADIUS });
  for (const e of state.enemies) {
    if (e.hp <= 0 || e.dormant) continue;
    const d = Math.hypot(e.x - p.x, e.z - p.z);
    if (d > PLAYER.PULSE_RADIUS + (e.type === 'walker' ? 2 : 0)) continue;
    if (e.type === 'walker') {
      damageEnemy(state, e, PLAYER.PULSE_DAMAGE * 2, 'leg_l', e.x, e.y + 2, e.z, 'pulse');
      damageEnemy(state, e, PLAYER.PULSE_DAMAGE * 2, 'leg_r', e.x, e.y + 2, e.z, 'pulse');
      continue;
    }
    damageEnemy(state, e, PLAYER.PULSE_DAMAGE, 'body', e.x, e.y + 1, e.z, 'pulse');
    if (e.hp > 0) {
      e.state = 'stagger';
      e.stT = 0;
      e.stagger = e.type === 'heavy' ? 1.6 : 2.2;
    }
  }
  // the pulse unmakes bolts in the air
  state.projectiles = state.projectiles.filter((pr) => pr.kind === 'shell' || Math.hypot(pr.x - p.x, pr.z - p.z) > PLAYER.PULSE_RADIUS);
}

function bladeStrike(state) {
  const p = state.player;
  p.meleeCd = PLAYER.MELEE_COOLDOWN_MS;
  const fx = -Math.sin(p.yaw);
  const fz = -Math.cos(p.yaw);
  let best = null;
  let bd = PLAYER.MELEE_RANGE;
  for (const e of state.enemies) {
    if (e.hp <= 0 || e.dormant || e.type === 'walker') continue;
    const dx = e.x - p.x;
    const dz = e.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d > bd || Math.abs(e.y - p.y) > 1.6) continue;
    if ((dx * fx + dz * fz) / (d || 1) < 0.55) continue;
    best = e;
    bd = d;
  }
  if (best) {
    damageEnemy(state, best, PLAYER.MELEE_DAMAGE, 'body', best.x, best.y + 1.2, best.z, 'blade');
    if (best.hp > 0) {
      best.state = 'stagger';
      best.stT = 0;
      best.stagger = 0.9;
    }
  }
  emit(state, 'melee', { hit: !!best });
}

function stepPickups(state) {
  const p = state.player;
  for (const k of state.pickups) {
    if (k.taken) continue;
    if (Math.abs(k.x - p.x) > 1.3 || Math.abs(k.z - p.z) > 1.3 || Math.abs(k.y - p.y) > 1.8) continue;
    if (k.kind === 'cells') {
      const a = p.ammo.carbine;
      if (a.reserve >= WEAPONS.carbine.reserveMax) continue;
      a.reserve = Math.min(WEAPONS.carbine.reserveMax, a.reserve + 60);
    } else if (k.kind === 'charges') {
      const a = p.ammo.lance;
      if (a.reserve >= WEAPONS.lance.reserveMax) continue;
      a.reserve = Math.min(WEAPONS.lance.reserveMax, a.reserve + 6);
    } else if (k.kind === 'draught') {
      if (p.hp >= PLAYER.MAX_HP - 1) continue;
      p.hp = Math.min(PLAYER.MAX_HP, p.hp + 50);
    } else if (k.kind === 'dispatch') {
      if (!state.stats.dispatches.includes(k.lore)) state.stats.dispatches.push(k.lore);
      emit(state, 'dispatch', { lore: k.lore });
    }
    k.taken = true;
    emit(state, 'pickup', { kind: k.kind, x: k.x, y: k.y, z: k.z });
  }
}

// ───────────────────────────────────────────────────────────── projectiles

function stepProjectiles(state, dt) {
  const p = state.player;
  const list = state.projectiles;
  const py0 = p.y + 0.15;
  const py1 = p.y + lerp(PLAYER.HEIGHT, PLAYER.CROUCH_HEIGHT, p.crouch) - 0.05;
  let w = 0;
  for (let i = 0; i < list.length; i += 1) {
    const pr = list[i];
    pr.life -= dt;
    pr.vy -= pr.gravity * dt;
    const sx = pr.vx * dt;
    const sy = pr.vy * dt;
    const sz = pr.vz * dt;
    const len = Math.hypot(sx, sy, sz);
    let done = pr.life <= 0;
    let hitPlayer = false;
    let ix = pr.x + sx;
    let iy = pr.y + sy;
    let iz = pr.z + sz;
    let surface = 'none';
    if (!done && len > 1e-6) {
      const dx = sx / len;
      const dy = sy / len;
      const dz = sz / len;
      let tHit = len;
      const hit = raySolids(state, pr.x, pr.y, pr.z, dx, dy, dz, len);
      if (hit.t <= tHit) {
        tHit = hit.t;
        surface = hit.solid.kind;
        done = true;
        if (hit.solid.kind === 'fuel') detonateFuel(state, hit.solid);
      }
      // the player: closest approach of this step's segment to their body's axis
      if (state.status === 'playing') {
        const ax = p.x - pr.x;
        const az = p.z - pr.z;
        const flat = dx * dx + dz * dz;
        const tt = flat > 1e-9 ? clamp((ax * dx + az * dz) / flat, 0, tHit) : 0;
        const cx = pr.x + dx * tt;
        const cy = pr.y + dy * tt;
        const cz = pr.z + dz * tt;
        if (Math.hypot(cx - p.x, cz - p.z) < PLAYER.RADIUS + 0.06 && cy > py0 && cy < py1) {
          tHit = tt;
          hitPlayer = true;
          done = true;
          surface = 'player';
        }
      }
      ix = pr.x + dx * tHit;
      iy = pr.y + dy * tHit;
      iz = pr.z + dz * tHit;
      if (!done && iy <= groundY(ix, iz)) {
        iy = groundY(ix, iz);
        done = true;
        surface = surfaceAt(ix, iz);
      }
    }
    pr.x = ix;
    pr.y = iy;
    pr.z = iz;
    if (!done) {
      list[w] = pr;
      w += 1;
      continue;
    }
    if (pr.splash > 0) {
      explode(state, ix, iy + 0.2, iz, pr.splash, pr.dmg, 0, 'shell');
    } else {
      if (hitPlayer) hurtPlayer(state, pr.dmg, pr.sx, pr.sz, pr.kind);
      if (pr.life > 0) emit(state, 'impact', { kind: pr.kind, x: ix, y: iy, z: iz, surface });
    }
  }
  list.length = w;
}

// ───────────────────────────────────────────────────────────── step

function tick(state, inp, edge) {
  const rng = makeRng(state.rngSeed);
  state.t += STEP_MS;
  state.tick += 1;
  if (state.status === 'playing') {
    state.stats.timeMs += STEP_MS;
    stepPlayer(state, inp, TICK, rng, edge);
    stepScript(state, TICK);
  }
  stepEnemies(state, TICK, rng);
  stepProjectiles(state, TICK);
  state.rngSeed = rng.seed;
}

/**
 * Advance the mission by dtMs of real time.
 * input: { moveX, moveZ (+1 = forward), yaw, pitch, fire, ads, ward, sprint, crouch,
 *          jump, reload, swap, weapon, pulse, melee, interact }
 * jump / reload / swap / weapon / pulse / melee / interact are presses: they act once per call.
 */
export function stepFps(state, input = {}, dtMs = STEP_MS) {
  state.events = [];
  state.acc += Math.min(MAX_DT_MS, Math.max(0, dtMs));
  let edge = true;
  while (state.acc >= STEP_MS - 1e-6) {
    state.acc -= STEP_MS;
    tick(state, input, edge);
    edge = false;
  }
  return state;
}

// ───────────────────────────────────────────────────────────── views

/** Eye position and view direction, for cameras and bots. */
export function getEye(state) {
  const p = state.player;
  return { x: p.x, y: eyeY(p), z: p.z, yaw: p.yaw, pitch: p.pitch };
}

/** Everything the HUD shows, and nothing it should not. */
export function getHud(state) {
  const p = state.player;
  const w = WEAPONS[p.weapon];
  const walker = state.enemies.find((e) => e.type === 'walker');
  const bossOn = walker && walker.mode !== 'overwatch' && (state.stage === 'depot' || state.stage === 'surrender');
  let bearing = null;
  let distance = null;
  if (state.objective.x != null) {
    const dx = state.objective.x - p.x;
    const dz = state.objective.z - p.z;
    distance = Math.hypot(dx, dz);
    let d = (Math.atan2(-dx, -dz) - p.yaw) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    bearing = -d; // + = to the right
  }
  return {
    status: state.status,
    stage: state.stage,
    hp: p.hp,
    maxHp: PLAYER.MAX_HP,
    ward: p.ward,
    maxWard: PLAYER.MAX_WARD,
    warding: p.warding,
    weapon: w.id,
    weaponName: w.name,
    mag: p.ammo[w.id].mag,
    magSize: w.mag,
    reserve: p.ammo[w.id].reserve,
    reloading: p.reload ? p.reload.t / p.reload.total : null,
    pulse: 1 - p.pulseCd / PLAYER.PULSE_COOLDOWN_MS,
    objective: state.objective.text,
    bearing,
    distance,
    prompt: state.prompt,
    boss: bossOn ? { name: 'Walker "Patience"', hp: walker.hp / walker.maxHp, legs: [walker.legs[0] / walker.legMax, walker.legs[1] / walker.legMax], kneeling: walker.mode === 'kneel' } : null,
    gate: state.stage === 'gate' ? state.gates.inner_gate : null,
    heading: p.yaw,
  };
}

export function getResult(state) {
  const s = state.stats;
  return {
    won: state.status === 'won',
    outcome: state.outcome,
    timeMs: s.timeMs,
    shots: s.shots,
    accuracy: s.shots ? s.hits / s.shots : 0,
    headshots: s.headshots,
    kills: s.kills,
    deaths: s.deaths,
    damageTaken: Math.round(s.damageTaken),
    dispatches: s.dispatches.slice(),
    difficulty: state.diff.id,
  };
}

export { losClear };
